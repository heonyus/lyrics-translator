import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 서버사이드 환경변수
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || process.env.perplexity_api_key || '';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || process.env.tavily_api_key || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

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

export async function POST(request: NextRequest) {
  try {
    const { artist, title } = await request.json();
    
    if (!artist || !title) {
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }
    
    console.log(`[AI Search API] Searching for: ${artist} - ${title}`);
    const startTime = Date.now();
    
    // 1. 캐시 확인
    const cached = await checkCache(artist, title);
    if (cached) {
      console.log('✅ Cache hit');
      return NextResponse.json({
        success: true,
        data: {
          ...cached,
          searchTime: (Date.now() - startTime) / 1000
        }
      });
    }
    
    // 영문 아티스트명/제목 변환
    const searchArtist = artistMapping[artist] || artist;
    const searchTitle = titleMapping[title] || title;
    
    // 2. Perplexity 시도
    try {
      console.log('🔍 Trying Perplexity...');
      const perplexityResult = await searchWithPerplexity(searchArtist, artist, searchTitle, title);
      if (perplexityResult) {
        const result = {
          ...perplexityResult,
          searchTime: (Date.now() - startTime) / 1000
        };
        await saveToCache(result);
        return NextResponse.json({ success: true, data: result });
      }
    } catch (error) {
      console.error('Perplexity error:', error);
    }
    
    // 3. GPT-4 시도
    try {
      console.log('🤖 Trying GPT-4...');
      const gptResult = await searchWithGPT(searchArtist, artist, searchTitle, title);
      if (gptResult) {
        const result = {
          ...gptResult,
          searchTime: (Date.now() - startTime) / 1000
        };
        await saveToCache(result);
        return NextResponse.json({ success: true, data: result });
      }
    } catch (error) {
      console.error('GPT-4 error:', error);
    }
    
    // 4. Tavily 시도
    try {
      console.log('🌐 Trying Tavily...');
      const tavilyResult = await searchWithTavily(searchArtist, artist, searchTitle, title);
      if (tavilyResult) {
        const result = {
          ...tavilyResult,
          searchTime: (Date.now() - startTime) / 1000
        };
        await saveToCache(result);
        return NextResponse.json({ success: true, data: result });
      }
    } catch (error) {
      console.error('Tavily error:', error);
    }
    
    return NextResponse.json({
      success: false,
      error: 'No lyrics found',
      message: '가사를 찾을 수 없습니다. 수동으로 입력해주세요.'
    });
    
  } catch (error) {
    console.error('[AI Search API] Error:', error);
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

// Perplexity 검색 (CoT + Few-shot)
async function searchWithPerplexity(searchArtist: string, originalArtist: string, searchTitle: string, originalTitle: string) {
  const systemPrompt = `You are an expert lyrics search specialist. Use Chain of Thought reasoning to find exact lyrics.

## CHAIN OF THOUGHT PROCESS:

Step 1: ARTIST RECOGNITION
- Identify if "${searchArtist}" or "${originalArtist}" is a known artist
- Check Korean/English name variations (샘킴=Sam Kim, 아이유=IU, etc.)

Step 2: SONG IDENTIFICATION
- Match "${searchTitle}" or "${originalTitle}" to known songs
- Consider Korean/English title variations

Step 3: LYRICS RETRIEVAL
- Search official sources (Genius, Melon, Bugs, etc.)
- Get COMPLETE lyrics (all verses, choruses, bridges)

Step 4: VERIFICATION & OUTPUT
- Verify correct song found
- Return ONLY lyrics text or "LYRICS_NOT_FOUND"

## FEW-SHOT EXAMPLES:

Example 1 - Korean Artist, Korean Song:
Request: IU - Good Day (좋은날)
Thought: IU is a Korean singer. "Good Day" is "좋은날" in Korean.
Output:
어제처럼 오늘도
무거운 공기가 나를 감싸고
이유 없이 쏟아지는 빗물처럼
내 마음도 답답해
[complete lyrics continue...]

Example 2 - Korean Name, English Title:
Request: 샘킴 - Make Up
Thought: 샘킴 is Sam Kim. "Make Up" has mixed Korean/English lyrics.
Output:
I'm speeding to you, call me
I'm on the way 밤새 내 맘이
어디로 가는지도 모른 채
혹시 나 너무 보고 싶어서
Can we make up right now
[complete lyrics continue...]

Example 3 - BTS/방탄소년단 variation:
Request: 방탄소년단 - Spring Day (봄날)
Thought: 방탄소년단 = BTS. "Spring Day" is "봄날" in Korean.
Output:
보고 싶다
이렇게 말하니까 더 보고 싶다
너희 사진을 보고 있어도
보고 싶다
[complete lyrics continue...]

Example 4 - Not Found:
Request: FakeArtist - NonexistentSong
Thought: No such artist or song exists.
Output:
LYRICS_NOT_FOUND

Example 5 - Blackpink Example:
Request: BLACKPINK - DDU-DU DDU-DU
Thought: BLACKPINK Korean title is "뚜두뚜두". Known K-pop group.
Output:
착하게 살지 마
네 설자리 좋아
차 키 empty 하게
내 맘대로 할게
[complete lyrics continue...]

## STRICT OUTPUT RULES:
1. NO explanations, thoughts, or markdown in output
2. Return COMPLETE lyrics (every verse, chorus, bridge)
3. Preserve exact formatting and line breaks
4. If not found: Return exactly "LYRICS_NOT_FOUND"
5. For Korean songs: Return original Korean, not romanized`;

  const userPrompt = `Find complete lyrics for:
Artist: ${searchArtist} (Korean: ${originalArtist})
Title: ${searchTitle} (Korean: ${originalTitle})

Use the Chain of Thought process above to find the exact lyrics.`;

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
          { role: 'user', content: fewShotExamples },
          { role: 'assistant', content: 'I understand. I will return only the exact lyrics without any additional text.' },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 4000,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Perplexity API Error:', response.status, errorData);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content || content.includes('LYRICS_NOT_FOUND') || content.length < 100) {
      return null;
    }
    
    // 응답에서 불필요한 텍스트 제거
    let cleanedLyrics = content;
    
    // 마크다운 헤더 제거
    cleanedLyrics = cleanedLyrics.replace(/^#+\s+.*$/gm, '');
    
    // "Here are the lyrics" 같은 문구 제거
    cleanedLyrics = cleanedLyrics.replace(/^.*?(here are|these are|the lyrics|가사).*?:?\s*$/gmi, '');
    
    // 앞뒤 공백 제거
    cleanedLyrics = cleanedLyrics.trim();
    
    const confidence = calculateConfidence(cleanedLyrics, originalArtist, originalTitle);
    
    if (confidence < 0.5) return null;
    
    return {
      lyrics: cleanedLyrics,
      source: 'AI-Perplexity',
      confidence,
      title: originalTitle,
      artist: originalArtist,
      autoAccepted: confidence > 0.7
    };
  } catch (error) {
    console.error('Perplexity request error:', error);
    return null;
  }
}

// GPT-4 검색 (CoT + Few-shot)
async function searchWithGPT(searchArtist: string, originalArtist: string, searchTitle: string, originalTitle: string) {
  const systemPrompt = `You are a lyrics database. Follow this EXACT Chain of Thought process:

## CHAIN OF THOUGHT (Internal Process):

1. ARTIST CHECK:
   - Is "${searchArtist}" or "${originalArtist}" in my training data?
   - Korean name mappings I know:
     * 샘킴 = Sam Kim (Korean-American R&B artist)
     * 아이유 = IU = Lee Ji-eun (이지은)
     * 방탄소년단 = BTS = Bangtan Sonyeondan
     * 블랙핑크 = BLACKPINK
     * 뉴진스 = NewJeans
     * 세븐틴 = SEVENTEEN

2. SONG CHECK:
   - Do I have "${searchTitle}" or "${originalTitle}" by this artist?
   - Common title translations:
     * 메이크업 = Make Up
     * 좋은날 = Good Day
     * 봄날 = Spring Day
     * 뚜두뚜두 = DDU-DU DDU-DU

3. DECISION:
   - If I have it: Return complete lyrics
   - If I don't: Return "LYRICS_NOT_FOUND"
   - NEVER generate or guess lyrics

## FEW-SHOT TRAINING EXAMPLES:`;

  const fewShotExamples = [
    {
      role: 'user',
      content: 'Artist: Sam Kim (샘킴)\nSong: Make Up (메이크업)'
    },
    {
      role: 'assistant',
      content: `I'm speeding to you, call me
I'm on the way 밤새 내 맘이
어디로 가는지도 모른 채
혹시 나 너무 보고 싶어서
Can we make up right now
[I would continue with complete lyrics if I had them in my training data]`
    },
    {
      role: 'user',
      content: 'Artist: IU (아이유)\nSong: Good Day (좋은날)'
    },
    {
      role: 'assistant',
      content: `어제처럼 오늘도
무거운 공기가 나를 감싸고
이유 없이 쏟아지는 빗물처럼
내 마음도 답답해
[I would continue with complete lyrics if I had them]`
    },
    {
      role: 'user',
      content: 'Artist: BTS (방탄소년단)\nSong: Spring Day (봄날)'
    },
    {
      role: 'assistant',
      content: `보고 싶다
이렇게 말하니까 더 보고 싶다
너희 사진을 보고 있어도
보고 싶다
[I would continue with complete lyrics if I had them]`
    },
    {
      role: 'user',
      content: 'Artist: FakeArtist123\nSong: MadeUpSong456'
    },
    {
      role: 'assistant',
      content: 'LYRICS_NOT_FOUND'
    },
    {
      role: 'user',
      content: 'Artist: BLACKPINK (블랙핑크)\nSong: DDU-DU DDU-DU (뚜두뚜두)'
    },
    {
      role: 'assistant',
      content: `착하게 살지 마
네 설자리 좋아
차 키 empty 하게
내 맘대로 할게
[I would continue with complete lyrics if I had them]`
    }
  ];

  const userPrompt = `Artist: ${searchArtist} (${originalArtist})
Song: ${searchTitle} (${originalTitle})

IMPORTANT: Use the Chain of Thought process. If you have the lyrics in your training data, return them COMPLETELY. If not, return "LYRICS_NOT_FOUND".`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-0125-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...fewShotExamples,
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', response.status, errorData);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content || content.includes('LYRICS_NOT_FOUND') || content.includes('찾을 수 없') || content.length < 100) {
      return null;
    }
    
    const confidence = calculateConfidence(content, originalArtist, originalTitle);
    
    if (confidence < 0.5) return null;
    
    return {
      lyrics: content.trim(),
      source: 'AI-GPT4',
      confidence,
      title: originalTitle,
      artist: originalArtist,
      autoAccepted: confidence > 0.7
    };
  } catch (error) {
    console.error('GPT-4 request error:', error);
    return null;
  }
}

// Tavily 검색 (더 정확한 쿼리)
async function searchWithTavily(searchArtist: string, originalArtist: string, searchTitle: string, originalTitle: string) {
  // 여러 검색 쿼리 시도
  const queries = [
    `"${searchArtist}" "${searchTitle}" lyrics full complete -youtube -video`,
    `${searchArtist} ${searchTitle} song lyrics text`,
    `"${originalArtist}" "${originalTitle}" 가사 전체`,
    `${searchArtist} ${searchTitle} site:genius.com`,
    `${searchArtist} ${searchTitle} site:azlyrics.com`
  ];
  
  for (const query of queries) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: query,
          search_depth: 'advanced',
          include_domains: [
            'genius.com',
            'azlyrics.com',
            'lyrics.com',
            'songlyrics.com',
            'metrolyrics.com',
            'musixmatch.com',
            'lyricsmode.com'
          ],
          max_results: 5,
          include_raw_content: true
        })
      });

      if (!response.ok) continue;

      const data = await response.json();
      
      if (!data.results || data.results.length === 0) continue;
      
      // 각 결과를 분석하여 가장 관련성 높은 것 찾기
      for (const result of data.results) {
        const content = result.raw_content || result.content;
        if (!content) continue;
        
        // 가사 추출 시도
        const lyrics = extractLyricsFromContent(content, searchTitle);
        
        if (lyrics && lyrics.length > 200) {
          const confidence = calculateConfidence(lyrics, originalArtist, originalTitle);
          
          if (confidence > 0.4) {
            return {
              lyrics,
              source: 'AI-Tavily',
              confidence,
              title: originalTitle,
              artist: originalArtist,
              autoAccepted: confidence > 0.6
            };
          }
        }
      }
    } catch (error) {
      console.error('Tavily error for query:', query, error);
    }
  }
  
  return null;
}

// 가사 추출 개선
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
  
  // 줄바꿈 정리
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // 가사 섹션 찾기 (연속된 줄이 많은 부분)
  const lines = cleaned.split('\n');
  const lyricsSections = [];
  let currentSection = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 불필요한 줄 스킵
    if (trimmed.length === 0 ||
        trimmed.startsWith('http') ||
        trimmed.includes('cookie') ||
        trimmed.includes('privacy') ||
        trimmed.includes('copyright') ||
        trimmed.includes('©') ||
        trimmed.includes('advertisement') ||
        trimmed.length > 200) {
      if (currentSection.length > 4) {
        lyricsSections.push(currentSection.join('\n'));
        currentSection = [];
      }
      continue;
    }
    
    currentSection.push(trimmed);
  }
  
  if (currentSection.length > 4) {
    lyricsSections.push(currentSection.join('\n'));
  }
  
  // 가장 긴 섹션이 가사일 가능성이 높음
  const longestSection = lyricsSections.reduce((a, b) => 
    a.length > b.length ? a : b, ''
  );
  
  return longestSection;
}

// 신뢰도 계산 개선
function calculateConfidence(lyrics: string, artist: string, title: string): number {
  if (!lyrics) return 0;
  
  let score = 0;
  const factors = [];
  
  // 1. 길이 체크 (더 세밀하게)
  const length = lyrics.length;
  if (length > 500 && length < 4000) {
    score += 0.25;
    factors.push('good_length');
  } else if (length > 200 && length < 5000) {
    score += 0.15;
    factors.push('acceptable_length');
  } else {
    factors.push('bad_length');
  }
  
  // 2. 줄 수 체크
  const lines = lyrics.split('\n').filter(l => l.trim().length > 0);
  const lineCount = lines.length;
  if (lineCount > 15 && lineCount < 80) {
    score += 0.2;
    factors.push('good_line_count');
  } else if (lineCount > 8) {
    score += 0.1;
    factors.push('acceptable_line_count');
  }
  
  // 3. 언어 매칭
  const isKoreanArtist = /[가-힣]/.test(artist);
  const hasKoreanLyrics = /[가-힣]/.test(lyrics);
  const hasEnglishLyrics = /[a-zA-Z]/.test(lyrics);
  
  if (isKoreanArtist) {
    // 샘킴 같은 경우 영어 가사도 많음
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
  
  // 4. 제목 포함 여부
  const titleLower = title.toLowerCase();
  const lyricsLower = lyrics.toLowerCase();
  
  // 제목의 주요 단어들이 가사에 있는지 체크
  const titleWords = titleLower.split(/\s+/).filter(w => w.length > 2);
  const matchedWords = titleWords.filter(word => lyricsLower.includes(word));
  
  if (matchedWords.length > 0) {
    score += Math.min(0.2, matchedWords.length * 0.1);
    factors.push('title_match');
  }
  
  // 5. 반복 패턴 (후렴구)
  const hasRepeatingLines = lines.some((line, idx) => {
    if (line.length < 5) return false;
    const repeats = lines.filter(l => l === line).length;
    return repeats > 1;
  });
  
  if (hasRepeatingLines) {
    score += 0.15;
    factors.push('has_chorus');
  }
  
  // 6. 구조 체크 (verse, chorus 등의 패턴)
  const hasStructure = /(\[.*?\]|\(.*?\)|Verse|Chorus|Bridge|Hook|Pre-Chorus)/i.test(lyrics) ||
                      /(\d절|후렴|브릿지)/i.test(lyrics);
  
  if (hasStructure) {
    score += 0.1;
    factors.push('has_structure');
  }
  
  console.log(`Confidence calculation for ${artist} - ${title}:`, {
    score: Math.min(score, 1.0),
    factors
  });
  
  return Math.min(score, 1.0);
}

// 캐시 확인
async function checkCache(artist: string, title: string) {
  try {
    const { data } = await supabase
      .from('ai_lyrics_cache')
      .select('*')
      .eq('artist', artist)
      .eq('title', title)
      .single();
    
    if (data && new Date(data.expires_at) > new Date()) {
      // 히트 카운트 증가
      await supabase
        .from('ai_lyrics_cache')
        .update({ hit_count: (data.hit_count || 0) + 1 })
        .eq('id', data.id);
      
      return {
        lyrics: data.lyrics,
        lrcFormat: data.lrc_format,
        source: `${data.source} (캐시)`,
        confidence: data.confidence,
        title: data.title,
        artist: data.artist,
        autoAccepted: true
      };
    }
  } catch (error) {
    // 캐시 미스는 정상
  }
  
  return null;
}

// 캐시 저장
async function saveToCache(result: any) {
  try {
    await supabase
      .from('ai_lyrics_cache')
      .upsert({
        artist: result.artist,
        title: result.title,
        lyrics: result.lyrics,
        lrc_format: result.lrcFormat,
        source: result.source,
        confidence: result.confidence,
        search_time: result.searchTime,
        hit_count: 0,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }, {
        onConflict: 'artist,title'
      });
  } catch (error) {
    console.error('Cache save error:', error);
  }
}