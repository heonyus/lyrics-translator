import { NextRequest, NextResponse } from 'next/server';

// Simple search that actually works
export async function POST(req: NextRequest) {
  console.log('\n===== SIMPLE SEARCH API =====');
  const startTime = Date.now();
  
  try {
    const { artist, title } = await req.json();
    console.log(`Searching: ${artist} - ${title}`);
    
    if (!artist || !title) {
      return NextResponse.json({ error: 'Artist and title required' }, { status: 400 });
    }
    
    const results = [];
    
    // 1. Try LRCLIB (free, no API key needed)
    try {
      console.log('Trying LRCLIB...');
      const params = new URLSearchParams({
        artist_name: artist,
        track_name: title,
      });
      
      const response = await fetch(`https://lrclib.net/api/search?${params}`, {
        headers: { 'User-Agent': 'LyricsTranslator/1.0' },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const best = data[0];
          console.log(`✅ LRCLIB: Found ${data.length} results`);
          
          const lyrics = best.syncedLyrics || best.plainLyrics;
          if (lyrics && lyrics.length > 200) {
            results.push({
              source: 'lrclib',
              lyrics: lyrics,
              hasTimestamps: !!best.syncedLyrics,
              confidence: 0.95,
              metadata: {
                album: best.albumName,
                duration: best.duration,
              }
            });
          }
        } else {
          console.log('❌ LRCLIB: No results');
        }
      }
    } catch (error) {
      console.error('LRCLIB error:', error);
    }
    
    // 2. Try a simple mock/fallback for Korean songs
    if (results.length === 0 && isKorean(artist + title)) {
      console.log('Using Korean fallback...');
      
      // For demo purposes, return a placeholder
      results.push({
        source: 'korean-placeholder',
        lyrics: generatePlaceholderLyrics(artist, title),
        hasTimestamps: false,
        confidence: 0.5,
        metadata: {
          note: 'Placeholder lyrics - real API integration needed'
        }
      });
    }
    
    // 3. Try English fallback
    if (results.length === 0) {
      console.log('Using English fallback...');
      
      // Try with simplified search
      const simplifiedParams = new URLSearchParams({
        artist_name: artist.split(' ')[0], // First word only
        track_name: title.split(' ')[0], // First word only
      });
      
      try {
        const response = await fetch(`https://lrclib.net/api/search?${simplifiedParams}`, {
          headers: { 'User-Agent': 'LyricsTranslator/1.0' },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            console.log(`✅ Simplified search: Found ${data.length} results`);
            const best = data[0];
            const lyrics = best.syncedLyrics || best.plainLyrics;
            
            if (lyrics && lyrics.length > 200) {
              results.push({
                source: 'lrclib-simplified',
                lyrics: lyrics,
                hasTimestamps: !!best.syncedLyrics,
                confidence: 0.7,
                metadata: {
                  album: best.albumName,
                  actualArtist: best.artistName,
                  actualTitle: best.trackName,
                }
              });
            }
          }
        }
      } catch (error) {
        console.error('Simplified search error:', error);
      }
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`Search completed in ${elapsed}ms with ${results.length} results`);
    
    if (results.length === 0) {
      return NextResponse.json({
        error: 'No lyrics found',
        searched: { artist, title },
        timeMs: elapsed,
      }, { status: 404 });
    }
    
    // Return the best result
    const best = results[0];
    return NextResponse.json({
      lyrics: best.lyrics,
      source: best.source,
      confidence: best.confidence,
      hasTimestamps: best.hasTimestamps,
      metadata: best.metadata,
      alternatives: results.slice(1),
      timeMs: elapsed,
    });
    
  } catch (error) {
    console.error('Simple search error:', error);
    return NextResponse.json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

function isKorean(text: string): boolean {
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
}

function generatePlaceholderLyrics(artist: string, title: string): string {
  // Generate placeholder lyrics for testing
  return `[${title} - ${artist}]

[Verse 1]
이 노래는 플레이스홀더 가사입니다
실제 가사를 찾을 수 없어서
임시로 표시되는 내용입니다
곧 실제 가사로 교체될 예정입니다

[Chorus]
${title} ${title}
아름다운 노래
${artist}의 멋진 음악
모두 함께 불러요

[Verse 2]
가사 검색 시스템이
아직 완벽하지 않아서
이렇게 임시 가사를 보여드립니다
양해 부탁드립니다

[Bridge]
실제 가사 API 연동이 필요합니다
Melon, Bugs, Genie 등
한국 음원 사이트 연동 예정

[Outro]
감사합니다
Thank you
ありがとう
谢谢

---
Note: This is placeholder lyrics
Real lyrics integration coming soon`;
}