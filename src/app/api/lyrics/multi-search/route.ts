import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';

// Import all search functions
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

interface SearchResult {
  lyrics: string;
  source: string;
  confidence: number;
  title: string;
  artist: string;
  searchTime: number;
  status: 'success' | 'failed' | 'searching';
  error?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { artist, title, query } = await request.json();
    
    // Parse search parameters
    let searchArtist = artist;
    let searchTitle = title;
    
    if (!searchArtist || !searchTitle) {
      if (query) {
        // Try different separators
        let parts = query.split(' - ');
        if (parts.length < 2) {
          parts = query.split(' ');
        }
        
        if (parts.length >= 2) {
          searchArtist = parts[0].trim();
          searchTitle = parts.slice(1).join(' ').trim();
        } else {
          searchArtist = query;
          searchTitle = query;
        }
      }
    }
    
    if (!searchArtist && !searchTitle) {
      return NextResponse.json(
        { success: false, error: 'Search parameters required' },
        { status: 400 }
      );
    }
    
    logger.search(`🎵 Searching for: "${searchArtist} - ${searchTitle}"`);
    
    // Step 1: Check database first
    const dbTimer = new APITimer('Database');
    const dbResult = await searchDatabase(searchArtist, searchTitle);
    if (dbResult) {
      dbTimer.success('Found lyrics');
      logger.cache(true, `"${searchArtist} - ${searchTitle}"`);
      logger.result('Database', 1.0, dbResult.lyrics.length);
      return NextResponse.json({
        success: true,
        results: [dbResult],
        source: 'database',
        fromCache: true
      });
    } else {
      dbTimer.fail('Not found');
      logger.cache(false, `"${searchArtist} - ${searchTitle}" - Searching external APIs...`);
    }
    
    // Step 2: Search using all APIs in parallel
    const searchPromises = [
      searchWithPerplexity(searchArtist, searchTitle),
      searchWithGroq(searchArtist, searchTitle),
      searchWithScraper(searchArtist, searchTitle),
      searchWithGemini(searchArtist, searchTitle)
    ];
    
    const results = await Promise.allSettled(searchPromises);
    
    // Collect successful results
    const successfulResults: SearchResult[] = [];
    const apiNames = ['Perplexity', 'Groq', 'Scraper', 'Gemini'];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        successfulResults.push({
          ...result.value,
          source: apiNames[index]
        });
        logger.result(apiNames[index], result.value.confidence, result.value.lyrics.length);
      }
    });
    
    const totalTime = Date.now() - startTime;
    logger.summary(4, successfulResults.length, totalTime);
    
    // Sort by confidence and completeness
    successfulResults.sort((a, b) => {
      // Prefer longer lyrics (more complete)
      const lengthDiff = b.lyrics.length - a.lyrics.length;
      if (Math.abs(lengthDiff) > 500) return lengthDiff;
      return b.confidence - a.confidence;
    });
    
    if (successfulResults.length === 0) {
      logger.error('Search Failed', 'No lyrics found from any source');
      return NextResponse.json({
        success: false,
        error: 'No lyrics found from any source',
        searchedSources: ['Database', 'Perplexity', 'Groq', 'Scraper', 'Gemini']
      });
    }
    
    logger.success(`Found lyrics from ${successfulResults.length} source(s) - Best: ${successfulResults[0].source}`);
    
    return NextResponse.json({
      success: true,
      results: successfulResults,
      totalSources: successfulResults.length,
      bestResult: successfulResults[0]
    });
    
  } catch (error) {
    logger.error('Multi Search', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Database search function
async function searchDatabase(artist: string, title: string): Promise<SearchResult | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/db-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, title })
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.success && data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        lyrics: result.lrc_content,
        source: 'Database',
        confidence: 1.0,
        title: result.title,
        artist: result.artist,
        searchTime: 0.1,
        status: 'success'
      };
    }
    return null;
  } catch (error) {
    console.error('Database search error:', error);
    return null;
  }
}

// Perplexity search function
async function searchWithPerplexity(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('Perplexity');
  
  if (!PERPLEXITY_API_KEY) {
    timer.skip('No API key');
    return null;
  }
  
  try {
    const systemPrompt = `You are a lyrics search specialist. Find and return COMPLETE lyrics.

CRITICAL REQUIREMENTS:
1. Return 100% COMPLETE lyrics - EVERY SINGLE LINE from beginning to end
2. NO truncation, NO ellipsis, NO "continue with rest"
3. If you cannot find complete lyrics, return "LYRICS_NOT_FOUND"
4. Use original language/script (한글 for Korean, 日本語 for Japanese, etc.)
5. NO markdown, NO explanations, ONLY lyrics`;

    const userPrompt = `Find COMPLETE lyrics for:
Artist: "${artist}"
Title: "${title}"

IMPORTANT: Return the ENTIRE song lyrics from start to finish. Every verse, chorus, bridge, intro, and outro.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 12000
      })
    });

    if (!response.ok) {
      timer.fail(`API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content || content === 'LYRICS_NOT_FOUND' || content.length < 500) {
      timer.fail('Incomplete or not found');
      return null;
    }
    
    timer.success(`${content.length} chars`);
    
    return {
      lyrics: content.trim(),
      source: 'Perplexity',
      confidence: 0.9,
      title,
      artist,
      searchTime: 2.0,
      status: 'success'
    };
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Groq search function
async function searchWithGroq(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('Groq');
  const groqKey = process.env.GROQ_API_KEY || GROQ_API_KEY;
  
  if (!groqKey) {
    timer.skip('No API key');
    return null;
  }
  
  try {
    const prompt = `Find the COMPLETE lyrics for the song "${title}" by "${artist}".
Return ONLY the complete lyrics, no explanations. Include every single line from start to finish.
If the song is in Korean, return in 한글. If Japanese, return in 日本語.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a lyrics database. Return complete, accurate lyrics only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 8000
      })
    });

    if (!response.ok) {
      console.warn(`Groq API returned ${response.status}, skipping...`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content || content.length < 500) {
      timer.fail('Incomplete or not found');
      return null;
    }
    
    timer.success(`${content.length} chars`);
    
    return {
      lyrics: content.trim(),
      source: 'Groq',
      confidence: 0.85,
      title,
      artist,
      searchTime: 1.5,
      status: 'success'
    };
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Web scraper search function
async function searchWithScraper(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('Web Scraper');
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, title })
    });
    
    if (!response.ok) {
      timer.fail('Scraper failed');
      return null;
    }
    
    const data = await response.json();
    if (data.success && data.lyrics) {
      timer.success(`${data.lyrics.length} chars`);
      return {
        lyrics: data.lyrics,
        source: 'Scraper',
        confidence: 0.7,
        title: data.title || title,
        artist: data.artist || artist,
        searchTime: 3.0,
        status: 'success'
      };
    }
    timer.fail('No lyrics found');
    return null;
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Gemini search function
async function searchWithGemini(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('Gemini');
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/gemini-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, title })
    });
    
    if (!response.ok) {
      timer.fail('Gemini API failed');
      return null;
    }
    
    const data = await response.json();
    if (data.success && data.lyrics) {
      timer.success(`${data.lyrics.length} chars`);
      return {
        lyrics: data.lyrics,
        source: 'Gemini',
        confidence: 0.8,
        title: data.title || title,
        artist: data.artist || artist,
        searchTime: 2.5,
        status: 'success'
      };
    }
    timer.fail('No lyrics found');
    return null;
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}