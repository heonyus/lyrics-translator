import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Melon에서 전체 가사 추출
function extractMelonLyrics(html: string): string {
  let lyrics = '';
  
  // 방법 1: 가사 컨테이너 찾기
  const lyricsMatch = html.match(/<div[^>]*class="[^"]*lyric[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (lyricsMatch) {
    lyrics = lyricsMatch[1];
  }
  
  // 방법 2: d_video_summary ID로 찾기
  if (!lyrics) {
    const summaryMatch = html.match(/<div[^>]*id="d_video_summary"[^>]*>([\s\S]*?)<\/div>/i);
    if (summaryMatch) {
      lyrics = summaryMatch[1];
    }
  }
  
  // 방법 3: 가사 관련 클래스들 찾기
  if (!lyrics) {
    const patterns = [
      /<div[^>]*class="[^"]*song_lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*lyrics_txt[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<xmp[^>]*>([\s\S]*?)<\/xmp>/i,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        lyrics = match[1];
        break;
      }
    }
  }
  
  // HTML 정리
  lyrics = lyrics
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return lyrics;
}

// Melon 전체 가사 검색
async function searchMelonFull(artist: string, title: string): Promise<any> {
  try {
    console.log(`🍈 Searching Melon for complete lyrics: ${artist} - ${title}`);
    
    // Step 1: 검색
    const query = `${artist} ${title}`;
    const searchUrl = `https://www.melon.com/search/total/index.htm?q=${encodeURIComponent(query)}&section=&linkOrText=T&ipath=srch_form`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Cookie': 'PCID=' + Date.now(),
        'Referer': 'https://www.melon.com/',
      }
    });
    
    if (!searchResponse.ok) {
      console.error(`Melon search failed: ${searchResponse.status}`);
      return null;
    }
    
    const searchHtml = await searchResponse.text();
    
    // 곡 ID 추출
    const songIdMatch = searchHtml.match(/goSongDetail\('(\d+)'\)/);
    if (!songIdMatch) {
      // 대체 패턴
      const altMatch = searchHtml.match(/songId["\s]*[:=]["\s]*(\d+)/);
      if (!altMatch) {
        console.warn('No song ID found in Melon search');
        return null;
      }
      songIdMatch[1] = altMatch[1];
    }
    
    const songId = songIdMatch[1];
    console.log(`📝 Found song ID: ${songId}`);
    
    // Step 2: 가사 페이지 접근
    const lyricsUrl = `https://www.melon.com/song/detail.htm?songId=${songId}`;
    
    const lyricsResponse = await fetch(lyricsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Cookie': 'PCID=' + Date.now(),
        'Referer': searchUrl,
      }
    });
    
    if (!lyricsResponse.ok) {
      console.error(`Failed to fetch lyrics page: ${lyricsResponse.status}`);
      return null;
    }
    
    const lyricsHtml = await lyricsResponse.text();
    
    // 전체 가사 추출
    let lyrics = extractMelonLyrics(lyricsHtml);
    
    // 가사가 부족하면 AJAX 호출 시도
    if (!lyrics || lyrics.length < 300) {
      console.log('🔄 Trying AJAX call for full lyrics...');
      
      const ajaxUrl = `https://www.melon.com/commonlike/getSongLyrics.json`;
      const ajaxResponse = await fetch(ajaxUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': 'PCID=' + Date.now(),
          'Referer': lyricsUrl,
        },
        body: `songId=${songId}`
      });
      
      if (ajaxResponse.ok) {
        try {
          const ajaxData = await ajaxResponse.json();
          if (ajaxData.lyric) {
            lyrics = ajaxData.lyric.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
          }
        } catch (e) {
          console.warn('Failed to parse AJAX response');
        }
      }
    }
    
    if (!lyrics || lyrics.length < 200) {
      console.warn('Lyrics too short or not found');
      return null;
    }
    
    // 구조 확인
    const hasVerses = lyrics.includes('1절') || lyrics.includes('Verse') || lyrics.split('\n\n').length > 3;
    const hasChorus = lyrics.includes('후렴') || lyrics.includes('Chorus') || lyrics.includes('Hook');
    const isComplete = lyrics.length > 500 && (hasVerses || lyrics.split('\n').length > 20);
    
    console.log(`✅ Found complete lyrics: ${lyrics.length} chars, Complete: ${isComplete}`);
    
    return {
      lyrics,
      source: 'melon-full',
      url: lyricsUrl,
      confidence: isComplete ? 0.95 : 0.85,
      hasTimestamps: false,
      metadata: {
        songId,
        isComplete,
        hasVerses,
        hasChorus,
        lineCount: lyrics.split('\n').length
      }
    };
    
  } catch (error) {
    console.error('Melon full scraper error:', error);
    return null;
  }
}

// NAVER VIBE 가사 검색 (추가 소스)
async function searchVibe(artist: string, title: string): Promise<any> {
  try {
    console.log(`🎵 Searching VIBE for: ${artist} - ${title}`);
    
    const query = `${artist} ${title}`;
    const searchUrl = `https://vibe.naver.com/search?query=${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    
    // VIBE에서 track ID 찾기
    const trackMatch = html.match(/track\/(\d+)/);
    if (!trackMatch) {
      return null;
    }
    
    const trackId = trackMatch[1];
    const lyricsUrl = `https://vibe.naver.com/track/${trackId}`;
    
    const lyricsResponse = await fetch(lyricsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    });
    
    if (lyricsResponse.ok) {
      const lyricsHtml = await lyricsResponse.text();
      
      // VIBE 가사 추출
      const lyricsMatch = lyricsHtml.match(/<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (lyricsMatch) {
        const lyrics = lyricsMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .trim();
        
        if (lyrics.length > 200) {
          console.log(`✅ Found lyrics on VIBE: ${lyrics.length} chars`);
          return {
            lyrics,
            source: 'vibe',
            url: lyricsUrl,
            confidence: 0.9,
            hasTimestamps: false
          };
        }
      }
    }
  } catch (error) {
    console.warn('VIBE search failed:', error);
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
    
    console.log(`🎵 Korean Full Lyrics Search: "${artist} - ${title}"`);
    
    // 여러 소스에서 병렬 검색
    const results = await Promise.allSettled([
      searchMelonFull(artist, title),
      searchVibe(artist, title)
    ]);
    
    // 유효한 결과 필터링
    const validResults = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<any>).value)
      .filter(r => r && r.lyrics && r.lyrics.length > 200);
    
    if (validResults.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Could not find complete lyrics from Korean sources'
      });
    }
    
    // 가장 완전한 가사 선택
    validResults.sort((a, b) => {
      // 완전성 우선
      if (a.metadata?.isComplete && !b.metadata?.isComplete) return -1;
      if (b.metadata?.isComplete && !a.metadata?.isComplete) return 1;
      // 신뢰도 우선
      if (Math.abs(a.confidence - b.confidence) > 0.05) {
        return b.confidence - a.confidence;
      }
      // 길이 우선
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
        artist,
        title,
        language: 'ko',
        totalResults: validResults.length
      }
    });
    
  } catch (error) {
    console.error('Korean full lyrics scraper error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Korean lyrics scraping failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}