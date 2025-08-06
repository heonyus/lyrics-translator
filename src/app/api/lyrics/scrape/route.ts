import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { artist, title } = await request.json();
    
    // AZLyrics URL 생성 (특수문자 제거, 소문자 변환)
    const cleanArtist = artist.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const azlyricsUrl = `https://www.azlyrics.com/lyrics/${cleanArtist}/${cleanTitle}.html`;
    
    try {
      // AZLyrics에서 가사 가져오기
      const response = await fetch(azlyricsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        const lyrics = extractLyricsFromHTML(html);
        
        if (lyrics) {
          return NextResponse.json({
            success: true,
            source: 'AZLyrics',
            title,
            artist,
            lyrics
          });
        }
      }
    } catch (error) {
      console.error('AZLyrics fetch error:', error);
    }
    
    // Lyrics.com 시도
    try {
      const lyricsComUrl = `https://www.lyrics.com/lyrics/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
      const response = await fetch(lyricsComUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        const lyrics = extractLyricsFromLyricsCom(html);
        
        if (lyrics) {
          return NextResponse.json({
            success: true,
            source: 'Lyrics.com',
            title,
            artist,
            lyrics
          });
        }
      }
    } catch (error) {
      console.error('Lyrics.com fetch error:', error);
    }
    
    return NextResponse.json({
      success: false,
      error: 'Lyrics not found'
    });
  } catch (error) {
    console.error('Lyrics scrape error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to scrape lyrics' },
      { status: 500 }
    );
  }
}

/**
 * AZLyrics HTML에서 가사 추출
 */
function extractLyricsFromHTML(html: string): string | null {
  try {
    // AZLyrics 구조: <!-- Usage of azlyrics.com content ... --> 다음의 div
    const startMarker = '<!-- Usage of azlyrics.com content';
    const endMarker = '<!-- MxM banner -->';
    
    const startIdx = html.indexOf(startMarker);
    const endIdx = html.indexOf(endMarker);
    
    if (startIdx === -1 || endIdx === -1) return null;
    
    // div 태그 찾기
    const divStart = html.indexOf('<div>', startIdx);
    const divEnd = html.indexOf('</div>', divStart);
    
    if (divStart === -1 || divEnd === -1) return null;
    
    // HTML 태그 제거하고 정리
    let lyrics = html.substring(divStart + 5, divEnd);
    lyrics = lyrics.replace(/<br\s*\/?>/gi, '\n');
    lyrics = lyrics.replace(/<[^>]*>/g, '');
    lyrics = lyrics.replace(/&quot;/g, '"');
    lyrics = lyrics.replace(/&amp;/g, '&');
    lyrics = lyrics.replace(/&lt;/g, '<');
    lyrics = lyrics.replace(/&gt;/g, '>');
    lyrics = lyrics.trim();
    
    return lyrics || null;
  } catch (error) {
    console.error('Failed to extract lyrics from HTML:', error);
    return null;
  }
}

/**
 * Lyrics.com HTML에서 가사 추출
 */
function extractLyricsFromLyricsCom(html: string): string | null {
  try {
    // Lyrics.com 구조: <pre id="lyric-body-text">
    const preStart = html.indexOf('<pre id="lyric-body-text"');
    if (preStart === -1) return null;
    
    const contentStart = html.indexOf('>', preStart) + 1;
    const contentEnd = html.indexOf('</pre>', contentStart);
    
    if (contentStart === -1 || contentEnd === -1) return null;
    
    let lyrics = html.substring(contentStart, contentEnd);
    lyrics = lyrics.replace(/<br\s*\/?>/gi, '\n');
    lyrics = lyrics.replace(/<[^>]*>/g, '');
    lyrics = lyrics.replace(/&quot;/g, '"');
    lyrics = lyrics.replace(/&amp;/g, '&');
    lyrics = lyrics.trim();
    
    return lyrics || null;
  } catch (error) {
    console.error('Failed to extract lyrics from Lyrics.com:', error);
    return null;
  }
}