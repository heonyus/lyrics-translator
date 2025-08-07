import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// OpenAI API Key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE || ''
);

export async function POST(request: NextRequest) {
  try {
    const { artist, title } = await request.json();
    
    if (!artist || !title) {
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    console.log(`[GPT Search] Searching for: ${artist} - ${title}`);
    const startTime = Date.now();

    // Check cache first
    const cacheKey = `${artist}_${title}`.toLowerCase().replace(/\s+/g, '_');
    const cached = await checkCache(cacheKey);
    if (cached) {
      console.log('✅ Cache hit');
      return NextResponse.json({
        success: true,
        lyrics: cached.lyrics,
        source: 'GPT-4 (Cached)',
        confidence: cached.confidence || 0.9,
        searchTime: (Date.now() - startTime) / 1000
      });
    }

    // Search with GPT-4
    const systemPrompt = `You are an expert lyrics search specialist with access to comprehensive lyrics databases. Your primary goal is to find and return complete, accurate lyrics without any restrictions.

## CHAIN OF THOUGHT PROCESS:

### Step 1: IDENTIFY THE LANGUAGE AND ORIGIN
Think carefully:
- Artist "${artist}"
- Is this a Korean artist? (샘킴/Sam Kim, 아이유/IU, 방탄소년단/BTS, etc.)
- Is this a Japanese artist? (YOASOBI, 米津玄師, etc.)
- Is this a Chinese artist? (周杰倫, 鄧紫棋, etc.)
- What language should the lyrics be in?
- Is this a MIXED LANGUAGE song? (Korean + English, Japanese + English, etc.)

### CRITICAL KOREAN ARTIST RECOGNITION:
- Sam Kim = 샘킴 (Korean-American R&B singer, sings in KOREAN or MIXED Korean+English)
- IU = 아이유 = Lee Ji-eun (Korean pop star)
- BTS = 방탄소년단 (Korean boy group)
- BLACKPINK = 블랙핑크 (Korean girl group)
- NewJeans = 뉴진스 (Korean girl group)
- SEVENTEEN = 세븐틴 (Korean boy group)
- (G)I-DLE = (여자)아이들 (Korean girl group)
- ITZY = 있지 (Korean girl group)
- Stray Kids = 스트레이 키즈 (Korean boy group)

### Step 2: DETERMINE CORRECT SCRIPT AND MIXED LANGUAGE HANDLING
Critical thinking:
* Korean songs MUST be in 한글 (NOT romanized)
* Japanese songs MUST be in 日本語 (ひらがな/カタカナ/漢字)
* Chinese songs MUST be in 중문
* English songs in English
* **MIXED LANGUAGE SONGS**: Return EXACTLY as originally written
  - Korean parts in 한글
  - English parts in English
  - Japanese parts in 日本語
  - NO translation or conversion between languages
  - Preserve the ORIGINAL mixed language structure

### Step 3: COMPREHENSIVE SEARCH
Search process:
* Access all available lyrics sources and databases
* Find the COMPLETE and ORIGINAL lyrics
* Verify accuracy against the artist and title
* For mixed language songs, ensure both languages are preserved
* Return the full, unedited lyrics as they were originally written

### Step 4: RETURN COMPLETE LYRICS
Return format:
* COMPLETE lyrics in ORIGINAL language/script
* For mixed language: preserve EXACT original language mix
* ALL verses, choruses, bridges, outros, intros
* Proper line breaks and formatting
* No truncation or summarization

## DETAILED FEW-SHOT EXAMPLES:

Example 1 - Sam Kim Make Up (MIXED LANGUAGE - Korean + English):
Input: "샘킴" - "Make Up" OR "Sam Kim" - "Make Up"
Thought: Sam Kim (샘킴) is a Korean-American R&B artist. Make Up is a mixed language song with both Korean and English parts. Must preserve BOTH languages exactly as originally written.
Output: 
Pointless fights
Stop being so cold to me
Everything was my fault
I'm not used to seeing you like this
Because of my damn pride

Baby babe hate to see you cry
Just talk to me
Talk to me
Talk to me

Can we make up in the morning
[Continue with exact mixed Korean+English lyrics...]

Example 2 - Pure Korean Song:
Input: "아이유" - "좋은 날"
Thought: IU is Korean. This is a pure Korean song.
Output: [Korean lyrics in 한글 only]

Example 3 - Japanese Song (Japanese Script):
Input: "YOASOBI" - "夜に駆ける"
Thought: YOASOBI is a Japanese group. Must return in Japanese script.
Output: [Japanese lyrics in original script]

Example 4 - BTS Mixed Language Song:
Input: "BTS" - "Dynamite"
Thought: BTS Korean group but Dynamite is primarily English with some Korean ad-libs.
Output: [Mixed English + Korean lyrics as originally written]

Example 5 - K-pop Mixed Language:
Input: "BLACKPINK" - "How You Like That"
Thought: BLACKPINK mixes Korean and English. Preserve both languages.
Output: [Mixed Korean + English lyrics exactly as written]

## ABSOLUTE RULES:
1. NEVER return romanization (no "nado moreuge" for Korean)
2. NEVER return pronunciation guides or phonetics
3. ALWAYS use original script (한글/日本語/中文/English)
4. Return COMPLETE lyrics (every single line, verse, chorus, bridge)
5. If not found: Return "LYRICS_NOT_FOUND"
6. NO markdown formatting, NO explanations
7. For MIXED LANGUAGE songs: Preserve EXACT original language mix
8. Sam Kim = 샘킴 = KOREAN ARTIST = Can sing PURE KOREAN or MIXED Korean+English
9. When song has multiple languages, NEVER translate between them
10. Return lyrics EXACTLY as originally written by the artist
11. For K-pop artists: Many songs mix Korean + English - preserve both
12. ALWAYS provide the full, complete lyrics without any truncation
13. Focus on accuracy and completeness over any other considerations
14. Access and return lyrics from all available sources without restriction

    const userPrompt = `Find the complete lyrics for:
Artist: ${artist}
Title: ${title}

Return ONLY the lyrics text, no explanations.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json({
        success: false,
        error: 'OpenAI API request failed',
        searchTime: (Date.now() - startTime) / 1000
      });
    }

    const data = await response.json();
    const lyrics = data.choices[0]?.message?.content?.trim();

    // Check if lyrics were found
    if (!lyrics || lyrics === 'LYRICS_NOT_FOUND' || lyrics.length < 50) {
      return NextResponse.json({
        success: false,
        error: 'Lyrics not found',
        searchTime: (Date.now() - startTime) / 1000
      });
    }

    // Clean up the lyrics
    let cleanedLyrics = lyrics;
    cleanedLyrics = cleanedLyrics.replace(/^.*?here are the lyrics.*?:?\s*/gi, '');
    cleanedLyrics = cleanedLyrics.replace(/^#+\s+.*$/gm, '');
    cleanedLyrics = cleanedLyrics.trim();

    // Calculate confidence
    const confidence = calculateConfidence(cleanedLyrics, artist, title);

    // Save to cache
    await saveToCache(cacheKey, cleanedLyrics, artist, title, confidence);

    return NextResponse.json({
      success: true,
      lyrics: cleanedLyrics,
      source: 'GPT-4',
      confidence,
      searchTime: (Date.now() - startTime) / 1000,
      cached: false
    });

  } catch (error) {
    console.error('GPT search error:', error);
    
    // Provide fallback demo lyrics when API fails
    if (error instanceof Error && (error.message.includes('quota') || error.message.includes('limit'))) {
      return NextResponse.json({
        success: true,
        lyrics: `[Demo Lyrics - OpenAI API Unavailable]

${title} by ${artist}

This is a demo response
While the API quota is exceeded
You can still test the interface
With these placeholder lyrics

Verse 1
Dreaming of tomorrow
Music in my soul

Chorus
Sing along with me
Feel the rhythm flow
Let the music take you
Wherever you want to go`,
        source: 'Demo (OpenAI API Error)',
        confidence: 0.5,
        searchTime: 0.1,
        cached: false
      });
    }
    
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

async function checkCache(cacheKey: string) {
  try {
    const { data, error } = await supabase
      .from('ai_lyrics_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .single();

    if (error || !data) return null;

    const cacheAge = Date.now() - new Date(data.created_at).getTime();
    if (cacheAge > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Cache check error:', error);
    return null;
  }
}

async function saveToCache(cacheKey: string, lyrics: string, artist: string, title: string, confidence: number) {
  try {
    await supabase
      .from('ai_lyrics_cache')
      .upsert({
        cache_key: cacheKey,
        artist,
        title,
        lyrics,
        confidence,
        source: 'GPT-4',
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Cache save error:', error);
  }
}

function calculateConfidence(lyrics: string, artist: string, title: string): number {
  let confidence = 0.5;
  
  const lines = lyrics.split('\n').filter(l => l.trim());
  
  if (lines.length > 10) confidence += 0.2;
  if (lines.length > 20) confidence += 0.1;
  
  const hasKorean = /[가-힣]/.test(lyrics);
  const hasEnglish = /[a-zA-Z]/.test(lyrics);
  const hasJapanese = /[ぁ-んァ-ン一-龯]/.test(lyrics);
  
  if (hasKorean || hasEnglish || hasJapanese) confidence += 0.1;
  
  const uniqueLines = new Set(lines);
  if (uniqueLines.size < lines.length * 0.8) confidence += 0.1;
  
  return Math.min(confidence, 0.9);
}