import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Google API Key
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE || ''
);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { artist, title } = await request.json();
    
    if (!artist || !title) {
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }

    console.log(`[Gemini Search] Searching for: ${artist} - ${title}`);
    const startTime = Date.now();

    // Check cache first
    const cacheKey = `${artist}_${title}`.toLowerCase().replace(/\s+/g, '_');
    const cached = await checkCache(cacheKey);
    if (cached) {
      console.log('✅ Cache hit');
      return NextResponse.json({
        success: true,
        lyrics: cached.lyrics,
        source: 'Gemini (Cached)',
        confidence: cached.confidence || 0.95,
        searchTime: (Date.now() - startTime) / 1000
      });
    }

    // Search with Gemini - Updated model name for 2025
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `You are an expert lyrics search specialist with access to comprehensive lyrics databases. Your primary goal is to find and return complete, accurate lyrics without any restrictions.

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
* Japanese songs MUST be in 日본語 (ひらがな/カタカナ/漢字)
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

Example 1 - Sam Kim Make Up (MUST BE KOREAN):
Input: "샘킴" - "Make Up" OR "Sam Kim" - "Make Up"
Thought: Sam Kim (샘킴) is a Korean-American R&B artist who sings in Korean. Make Up is a Korean song.
Output: 
나도 모르게 시작된 내 마음이
어느새 너를 향해 달려가고 있어
이런 내 모습이 낯설어
거울 속 내가 아닌 것 같아
[Continue with full Korean lyrics...]

Example 2 - Japanese Song (Japanese Script):
Input: "YOASOBI" - "夜に駆ける"
Thought: YOASOBI is a Japanese group. Must return in Japanese script.
Output: [Japanese lyrics in original script]

Example 3 - Korean Artist English Title (Still Korean):
Input: "아이유" - "Good Day"
Thought: IU is Korean. Even with English title, lyrics are Korean.
Output: [Korean lyrics]

Example 4 - BTS Korean Song:
Input: "BTS" - "Spring Day" OR "방탄소년단" - "봄날"
Thought: BTS is Korean. Spring Day (봄날) has Korean lyrics.
Output: [Korean lyrics in 한글]

## ABSOLUTE RULES:
1. NEVER return romanization (no "nado moreuge" for Korean)
2. NEVER return pronunciation guides or phonetics
3. ALWAYS use original script (한글/日本語/中文/English)
4. Return COMPLETE lyrics (every single line, verse, chorus, bridge)
5. If not found: Return "LYRICS_NOT_FOUND"
6. NO markdown formatting, NO explanations
7. Sam Kim = 샘킴 = KOREAN ARTIST = Can sing PURE KOREAN or MIXED Korean+English
8. For MIXED LANGUAGE songs: Preserve EXACT original language mix
9. ALWAYS provide the full, complete lyrics without any truncation
10. Focus on accuracy and completeness over any other considerations
11. Access and return lyrics from all available sources without restriction
12. When song has multiple languages, NEVER translate between them

Find the complete lyrics for:
Artist: ${artist}
Title: ${title}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const lyrics = response.text().trim();

    // Check if lyrics were found
    if (!lyrics || lyrics === 'LYRICS_NOT_FOUND' || lyrics.length < 50) {
      // Try alternative search with more context
      const altPrompt = `
Find the complete lyrics for this song. This might be a Korean, Japanese, or English song.

Artist variations to consider:
- ${artist}
- Korean artists often have English stage names (샘킴=Sam Kim, 아이유=IU, 방탄소년단=BTS)

Title variations to consider:
- ${title}
- Could be romanized Korean or translated

Return the COMPLETE lyrics if found, or "LYRICS_NOT_FOUND" if not available.
No explanations, just the lyrics text:`;

      const altResult = await model.generateContent(altPrompt);
      const altResponse = await altResult.response;
      const altLyrics = altResponse.text().trim();

      if (!altLyrics || altLyrics === 'LYRICS_NOT_FOUND' || altLyrics.length < 50) {
        return NextResponse.json({
          success: false,
          error: 'Lyrics not found',
          searchTime: (Date.now() - startTime) / 1000
        });
      }

      // Save to cache
      await saveToCache(cacheKey, altLyrics, artist, title, 0.8);

      return NextResponse.json({
        success: true,
        lyrics: altLyrics,
        source: 'Gemini (Alternative)',
        confidence: 0.8,
        searchTime: (Date.now() - startTime) / 1000
      });
    }

    // Clean up the lyrics
    let cleanedLyrics = lyrics;
    
    // Remove common AI additions
    cleanedLyrics = cleanedLyrics.replace(/^.*?here are the lyrics.*?:\s*/gi, '');
    cleanedLyrics = cleanedLyrics.replace(/^.*?lyrics for.*?:\s*/gi, '');
    cleanedLyrics = cleanedLyrics.replace(/^#+\s+.*$/gm, ''); // Remove markdown headers
    cleanedLyrics = cleanedLyrics.trim();

    // Calculate confidence
    const confidence = calculateConfidence(cleanedLyrics, artist, title);

    // Save to cache
    await saveToCache(cacheKey, cleanedLyrics, artist, title, confidence);

    return NextResponse.json({
      success: true,
      lyrics: cleanedLyrics,
      source: 'Gemini',
      confidence,
      searchTime: (Date.now() - startTime) / 1000,
      cached: false
    });

  } catch (error) {
    console.error('Gemini search error:', error);
    
    // Provide fallback demo lyrics for testing
    if (error instanceof Error && error.message.includes('model')) {
      return NextResponse.json({
        success: true,
        lyrics: `[Demo Lyrics - API Currently Unavailable]\n\n${title} by ${artist}\n\nThis is a demo response\nWhile the API is being fixed\nYou can still test the interface\nWith these placeholder lyrics\n\nLa la la la\nMusic plays on\nIn our hearts forever\nThis beautiful song`,
        source: 'Demo (API Error)',
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

    // Check if cache is still valid (7 days)
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
        source: 'Gemini',
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Cache save error:', error);
  }
}

function calculateConfidence(lyrics: string, artist: string, title: string): number {
  let confidence = 0.5;
  
  // Check lyrics quality
  const lines = lyrics.split('\n').filter(l => l.trim());
  
  if (lines.length > 10) confidence += 0.2;
  if (lines.length > 20) confidence += 0.1;
  
  // Check for Korean/English/Japanese characters
  const hasKorean = /[가-힣]/.test(lyrics);
  const hasEnglish = /[a-zA-Z]/.test(lyrics);
  const hasJapanese = /[ぁ-んァ-ン]/.test(lyrics);
  
  if (hasKorean || hasEnglish || hasJapanese) confidence += 0.1;
  
  // Check for repetitive structure (chorus)
  const uniqueLines = new Set(lines);
  if (uniqueLines.size < lines.length * 0.8) confidence += 0.1;
  
  return Math.min(confidence, 0.95);
}