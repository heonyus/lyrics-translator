import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';

// Extract text content from HTML preserving line breaks
function extractTextFromHTML(html: string): string {
  // First preserve line breaks
  let text = html
    // Convert <br> tags to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Convert <p> and </p> to newlines
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    // Convert </div> to newline if it looks like a line break
    .replace(/<\/div>/gi, '\n')
    // Remove script and style tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9A-F]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)));
  
  // Clean up multiple newlines but preserve structure
  text = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
  
  return text;
}

// Search Naver for lyrics
async function searchNaver(artist: string, title: string): Promise<string | null> {
  const timer = new APITimer('Naver Search');
  
  try {
    const query = `${artist} ${title} 가사`;
    const searchUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(query)}`;
    
    logger.info(`🔍 Searching Naver: ${query}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Naver lyrics selectors - updated based on actual structure
    const selectors = [
      // Main lyrics container (found from web inspection)
      /<div[^>]*class="[^"]*_cm_content_area_song_lyric[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*_content_text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      
      // Legacy selectors
      /<div[^>]*class="[^"]*lyrics_text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*api_txt_lines[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      
      // 지식백과 영역
      /<div[^>]*class="[^"]*cm_content_area[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi,
      
      // 통합검색 가사 영역  
      /<div[^>]*data-type="lyrics"[^>]*>([\s\S]*?)<\/div>/gi,
      
      // 모바일 뷰
      /<div[^>]*class="[^"]*_lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      
      // V Live 가사 (네이버 자체 서비스)
      /<pre[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/pre>/gi
    ];
    
    let lyrics = null;
    
    for (const selector of selectors) {
      const matches = html.matchAll(selector);
      for (const match of matches) {
        const text = extractTextFromHTML(match[1]);
        
        // Validate extracted text
        if (text && text.length > 100 && !text.includes('검색결과가 없습니다')) {
          // Check if it looks like actual lyrics
          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length > 5) {
            lyrics = text;
            break;
          }
        }
      }
      if (lyrics) break;
    }
    
    // Try to find lyrics in script tags (structured data)
    if (!lyrics) {
      const scriptMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
      if (scriptMatch) {
        try {
          const jsonData = JSON.parse(scriptMatch[1]);
          if (jsonData.lyrics || jsonData.text) {
            lyrics = jsonData.lyrics || jsonData.text;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    }
    
    if (lyrics) {
      timer.success(`Found ${lyrics.length} chars`);
      return lyrics;
    }
    
    timer.fail('No lyrics found');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Naver search error:', error);
    return null;
  }
}

// Search Google for lyrics
async function searchGoogle(artist: string, title: string): Promise<string | null> {
  const timer = new APITimer('Google Search');
  
  try {
    const query = `${artist} ${title} lyrics`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ko`;
    
    logger.info(`🔍 Searching Google: ${query}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Google lyrics selectors
    const selectors = [
      // Knowledge panel lyrics
      /<div[^>]*class="[^"]*PZPZlf[^"]*"[^>]*data-lyrics-container[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*data-attrid="kc:\/music\/recording_cluster:lyrics"[^>]*>([\s\S]*?)<\/div>/gi,
      
      // Lyrics box
      /<div[^>]*class="[^"]*hwc[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*WbKHeb[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      
      // LyricFind partnership
      /<div[^>]*class="[^"]*ujudUb[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      
      // Mobile view
      /<div[^>]*jsname="[^"]*WbKHeb[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];
    
    let lyrics = null;
    
    for (const selector of selectors) {
      const matches = html.matchAll(selector);
      for (const match of matches) {
        const text = extractTextFromHTML(match[1]);
        
        // Validate extracted text
        if (text && text.length > 100) {
          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length > 5) {
            lyrics = text;
            break;
          }
        }
      }
      if (lyrics) break;
    }
    
    if (lyrics) {
      timer.success(`Found ${lyrics.length} chars`);
      return lyrics;
    }
    
    timer.fail('No lyrics found');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Google search error:', error);
    return null;
  }
}

// Main handler
export async function POST(request: NextRequest) {
  const timer = new APITimer('Search Engine Lyrics');
  
  try {
    const { artist, title, engine = 'auto' } = await request.json();
    
    if (!artist || !title) {
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }
    
    logger.search(`🔍 Search Engine: "${artist} - ${title}" (${engine})`);
    
    let lyrics = null;
    let source = null;
    
    // Detect if it's Korean content
    const isKorean = /[가-힣]/.test(artist + title);
    
    if (engine === 'auto') {
      // Try Naver first for Korean content
      if (isKorean) {
        lyrics = await searchNaver(artist, title);
        if (lyrics) source = 'naver';
      }
      
      // Try Google if Naver failed or for non-Korean content
      if (!lyrics) {
        lyrics = await searchGoogle(artist, title);
        if (lyrics) source = 'google';
      }
      
      // Try the other one as fallback
      if (!lyrics && isKorean) {
        lyrics = await searchGoogle(artist, title);
        if (lyrics) source = 'google';
      } else if (!lyrics && !isKorean) {
        lyrics = await searchNaver(artist, title);
        if (lyrics) source = 'naver';
      }
    } else if (engine === 'naver') {
      lyrics = await searchNaver(artist, title);
      if (lyrics) source = 'naver';
    } else if (engine === 'google') {
      lyrics = await searchGoogle(artist, title);
      if (lyrics) source = 'google';
    }
    
    if (!lyrics) {
      timer.fail('No lyrics found from any search engine');
      return NextResponse.json({
        success: false,
        error: 'Could not find lyrics from search engines',
        engines: engine === 'auto' ? ['naver', 'google'] : [engine]
      });
    }
    
    // Clean up lyrics
    lyrics = lyrics
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.match(/^(출처|Source|Lyrics by|작사|작곡|편곡):/i))
      .join('\n');
    
    // Calculate confidence based on source and content
    let confidence = 0.85; // Base confidence for search engines
    
    // Boost confidence for Korean content from Naver
    if (source === 'naver' && isKorean) confidence = 0.95;
    
    // Boost confidence for longer lyrics
    if (lyrics.length > 1000) confidence += 0.05;
    if (lyrics.split('\n').length > 20) confidence += 0.05;
    
    confidence = Math.min(confidence, 0.99);
    
    timer.success(`Found lyrics from ${source}: ${lyrics.length} chars`);
    
    return NextResponse.json({
      success: true,
      result: {
        artist,
        title,
        lyrics,
        source: `search-engine-${source}`,
        confidence,
        language: isKorean ? 'ko' : 'unknown',
        hasTimestamps: false,
        searchTime: Date.now() - timer['startTime']
      }
    });
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Search Engine API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Search engine scraping failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}