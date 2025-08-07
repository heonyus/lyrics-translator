import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';

interface KoreanLyricsResult {
  lyrics: string;
  source: string;
  confidence: number;
  hasTimestamps: boolean;
  url?: string;
}

export async function POST(request: NextRequest) {
  const timer = new APITimer('Korean Scraper');
  
  try {
    const { artist, title } = await request.json();
    
    if (!artist || !title) {
      timer.fail('Missing parameters');
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }
    
    logger.search(`🇰🇷 Korean Scraper: "${artist} - ${title}"`);
    
    // Try multiple Korean music platforms
    const scrapers = [
      { name: 'Melon', fn: () => scrapeMelon(artist, title) },
      { name: 'Bugs', fn: () => scrapeBugs(artist, title) },
      { name: 'Genie', fn: () => scrapeGenie(artist, title) },
      { name: 'FLO', fn: () => scrapeFLO(artist, title) }
    ];
    
    const results: KoreanLyricsResult[] = [];
    
    // Try each scraper
    for (const scraper of scrapers) {
      const scraperTimer = new APITimer(scraper.name);
      try {
        const result = await scraper.fn();
        if (result && result.lyrics && result.lyrics.length > 100) {
          scraperTimer.success(`Found ${result.lyrics.length} chars`);
          results.push({
            ...result,
            source: scraper.name
          });
          
          // If we found high-quality lyrics, we can stop
          if (result.confidence > 0.8 && result.lyrics.length > 500) {
            break;
          }
        } else {
          scraperTimer.fail('No lyrics found');
        }
      } catch (error) {
        scraperTimer.fail(error instanceof Error ? error.message : 'Scraping failed');
        console.warn(`${scraper.name} scraping failed:`, error);
      }
    }
    
    if (results.length === 0) {
      timer.fail('No lyrics found from any Korean source');
      return NextResponse.json({
        success: false,
        error: 'No lyrics found from Korean sources',
        searched: ['Melon', 'Bugs', 'Genie', 'FLO']
      });
    }
    
    // Sort by confidence and length
    results.sort((a, b) => {
      const confDiff = b.confidence - a.confidence;
      if (Math.abs(confDiff) > 0.1) return confDiff;
      return b.lyrics.length - a.lyrics.length;
    });
    
    const bestResult = results[0];
    const totalTime = Date.now() - timer['startTime'];
    
    timer.success(`Best result from ${bestResult.source}`);
    logger.result('Korean Scraper', bestResult.confidence, bestResult.lyrics.length);
    logger.summary(scrapers.length, results.length, totalTime);
    
    // Save to database
    if (bestResult.confidence > 0.7) {
      try {
        await saveLyricsToDatabase({
          artist,
          title,
          lyrics: bestResult.lyrics,
          source: `korean-${bestResult.source.toLowerCase()}`,
          confidence: bestResult.confidence
        });
        logger.success('Saved to database');
      } catch (error) {
        console.warn('Failed to save to database:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      result: {
        artist,
        title,
        lyrics: bestResult.lyrics,
        source: `Korean (${bestResult.source})`,
        confidence: bestResult.confidence,
        hasTimestamps: bestResult.hasTimestamps,
        url: bestResult.url,
        searchTime: totalTime
      },
      alternatives: results.slice(1, 3) // Include up to 2 alternatives
    });
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Korean Scraper', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Korean scraping failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Scrape Melon (Korea's largest music platform)
async function scrapeMelon(artist: string, title: string): Promise<KoreanLyricsResult | null> {
  try {
    // First, search for the song using Perplexity
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
    if (!PERPLEXITY_API_KEY) return null;
    
    // Search for Melon lyrics URL
    const searchResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'Find the Melon.com lyrics page URL. Return ONLY the direct URL, nothing else.'
          },
          {
            role: 'user',
            content: `Find Melon lyrics URL for: "${title}" by "${artist}" site:melon.com`
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      })
    });
    
    if (!searchResponse.ok) return null;
    
    const searchData = await searchResponse.json();
    const urlContent = searchData.choices?.[0]?.message?.content || '';
    const urlMatch = urlContent.match(/https?:\/\/[^\s]+melon\.com[^\s]+/);
    
    if (!urlMatch) return null;
    
    const url = urlMatch[0];
    
    // Fetch the page
    const pageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9'
      }
    });
    
    if (!pageResponse.ok) return null;
    
    const html = await pageResponse.text();
    
    // Parse with Groq
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) return null;
    
    const parseResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Extract Korean lyrics from Melon HTML. Return ONLY the complete lyrics in Korean. Keep all line breaks.'
          },
          {
            role: 'user',
            content: `Extract lyrics from this Melon page:\n${html.substring(0, 30000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });
    
    if (!parseResponse.ok) return null;
    
    const parseData = await parseResponse.json();
    const lyrics = parseData.choices?.[0]?.message?.content || '';
    
    if (!lyrics || lyrics.length < 100) return null;
    
    return {
      lyrics: lyrics.trim(),
      source: 'Melon',
      confidence: 0.9, // High confidence for Melon
      hasTimestamps: false,
      url
    };
    
  } catch (error) {
    console.error('Melon scraping error:', error);
    return null;
  }
}

// Scrape Bugs Music
async function scrapeBugs(artist: string, title: string): Promise<KoreanLyricsResult | null> {
  try {
    // Similar approach to Melon but for Bugs
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) return null;
    
    // Direct search with Groq (as Bugs has good SEO)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a Korean lyrics finder. Search and return the COMPLETE Korean lyrics. No explanations.'
          },
          {
            role: 'user',
            content: `Find the complete Korean lyrics for "${title}" by "${artist}" from Bugs Music. Return only the lyrics in Korean.`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const lyrics = data.choices?.[0]?.message?.content || '';
    
    if (!lyrics || lyrics.length < 100) return null;
    
    // Verify it's actually Korean
    if (!/[\uAC00-\uD7AF]/.test(lyrics)) return null;
    
    return {
      lyrics: lyrics.trim(),
      source: 'Bugs',
      confidence: 0.85,
      hasTimestamps: false
    };
    
  } catch (error) {
    console.error('Bugs scraping error:', error);
    return null;
  }
}

// Scrape Genie Music
async function scrapeGenie(artist: string, title: string): Promise<KoreanLyricsResult | null> {
  try {
    // Genie often has synced lyrics
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) return null;
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Find Korean lyrics from Genie Music. If timestamps exist, keep them. Return complete lyrics.'
          },
          {
            role: 'user',
            content: `Get lyrics for "${title}" by "${artist}" from Genie Music (지니뮤직).`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const lyrics = data.choices?.[0]?.message?.content || '';
    
    if (!lyrics || lyrics.length < 100) return null;
    
    // Check if it has timestamps
    const hasTimestamps = /\[\d{2}:\d{2}\.\d{2}\]/.test(lyrics);
    
    return {
      lyrics: lyrics.trim(),
      source: 'Genie',
      confidence: hasTimestamps ? 0.9 : 0.8,
      hasTimestamps
    };
    
  } catch (error) {
    console.error('Genie scraping error:', error);
    return null;
  }
}

// Scrape FLO
async function scrapeFLO(artist: string, title: string): Promise<KoreanLyricsResult | null> {
  try {
    // FLO (formerly Samsung Music) - similar approach
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) return null;
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Find Korean lyrics from FLO music service. Return complete lyrics only.'
          },
          {
            role: 'user',
            content: `Find lyrics for "${title}" by "${artist}" from FLO (플로).`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const lyrics = data.choices?.[0]?.message?.content || '';
    
    if (!lyrics || lyrics.length < 100) return null;
    
    return {
      lyrics: lyrics.trim(),
      source: 'FLO',
      confidence: 0.75,
      hasTimestamps: false
    };
    
  } catch (error) {
    console.error('FLO scraping error:', error);
    return null;
  }
}

// Save to database
async function saveLyricsToDatabase(data: {
  artist: string;
  title: string;
  lyrics: string;
  source: string;
  confidence: number;
}) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        artist: data.artist,
        lrc_content: data.lyrics,
        metadata: {
          source: data.source,
          language: 'ko',
          confidence: data.confidence,
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