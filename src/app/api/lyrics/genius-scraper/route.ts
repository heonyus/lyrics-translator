import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// HTML에서 텍스트 추출 (가사 전용)
function extractLyricsFromHTML(html: string): string {
  // Genius 특화 처리
  let lyrics = html;
  
  // Genius의 가사 컨테이너 추출
  const lyricsMatch = html.match(/<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi);
  if (lyricsMatch) {
    lyrics = lyricsMatch.map(match => {
      // 각 가사 컨테이너에서 텍스트 추출
      return match
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<\/?a[^>]*>/gi, '') // 링크 제거
        .replace(/<\/?span[^>]*>/gi, '') // span 제거
        .replace(/<\/?div[^>]*>/gi, '') // div 제거
        .replace(/<[^>]+>/g, ''); // 나머지 태그 제거
    }).join('\n');
  }
  
  // HTML 엔티티 디코드
  lyrics = lyrics
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9A-F]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  
  // 구조 표시 정리
  lyrics = lyrics
    .replace(/\[([^\]]+)\]/g, '\n[$1]\n') // [Verse 1] 등을 명확히
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
  
  return lyrics;
}

// Genius 검색
async function searchGenius(artist: string, title: string): Promise<any> {
  try {
    console.log(`🔍 Searching Genius for: ${artist} - ${title}`);
    
    // Step 1: Search for the song
    const query = `${artist} ${title}`.replace(/\s+/g, '%20');
    const searchUrl = `https://genius.com/api/search/multi?q=${query}`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://genius.com/',
      }
    });
    
    if (!searchResponse.ok) {
      console.error(`Genius search failed: ${searchResponse.status}`);
      return null;
    }
    
    const searchData = await searchResponse.json();
    
    // Find the best matching song
    const songs = searchData?.response?.sections?.find((s: any) => s.type === 'song')?.hits || [];
    if (songs.length === 0) {
      console.warn('No songs found on Genius');
      return null;
    }
    
    const song = songs[0].result;
    const songUrl = song.url;
    
    if (!songUrl) {
      console.warn('No song URL found');
      return null;
    }
    
    console.log(`📄 Fetching lyrics from: ${songUrl}`);
    
    // Step 2: Fetch the lyrics page
    const lyricsResponse = await fetch(songUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    if (!lyricsResponse.ok) {
      console.error(`Failed to fetch lyrics page: ${lyricsResponse.status}`);
      return null;
    }
    
    const html = await lyricsResponse.text();
    
    // Extract lyrics from HTML
    const lyrics = extractLyricsFromHTML(html);
    
    if (!lyrics || lyrics.length < 200) {
      console.warn('Lyrics too short or not found');
      return null;
    }
    
    console.log(`✅ Found complete lyrics: ${lyrics.length} chars`);
    
    return {
      lyrics,
      source: 'genius',
      url: songUrl,
      metadata: {
        artist: song.primary_artist?.name || artist,
        title: song.title || title,
        album: song.album?.name,
      },
      confidence: 0.95,
      hasTimestamps: false
    };
    
  } catch (error) {
    console.error('Genius scraper error:', error);
    return null;
  }
}

// Genius를 통한 더 정확한 검색 (API 없이)
async function searchGeniusDirect(artist: string, title: string): Promise<any> {
  try {
    // 직접 URL 생성 (Genius URL 패턴)
    const cleanArtist = artist.toLowerCase().replace(/[^\w\s가-힣]/g, '').replace(/\s+/g, '-');
    const cleanTitle = title.toLowerCase().replace(/[^\w\s가-힣]/g, '').replace(/\s+/g, '-');
    const directUrl = `https://genius.com/${cleanArtist}-${cleanTitle}-lyrics`;
    
    console.log(`🎯 Trying direct Genius URL: ${directUrl}`);
    
    const response = await fetch(directUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
      }
    });
    
    if (response.ok) {
      const html = await response.text();
      
      // Genius 페이지에서 가사 추출
      let lyrics = '';
      
      // 방법 1: data-lyrics-container 속성으로 찾기
      const containerMatches = html.match(/<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi);
      if (containerMatches) {
        lyrics = containerMatches.map(match => {
          return match
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/?[^>]+(>|$)/g, '') // 모든 HTML 태그 제거
            .replace(/\n{3,}/g, '\n\n'); // 과도한 줄바꿈 정리
        }).join('\n');
      }
      
      // 방법 2: Lyrics__Container 클래스로 찾기
      if (!lyrics) {
        const lyricsMatch = html.match(/<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
        if (lyricsMatch) {
          lyrics = extractLyricsFromHTML(lyricsMatch.join('\n'));
        }
      }
      
      if (lyrics && lyrics.length > 200) {
        console.log(`✅ Found complete lyrics via direct URL: ${lyrics.length} chars`);
        return {
          lyrics,
          source: 'genius-direct',
          url: directUrl,
          confidence: 0.96,
          hasTimestamps: false
        };
      }
    }
  } catch (error) {
    console.warn('Direct Genius URL failed:', error);
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { artist, title } = await request.json();
    
    if (!artist || !title) {
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }
    
    console.log(`🎵 Genius Scraper: "${artist} - ${title}"`);
    
    // Try both methods
    const results = await Promise.allSettled([
      searchGeniusDirect(artist, title),
      searchGenius(artist, title)
    ]);
    
    // Get the best result
    const validResults = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<any>).value)
      .filter(r => r && r.lyrics && r.lyrics.length > 200);
    
    if (validResults.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Could not find complete lyrics on Genius'
      });
    }
    
    // Choose the longest/most complete lyrics
    validResults.sort((a, b) => {
      // Prefer direct URL results
      if (a.source === 'genius-direct' && b.source !== 'genius-direct') return -1;
      if (b.source === 'genius-direct' && a.source !== 'genius-direct') return 1;
      // Then by length
      return b.lyrics.length - a.lyrics.length;
    });
    
    const bestResult = validResults[0];
    
    return NextResponse.json({
      success: true,
      lyrics: bestResult.lyrics,
      source: bestResult.source,
      url: bestResult.url,
      confidence: bestResult.confidence,
      hasTimestamps: false,
      metadata: {
        ...bestResult.metadata,
        length: bestResult.lyrics.length,
        hasStructure: bestResult.lyrics.includes('[') && bestResult.lyrics.includes(']')
      }
    });
    
  } catch (error) {
    console.error('Genius scraper error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Genius scraping failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}