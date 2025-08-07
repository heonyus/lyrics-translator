import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';

interface SearchResult {
  lyrics: string;
  syncedLyrics?: string;
  source: string;
  confidence: number;
  title: string;
  artist: string;
  searchTime: number;
  status: 'success' | 'failed' | 'searching';
  error?: string;
  url?: string;
  language?: string;
  hasTimestamps?: boolean;
}

// Language detection
function detectLanguage(text: string): 'ko' | 'ja' | 'en' | 'unknown' {
  if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text)) return 'ko';
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return 'ja';
  if (/[a-zA-Z]/.test(text)) return 'en';
  return 'unknown';
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { artist, title, query } = await request.json();
    
    // Parse search parameters
    let searchArtist = artist;
    let searchTitle = title;
    let parseSource = 'direct';
    
    // If no direct artist/title, try smart parsing with Groq
    if (!searchArtist || !searchTitle) {
      if (query) {
        logger.info(`🤖 Using Groq to parse query: "${query}"`);
        
        try {
          // Try smart parsing with Groq API
          const parseResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/parse-query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
          });
          
          if (parseResponse.ok) {
            const parseData = await parseResponse.json();
            if (parseData.success && parseData.parsed) {
              const parsed = parseData.parsed;
              searchArtist = parsed.artist;
              searchTitle = parsed.title;
              parseSource = parseData.source || 'groq';
              
              logger.success(`📝 Parsed: Artist="${searchArtist}", Title="${searchTitle}" (${parseSource})`);
            }
          }
        } catch (parseError) {
          logger.warning('Groq parsing failed, using fallback');
        }
        
        // Fallback to simple parsing if Groq fails
        if (!searchArtist || !searchTitle) {
          const parts = query.split(' - ');
          if (parts.length >= 2) {
            searchArtist = parts[0].trim();
            searchTitle = parts.slice(1).join(' ').trim();
          } else {
            // Try to be smart about single string
            const words = query.trim().split(' ');
            if (words.length >= 2) {
              searchArtist = words[0];
              searchTitle = words.slice(1).join(' ');
            } else {
              searchArtist = query;
              searchTitle = query;
            }
          }
          parseSource = 'fallback';
        }
      }
    }
    
    if (!searchArtist && !searchTitle) {
      return NextResponse.json(
        { success: false, error: 'Search parameters required' },
        { status: 400 }
      );
    }
    
    // Start session logging
    logger.startSession(`${searchArtist} - ${searchTitle}`);
    logger.search(`🎯 Multi-Search v2: "${searchArtist} - ${searchTitle}"`);
    
    // Detect language for optimized search
    const language = detectLanguage(`${searchArtist} ${searchTitle}`);
    logger.language(language);
    
    // Step 1: Check database first
    const dbTimer = new APITimer('Database');
    const dbResult = await searchDatabase(searchArtist, searchTitle);
    if (dbResult && dbResult.confidence > 0.8) {
      dbTimer.success('Found high-quality lyrics');
      logger.cache(true, `"${searchArtist} - ${searchTitle}"`);
      logger.result('Database', dbResult.confidence, dbResult.lyrics.length);
      return NextResponse.json({
        success: true,
        results: [dbResult],
        source: 'database',
        fromCache: true,
        language
      });
    } else if (dbResult) {
      dbTimer.success('Found lyrics (low confidence)');
    } else {
      dbTimer.fail('Not found');
    }
    
    logger.cache(false, `Searching external sources...`);
    
    // Step 2: Parallel search based on language
    let searchPromises: Promise<SearchResult | null>[] = [];
    
    // Always include LRCLIB (has all languages)
    searchPromises.push(searchWithLRCLIB(searchArtist, searchTitle));
    
    // Language-specific searches
    if (language === 'ko') {
      // Korean: Prioritize Korean sources
      searchPromises.push(searchKoreanSources(searchArtist, searchTitle));
      searchPromises.push(searchWithSmartScraper(searchArtist, searchTitle, 'ko'));
    } else if (language === 'ja') {
      // Japanese: Use smart scraper for Japanese sites
      searchPromises.push(searchWithSmartScraper(searchArtist, searchTitle, 'ja'));
    } else {
      // English/Other: Use Genius and general scraping
      searchPromises.push(searchWithGenius(searchArtist, searchTitle));
      searchPromises.push(searchWithSmartScraper(searchArtist, searchTitle, 'en'));
    }
    
    // Add database result if exists (low confidence)
    if (dbResult) {
      searchPromises.push(Promise.resolve(dbResult));
    }
    
    // Execute all searches in parallel
    const results = await Promise.allSettled(searchPromises);
    
    // Collect successful results
    const successfulResults: SearchResult[] = [];
    const apiNames = ['LRCLIB', 
                      language === 'ko' ? 'Korean Sites' : language === 'ja' ? 'Japanese Sites' : 'Genius',
                      'Smart Scraper',
                      dbResult ? 'Database' : null].filter(Boolean);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const res = result.value;
        successfulResults.push({
          ...res,
          source: res.source || apiNames[index] || 'Unknown'
        });
        logger.result(apiNames[index] || 'Unknown', res.confidence, res.lyrics.length);
      }
    });
    
    const totalTime = Date.now() - startTime;
    logger.summary(searchPromises.length, successfulResults.length, totalTime);
    
    // Sort by quality criteria
    successfulResults.sort((a, b) => {
      // Prioritize synced lyrics
      if (a.syncedLyrics && !b.syncedLyrics) return -1;
      if (!a.syncedLyrics && b.syncedLyrics) return 1;
      
      // Then by confidence
      const confDiff = b.confidence - a.confidence;
      if (Math.abs(confDiff) > 0.1) return confDiff;
      
      // Then by length (more complete)
      return b.lyrics.length - a.lyrics.length;
    });
    
    if (successfulResults.length === 0) {
      logger.error('Search Failed', 'No lyrics found from any source');
      return NextResponse.json({
        success: false,
        error: 'No lyrics found from any source',
        searchedSources: apiNames,
        language
      });
    }
    
    logger.success(`Found lyrics from ${successfulResults.length} source(s) - Best: ${successfulResults[0].source}`);
    
    // Save best result to database if not from database
    if (successfulResults[0].source !== 'Database' && successfulResults[0].confidence > 0.7) {
      try {
        await saveLyricsToDatabase({
          artist: searchArtist,
          title: searchTitle,
          lyrics: successfulResults[0].lyrics,
          syncedLyrics: successfulResults[0].syncedLyrics,
          source: successfulResults[0].source,
          language,
          confidence: successfulResults[0].confidence
        });
        logger.success('Saved best result to database');
      } catch (error) {
        console.warn('Failed to save to database:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      results: successfulResults,
      totalSources: successfulResults.length,
      bestResult: successfulResults[0],
      language,
      searchTime: totalTime,
      parsing: {
        source: parseSource,
        original: query || `${artist} - ${title}`,
        parsed: {
          artist: searchArtist,
          title: searchTitle
        }
      }
    });
    
  } catch (error) {
    logger.error('Multi Search v2', error);
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

// Database search
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
        confidence: result.metadata?.confidence || 0.7,
        title: result.title,
        artist: result.artist,
        searchTime: 0.1,
        status: 'success',
        language: result.metadata?.language
      };
    }
    return null;
  } catch (error) {
    console.error('Database search error:', error);
    return null;
  }
}

// LRCLIB search
async function searchWithLRCLIB(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('LRCLIB');
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/lrclib-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, title })
    });
    
    if (!response.ok) {
      timer.fail('API call failed');
      return null;
    }
    
    const data = await response.json();
    if (data.success && data.result) {
      timer.success(`Found lyrics (synced: ${data.result.hasSyncedLyrics})`);
      return {
        lyrics: data.result.lyrics,
        syncedLyrics: data.result.syncedLyrics,
        source: 'LRCLIB',
        confidence: data.result.confidence,
        title: data.result.title || title,
        artist: data.result.artist || artist,
        searchTime: data.result.searchTime,
        status: 'success',
        hasTimestamps: data.result.hasSyncedLyrics
      };
    }
    
    timer.fail('No lyrics found');
    return null;
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Korean sources search
async function searchKoreanSources(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('Korean Sources');
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/korean-scraper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, title })
    });
    
    if (!response.ok) {
      timer.fail('API call failed');
      return null;
    }
    
    const data = await response.json();
    if (data.success && data.result) {
      timer.success(`Found from ${data.result.source}`);
      return {
        lyrics: data.result.lyrics,
        source: data.result.source,
        confidence: data.result.confidence,
        title,
        artist,
        searchTime: data.result.searchTime,
        status: 'success',
        url: data.result.url,
        language: 'ko',
        hasTimestamps: data.result.hasTimestamps
      };
    }
    
    timer.fail('No lyrics found');
    return null;
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Smart scraper search
async function searchWithSmartScraper(artist: string, title: string, language: string): Promise<SearchResult | null> {
  const timer = new APITimer('Smart Scraper');
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/smart-scraper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, title, language })
    });
    
    if (!response.ok) {
      timer.fail('API call failed');
      return null;
    }
    
    const data = await response.json();
    if (data.success && data.result) {
      timer.success(`Scraped ${data.result.lyrics.length} chars`);
      return {
        lyrics: data.result.lyrics,
        source: 'Web Scraper',
        confidence: data.result.confidence,
        title,
        artist,
        searchTime: data.result.searchTime,
        status: 'success',
        url: data.result.url,
        language: data.result.language,
        hasTimestamps: data.result.hasTimestamps
      };
    }
    
    timer.fail('No lyrics found');
    return null;
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Genius search (for English songs)
async function searchWithGenius(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('Genius');
  
  try {
    // Using the existing Genius search endpoint if available
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/genius-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, title })
    });
    
    if (!response.ok) {
      // Fallback to smart scraper for Genius
      return searchWithSmartScraper(artist, title, 'en');
    }
    
    const data = await response.json();
    if (data.success && data.lyrics) {
      timer.success(`Found ${data.lyrics.length} chars`);
      return {
        lyrics: data.lyrics,
        source: 'Genius',
        confidence: 0.85,
        title: data.title || title,
        artist: data.artist || artist,
        searchTime: 2.0,
        status: 'success',
        language: 'en'
      };
    }
    
    timer.fail('No lyrics found');
    return null;
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    // Fallback to smart scraper
    return searchWithSmartScraper(artist, title, 'en');
  }
}

// Save to database
async function saveLyricsToDatabase(data: {
  artist: string;
  title: string;
  lyrics: string;
  syncedLyrics?: string;
  source: string;
  language: string;
  confidence: number;
}) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        artist: data.artist,
        lrc_content: data.syncedLyrics || data.lyrics,
        metadata: {
          source: data.source.toLowerCase().replace(/\s+/g, '-'),
          language: data.language,
          confidence: data.confidence,
          hasSyncedLyrics: !!data.syncedLyrics,
          savedAt: new Date().toISOString()
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Save failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Database save error:', error);
    throw error;
  }
}