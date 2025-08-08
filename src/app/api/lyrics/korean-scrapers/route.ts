import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';
import { searchBugs, searchMelon, searchGenie } from './utils';

// Extract text from HTML preserving line breaks
function extractTextFromHTML(html: string): string {
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, '');
  
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9A-F]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)));
  
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

// Search Bugs Music
async function searchBugs(artist: string, title: string): Promise<any | null> {
  const timer = new APITimer('Bugs');
  
  try {
    const query = `${artist} ${title}`;
    const searchUrl = `https://music.bugs.co.kr/search/integrated?q=${encodeURIComponent(query)}`;
    
    logger.info(`🔍 Searching Bugs: ${query}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9'
      }
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Try to find track ID from search results
    const trackMatch = html.match(/track\/(\d+)/);
    if (!trackMatch) {
      timer.fail('No track found');
      return null;
    }
    
    const trackId = trackMatch[1];
    const lyricsUrl = `https://music.bugs.co.kr/track/${trackId}`;
    
    // Fetch lyrics page
    const lyricsResponse = await fetch(lyricsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9'
      }
    });
    
    if (!lyricsResponse.ok) {
      timer.fail('Failed to fetch lyrics page');
      return null;
    }
    
    const lyricsHtml = await lyricsResponse.text();
    
    // Extract lyrics from Bugs (found from web inspection)
    const lyricsMatch = lyricsHtml.match(/<div[^>]*class="[^"]*lyricsContainer[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                       lyricsHtml.match(/<xmp[^>]*>([\s\S]*?)<\/xmp>/i) ||
                       lyricsHtml.match(/<div[^>]*class="[^"]*lyricsText[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                       lyricsHtml.match(/<section[^>]*class="[^"]*sectionPadding[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/section>/i) ||
                       lyricsHtml.match(/<p[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    
    if (!lyricsMatch) {
      timer.fail('No lyrics found on page');
      return null;
    }
    
    const lyrics = extractTextFromHTML(lyricsMatch[1]);
    
    if (lyrics && lyrics.length > 60) {
      timer.success(`Found ${lyrics.length} chars`);
      return {
        lyrics,
        source: 'bugs',
        url: lyricsUrl,
        confidence: 0.9
      };
    }
    
    timer.fail('Lyrics too short');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Search Melon
async function searchMelon(artist: string, title: string): Promise<any | null> {
  const timer = new APITimer('Melon');
  
  try {
    const query = `${artist} ${title}`;
    const searchUrl = `https://www.melon.com/search/total/index.htm?q=${encodeURIComponent(query)}&section=&linkOrText=T&ipath=srch_form`;
    
    logger.info(`🔍 Searching Melon: ${query}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Cookie': 'PCID=1234567890', // Melon requires some cookie
        'Referer': 'https://www.melon.com/',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract song ID
    const songMatch = html.match(/goSongDetail\('(\d+)'\)/);
    if (!songMatch) {
      timer.fail('No song found');
      return null;
    }
    
    const songId = songMatch[1];
    const lyricsUrl = `https://www.melon.com/song/detail.htm?songId=${songId}`;
    
    // Fetch lyrics page
    const lyricsResponse = await fetch(lyricsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Cookie': 'PCID=1234567890',
        'Referer': searchUrl,
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!lyricsResponse.ok) {
      timer.fail('Failed to fetch lyrics page');
      return null;
    }
    
    const lyricsHtml = await lyricsResponse.text();
    
    // Extract lyrics from Melon
    const lyricsMatch = lyricsHtml.match(/<div[^>]*class="[^"]*lyric[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                       lyricsHtml.match(/<div[^>]*id="d_video_summary"[^>]*>([\s\S]*?)<\/div>/i);
    
    if (!lyricsMatch) {
      timer.fail('No lyrics found on page');
      return null;
    }
    
    const lyrics = extractTextFromHTML(lyricsMatch[1]);
    
    if (lyrics && lyrics.length > 60) {
      timer.success(`Found ${lyrics.length} chars`);
      return {
        lyrics,
        source: 'melon',
        url: lyricsUrl,
        confidence: 0.9
      };
    }
    
    timer.fail('Lyrics too short');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Search Genie
async function searchGenie(artist: string, title: string): Promise<any | null> {
  const timer = new APITimer('Genie');
  
  try {
    const query = `${artist} ${title}`;
    const searchUrl = `https://www.genie.co.kr/search/searchMain?query=${encodeURIComponent(query)}`;
    
    logger.info(`🔍 Searching Genie: ${query}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://www.genie.co.kr/',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract song ID (multiple patterns)
    let songId: string | null = null;
    const songMatch1 = html.match(/songInfo\((\d+)\)/);
    if (songMatch1) songId = songMatch1[1];
    if (!songId) {
      const songMatch2 = html.match(/detail\/songInfo\?xgnm=(\d+)/);
      if (songMatch2) songId = songMatch2[1];
    }
    if (!songId) {
      const songMatch3 = html.match(/data-song-id=["'](\d+)["']/i);
      if (songMatch3) songId = songMatch3[1];
    }
    if (!songId) {
      timer.fail('No song found');
      return null;
    }
    const lyricsUrl = `https://www.genie.co.kr/detail/songInfo?xgnm=${songId}`;
    
    // Fetch lyrics page
    const lyricsResponse = await fetch(lyricsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': searchUrl,
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!lyricsResponse.ok) {
      timer.fail('Failed to fetch lyrics page');
      return null;
    }
    
    const lyricsHtml = await lyricsResponse.text();
    
    // Extract lyrics from Genie
    const lyricsMatch = lyricsHtml.match(/<pre[^>]*id="pLyrics"[^>]*>([\s\S]*?)<\/pre>/i) ||
                       lyricsHtml.match(/<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    
    if (!lyricsMatch) {
      timer.fail('No lyrics found on page');
      return null;
    }
    
    const lyrics = extractTextFromHTML(lyricsMatch[1]);
    
    if (lyrics && lyrics.length > 60) {
      timer.success(`Found ${lyrics.length} chars`);
      return {
        lyrics,
        source: 'genie',
        url: lyricsUrl,
        confidence: 0.9
      };
    }
    
    timer.fail('Lyrics too short');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Main handler
export async function POST(request: NextRequest) {
  const timer = new APITimer('Korean Scrapers');
  
  try {
    const { artist, title } = await request.json();
    
    if (!artist || !title) {
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }
    
    logger.search(`🎵 Korean Sites: "${artist} - ${title}"`);
    
    // Search all Korean sites in parallel
    const searches = [
      searchBugs(artist, title),
      searchMelon(artist, title),
      searchGenie(artist, title)
    ];
    
    const results = await Promise.allSettled(searches);
    
    // Find successful results
    const validResults = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<any>).value);
    
    if (validResults.length === 0) {
      timer.fail('No results from any Korean site');
      return NextResponse.json({
        success: false,
        error: 'Could not find lyrics from Korean sites'
      });
    }
    
    // Sort by confidence and length
    validResults.sort((a, b) => {
      const confDiff = b.confidence - a.confidence;
      if (Math.abs(confDiff) > 0.1) return confDiff;
      return b.lyrics.length - a.lyrics.length;
    });
    
    timer.success(`Found from ${validResults[0].source}: ${validResults[0].lyrics.length} chars`);
    
    return NextResponse.json({
      success: true,
      results: validResults,
      result: {
        ...validResults[0],
        artist,
        title,
        language: 'ko',
        hasTimestamps: false,
        searchTime: Date.now() - timer['startTime']
      }
    });
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Korean Scrapers error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Korean site scraping failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}