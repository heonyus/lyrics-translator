import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCachedValue, setCachedValue, createCacheKey } from '@/lib/cache/memory-cache';

// 서버사이드 환경변수
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || process.env.perplexity_api_key || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.claude_api_key || '';

// API 키 확인 로그 (디버깅용)
if (!OPENAI_API_KEY) {
  console.error('⚠️ OPENAI_API_KEY is not set in environment variables');
} else {
  console.log('✅ OpenAI API Key loaded:', OPENAI_API_KEY.substring(0, 10) + '...');
}

// Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oegdmvhsykhlpmuuizju.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lZ2RtdmhzeWtobHBtdXVpemp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQwNDAzMCwiZXhwIjoyMDY5OTgwMDMwfQ.rguycDy_2HeRvUpqcYZRTFhrBndPiQvd7A0YRmaUu5M'
);

// 한글 아티스트 매핑
const artistMapping: { [key: string]: string } = {
  '샘킴': 'Sam Kim',
  '아이유': 'IU',
  '방탄소년단': 'BTS',
  '블랙핑크': 'BLACKPINK',
  '뉴진스': 'NewJeans',
  '세븐틴': 'SEVENTEEN',
  '에스파': 'aespa',
  '스트레이키즈': 'Stray Kids',
  '엔하이픈': 'ENHYPEN',
  '투모로우바이투게더': 'TXT',
  'TXT': 'Tomorrow X Together',
  '빅뱅': 'BIGBANG',
  '트와이스': 'TWICE',
  '있지': 'ITZY',
  '엔시티': 'NCT',
  '몬스타엑스': 'MONSTA X',
  '아스트로': 'ASTRO',
  '더보이즈': 'THE BOYZ',
  '원어스': 'ONEUS',
  '에이티즈': 'ATEEZ',
  '투바투': 'TXT'
};

// 제목 매핑
const titleMapping: { [key: string]: string } = {
  '메이크업': 'Make Up',
  '좋은날': 'Good Day',
  '밤편지': 'Through the Night',
  '봄날': 'Spring Day',
  '작은것들을위한시': 'Boy With Luv',
  '뚜두뚜두': 'DDU-DU DDU-DU',
  '팬시': 'Fancy',
  '낫샤이': 'Not Shy'
};

interface SearchResult {
  lyrics: string;
  source: string;
  confidence: number;
  title: string;
  artist: string;
  searchTime: number;
  status: 'success' | 'failed' | 'searching';
  error?: string;
  preview?: string; // 미리보기용 첫 몇 줄
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
    
    console.log(`[Multi AI Search] Searching for: ${artist} - ${title}`);
    const startTime = Date.now();
    
    // 결과 수집용 배열
    const results: SearchResult[] = [];
    
    // 영문 아티스트명/제목 변환
    const searchArtist = artistMapping[artist] || artist;
    const searchTitle = titleMapping[title] || title;
    
    // 1. 캐시 확인
    const cached = await checkCache(artist, title);
    if (cached) {
      console.log('✅ Cache hit');
      results.push({
        ...cached,
        source: `${cached.source} (캐시)`,
        searchTime: (Date.now() - startTime) / 1000,
        status: 'success',
        preview: cached.lyrics.split('\n').slice(0, 4).join('\n')
      });
    }
    
    // 병렬로 모든 API 검색 실행
    const searchPromises = [
      // Perplexity
      searchWithPerplexity(searchArtist, artist, searchTitle, title)
        .then(result => {
          if (result) {
            results.push({
              ...result,
              searchTime: (Date.now() - startTime) / 1000,
              status: 'success',
              preview: result.lyrics.split('\n').slice(0, 4).join('\n')
            });
          }
        })
        .catch(error => {
          console.error('Perplexity error:', error);
          results.push({
            lyrics: '',
            source: 'AI-Perplexity',
            confidence: 0,
            title,
            artist,
            searchTime: (Date.now() - startTime) / 1000,
            status: 'failed',
            error: error.message
          });
        }),
      
      // GPT-4o-mini (가성비 최고 모델) - 현재 쿼터 초과로 비활성화
      // searchWithGPT(searchArtist, artist, searchTitle, title)
      //   .then(result => {
      //     if (result) {
      //       results.push({
      //         ...result,
      //         searchTime: (Date.now() - startTime) / 1000,
      //         status: 'success',
      //         preview: result.lyrics.split('\n').slice(0, 4).join('\n')
      //       });
      //     }
      //   })
      //   .catch(error => {
      //     console.error('GPT-4o-mini error:', error);
      //     results.push({
      //       lyrics: '',
      //       source: 'AI-GPT4o-mini',
      //       confidence: 0,
      //       title,
      //       artist,
      //       searchTime: (Date.now() - startTime) / 1000,
      //       status: 'failed',
      //       error: error.message
      //     });
      //   })
    ];
    
    // 모든 검색 완료 대기
    await Promise.allSettled(searchPromises);
    
    // 신뢰도 순으로 정렬
    results.sort((a, b) => b.confidence - a.confidence);
    
    return NextResponse.json({
      success: true,
      results,
      totalSearchTime: (Date.now() - startTime) / 1000
    });
    
  } catch (error) {
    console.error('[Multi AI Search] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 기존 검색 함수들 재사용 (간소화된 버전)
async function searchWithPerplexity(searchArtist: string, originalArtist: string, searchTitle: string, originalTitle: string) {
  const systemPrompt = `You are a professional lyrics database expert. Follow this strict Chain of Thought process:

## CHAIN OF THOUGHT PROCESS:

### Step 1: IDENTIFY THE LANGUAGE AND ORIGIN
Think carefully:
- Artist "${originalArtist}" or "${searchArtist}"
- Is this a Korean artist? (샘킴, 아이유, 방탄소년단, etc.)
- Is this a Japanese artist? (YOASOBI, 米津玄師, etc.)
- Is this a Chinese artist? (周杰倫, 鄧紫棋, etc.)
- What language should the lyrics be in?

### Step 2: DETERMINE CORRECT SCRIPT
Critical thinking:
- Korean songs MUST be in 한글 (NOT romanized)
- Japanese songs MUST be in 日本語 (ひらがな/カタカナ/漢字)
- Chinese songs MUST be in 中文
- English songs in English

### Step 3: SEARCH AND VERIFY
Search process:
- Search in Genius, Melon, Bugs, QQ Music, NetEase
- Find the ORIGINAL lyrics
- Verify it matches the artist and title

### Step 4: RETURN COMPLETE LYRICS
Return format:
- Complete lyrics in ORIGINAL language/script
- All verses, choruses, bridges
- Proper line breaks

## DETAILED FEW-SHOT EXAMPLES:

Example 1 - Korean Song (Korean Script):
Input: "샘킴" - "Make Up"
Thought: Sam Kim is a Korean artist. This song should be in Korean.
Output: [Korean lyrics in 한글 script]
나도 모르게 시작된 내 마음이
[... rest in Korean ...]

Example 2 - Japanese Song (Japanese Script):
Input: "YOASOBI" - "夜に駆ける"
Thought: YOASOBI is a Japanese group. Must return in Japanese script.
Output: [Japanese lyrics in original script]
沈むように溶けてゆくように
[... rest in Japanese ...]

Example 3 - Korean Artist English Title (Still Korean):
Input: "아이유" - "Good Day"
Thought: IU is Korean. Even with English title, lyrics are Korean.
Output: [Korean lyrics]
어제처럼 오늘도
[... rest in Korean ...]

Example 4 - Romanized Input (Return Original):
Input: "Sam Kim" - "Make Up"
Thought: Sam Kim = 샘킴. Must return Korean lyrics, not romanized.
Output: [Same as Example 1, in Korean]

Example 5 - Chinese Song:
Input: "周杰倫" - "七里香"
Thought: Jay Chou is Chinese. Return in Chinese characters.
Output: [Chinese lyrics]
窗外的麻雀在電線桿上多嘴
[... rest in Chinese ...]

## ABSOLUTE RULES:
1. NEVER return romanization (no "nado moreuge" for Korean)
2. NEVER return pronunciation guides or phonetics
3. ALWAYS use original script (한글/日本語/中文)
4. Return COMPLETE lyrics (every line)
5. If not found: Return "LYRICS_NOT_FOUND"
6. NO markdown formatting, NO explanations`;

  const userPrompt = `Find the complete lyrics for:
Artist: "${searchArtist}" (Korean: "${originalArtist}")
Title: "${searchTitle}" (Korean: "${originalTitle}")

Follow the Chain of Thought process and examples above.`;

  try {
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
        max_tokens: 8000,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Perplexity API Error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content || content.includes('LYRICS_NOT_FOUND') || content.length < 100) {
      return null;
    }
    
    // 응답에서 불필요한 텍스트 제거
    let cleanedLyrics = content;
    cleanedLyrics = cleanedLyrics.replace(/^#+\s+.*$/gm, '');
    cleanedLyrics = cleanedLyrics.replace(/^.*?(here are|these are|the lyrics|가사).*?:?\s*$/gmi, '');
    cleanedLyrics = cleanedLyrics.trim();
    
    const confidence = calculateConfidence(cleanedLyrics, originalArtist, originalTitle);
    
    return {
      lyrics: cleanedLyrics,
      source: 'AI-Perplexity',
      confidence,
      title: originalTitle,
      artist: originalArtist
    };
  } catch (error) {
    throw error;
  }
}

async function searchWithGPT(searchArtist: string, originalArtist: string, searchTitle: string, originalTitle: string) {
  // API 키 체크
  if (!OPENAI_API_KEY || OPENAI_API_KEY.length < 10) {
    console.error('OpenAI API key is missing or invalid');
    throw new Error('OpenAI API key not configured');
  }
  
  const systemPrompt = `You are a professional lyrics database system. You must follow a strict Chain of Thought process.

## CHAIN OF THOUGHT PROCESS:

Step 1: RECOGNITION
- Do I recognize this artist? Check both "${searchArtist}" and "${originalArtist}"
- Common Korean artist name mappings:
  * 샘킴 = Sam Kim
  * 아이유 = IU = Lee Ji-eun
  * 방탄소년단 = BTS = Bangtan Boys
  * 블랙핑크 = BLACKPINK
  * 뉴진스 = NewJeans

Step 2: SONG IDENTIFICATION  
- Do I know this song? Check "${searchTitle}" and "${originalTitle}"
- Common Korean song title translations:
  * 메이크업 = Make Up
  * 좋은날 = Good Day
  * 봄날 = Spring Day

Step 3: RETRIEVAL
- If I have the exact lyrics in my training data: Retrieve them completely
- If I don't have them: Return "LYRICS_NOT_FOUND"
- NEVER create or generate lyrics

## FEW-SHOT EXAMPLES:

Example 1 - Korean artist, mixed language song:
User: Sam Kim - Make Up
Thought: Sam Kim is a Korean-American artist. "Make Up" has both English and Korean lyrics.
Output:
I'm speeding to you, call me
I'm on the way 밤새 내 맘이
어디로 가는지도 모른 채
혹시 나 너무 보고 싶어서
Can we make up right now
[continues with complete lyrics]

Example 2 - Korean song:
User: IU - Good Day (좋은날)
Thought: IU is a famous Korean singer. "Good Day" is originally "좋은날" in Korean.
Output:
어제처럼 오늘도
무거운 공기가 나를 감싸고
이유 없이 쏟아지는 빗물처럼
[continues with complete lyrics]

Example 3 - Not in database:
User: RandomBand - UnknownSong2024
Thought: I don't recognize this artist or song in my training data.
Output:
LYRICS_NOT_FOUND

Example 4 - Name variation:
User: 방탄소년단 - Spring Day
Thought: 방탄소년단 is BTS in Korean. "Spring Day" is "봄날" in Korean. I know this song.
Output:
보고 싶다
이렇게 말하니까 더 보고 싶다
[continues with complete lyrics]

## OUTPUT RULES:
1. Return ONLY the lyrics text
2. Include ALL parts of the song
3. NO explanations or thoughts in the output
4. If not found, return exactly: LYRICS_NOT_FOUND`;

  const userPrompt = `Artist: ${searchArtist} (${originalArtist})
Song: ${searchTitle} (${originalTitle})`;

  try {
    console.log('Calling OpenAI API with key:', OPENAI_API_KEY ? `${OPENAI_API_KEY.substring(0, 20)}...` : 'NO KEY');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 8000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        keyUsed: OPENAI_API_KEY ? `${OPENAI_API_KEY.substring(0, 20)}...` : 'NO KEY'
      });
      throw new Error(`OpenAI API Error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content || content.includes('LYRICS_NOT_FOUND') || content.includes('찾을 수 없') || content.length < 100) {
      return null;
    }
    
    const confidence = calculateConfidence(content, originalArtist, originalTitle);
    
    return {
      lyrics: content.trim(),
      source: 'AI-GPT4o-mini',
      confidence,
      title: originalTitle,
      artist: originalArtist
    };
  } catch (error) {
    throw error;
  }
}


function extractLyricsFromContent(content: string, title: string): string {
  // HTML 태그 제거
  let cleaned = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  cleaned = cleaned.replace(/<[^>]*>/g, '\n');
  
  // HTML 엔티티 디코드
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  cleaned = cleaned.replace(/&#39;/g, "'");
  cleaned = cleaned.replace(/&#x27;/g, "'");
  cleaned = cleaned.replace(/&#\d+;/g, ' ');
  
  // 줄바꿈 정리
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // 가사 섹션 찾기 - 개선된 로직
  const lines = cleaned.split('\n');
  const lyricsSections = [];
  let currentSection = [];
  let inLyricsSection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 가사 시작 패턴
    if (!inLyricsSection && 
        (trimmed.includes('[Verse') || 
         trimmed.includes('[Chorus') || 
         trimmed.includes('[Hook') ||
         trimmed.includes('[Bridge') ||
         trimmed.includes('[Intro') ||
         trimmed.includes('[Outro') ||
         /^\[.*\]$/.test(trimmed))) {
      inLyricsSection = true;
    }
    
    // 불필요한 줄 스킵
    if (trimmed.length === 0) {
      if (currentSection.length > 0) {
        currentSection.push('');
      }
      continue;
    }
    
    if (trimmed.startsWith('http') ||
        trimmed.includes('cookie') ||
        trimmed.includes('privacy') ||
        trimmed.includes('copyright') ||
        trimmed.includes('©') ||
        trimmed.includes('advertisement') ||
        trimmed.includes('Terms of') ||
        trimmed.includes('All rights') ||
        trimmed.length > 300) {
      if (currentSection.length > 6) {
        lyricsSections.push(currentSection.join('\n'));
        currentSection = [];
        inLyricsSection = false;
      }
      continue;
    }
    
    currentSection.push(trimmed);
  }
  
  if (currentSection.length > 6) {
    lyricsSections.push(currentSection.join('\n'));
  }
  
  // 가장 긴 섹션 선택 또는 모든 섹션 합치기
  if (lyricsSections.length === 0) {
    // 전체 컨텐츠에서 가사 패턴 찾기
    const allText = lines.join('\n');
    const lyricsMatch = allText.match(/([A-Za-z가-힣\s,.'!?\-]+\n){10,}/g);
    if (lyricsMatch) {
      return lyricsMatch[0].trim();
    }
    return '';
  }
  
  // 모든 섹션을 합쳐서 반환 (가사가 여러 부분으로 나뉘어 있을 수 있음)
  return lyricsSections.join('\n\n');
}

function calculateConfidence(lyrics: string, artist: string, title: string): number {
  if (!lyrics) return 0;
  
  let score = 0;
  const factors = [];
  
  // 길이 체크
  const length = lyrics.length;
  if (length > 500 && length < 4000) {
    score += 0.25;
    factors.push('good_length');
  } else if (length > 200 && length < 5000) {
    score += 0.15;
    factors.push('acceptable_length');
  }
  
  // 줄 수 체크
  const lines = lyrics.split('\n').filter(l => l.trim().length > 0);
  const lineCount = lines.length;
  if (lineCount > 15 && lineCount < 80) {
    score += 0.2;
    factors.push('good_line_count');
  } else if (lineCount > 8) {
    score += 0.1;
    factors.push('acceptable_line_count');
  }
  
  // 언어 매칭
  const isKoreanArtist = /[가-힣]/.test(artist);
  const hasKoreanLyrics = /[가-힣]/.test(lyrics);
  const hasEnglishLyrics = /[a-zA-Z]/.test(lyrics);
  
  if (isKoreanArtist) {
    if (artist === '샘킴' || artist === 'Sam Kim') {
      if (hasEnglishLyrics) {
        score += 0.2;
        factors.push('samkim_english');
      }
    } else if (hasKoreanLyrics) {
      score += 0.2;
      factors.push('korean_match');
    } else if (hasEnglishLyrics) {
      score += 0.1;
      factors.push('partial_language_match');
    }
  } else if (hasEnglishLyrics) {
    score += 0.2;
    factors.push('english_match');
  }
  
  // 제목 포함 여부
  const titleLower = title.toLowerCase();
  const lyricsLower = lyrics.toLowerCase();
  const titleWords = titleLower.split(/\s+/).filter(w => w.length > 2);
  const matchedWords = titleWords.filter(word => lyricsLower.includes(word));
  
  if (matchedWords.length > 0) {
    score += Math.min(0.2, matchedWords.length * 0.1);
    factors.push('title_match');
  }
  
  // 반복 패턴
  const hasRepeatingLines = lines.some((line, idx) => {
    if (line.length < 5) return false;
    const repeats = lines.filter(l => l === line).length;
    return repeats > 1;
  });
  
  if (hasRepeatingLines) {
    score += 0.15;
    factors.push('has_chorus');
  }
  
  console.log(`Confidence: ${artist} - ${title}:`, {
    score: Math.min(score, 1.0),
    factors
  });
  
  return Math.min(score, 1.0);
}

async function checkCache(artist: string, title: string) {
  const cacheKey = createCacheKey(artist, title);
  
  // 1. 메모리 캐시 확인
  const memoryCached = getCachedValue(cacheKey);
  if (memoryCached) {
    return memoryCached;
  }
  
  // 2. 데이터베이스 캐시 확인
  try {
    const { data } = await supabase
      .from('ai_lyrics_cache')
      .select('*')
      .eq('artist', artist)
      .eq('title', title)
      .single();
    
    if (data && new Date(data.expires_at) > new Date()) {
      // 히트 카운트 비동기 업데이트 (응답 지연 방지)
      supabase
        .from('ai_lyrics_cache')
        .update({ hit_count: (data.hit_count || 0) + 1 })
        .eq('id', data.id)
        .then(() => {})
        .catch(() => {});
      
      const cacheData = {
        lyrics: data.lyrics,
        lrcFormat: data.lrc_format,
        source: data.source,
        confidence: data.confidence,
        title: data.title,
        artist: data.artist
      };
      
      // 메모리 캐시에 저장
      setCachedValue(cacheKey, cacheData);
      
      return cacheData;
    }
  } catch (error) {
    // 캐시 미스는 정상
  }
  
  return null;
}