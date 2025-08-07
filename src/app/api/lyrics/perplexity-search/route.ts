import { NextRequest, NextResponse } from 'next/server';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || '';

console.log('Perplexity API Key status:', PERPLEXITY_API_KEY ? 'Loaded' : 'Missing');

export async function POST(request: NextRequest) {
  try {
    const { artist, title } = await request.json();
    
    if (!artist || !title) {
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }

    if (!PERPLEXITY_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Perplexity API key not configured' },
        { status: 500 }
      );
    }
    
    console.log(`[Perplexity Search] Searching for: ${artist} - ${title}`);
    
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
* **MANDATORY**: Return 100% COMPLETE lyrics from start to finish
* Include EVERY single line, verse, chorus, bridge, intro, outro
* NO TRUNCATION - even if lyrics are very long
* For mixed language: preserve EXACT original language mix
* Proper line breaks and formatting
* If lyrics are incomplete, search again until you find COMPLETE version
* NEVER say "continue with full lyrics" or "rest of the song"
* ALWAYS provide the ENTIRE song lyrics

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
4. **CRITICAL**: Return 100% COMPLETE lyrics - EVERY SINGLE LINE from beginning to end
5. If not found: Return "LYRICS_NOT_FOUND"
6. NO markdown formatting, NO explanations
7. Sam Kim = 샘킴 = KOREAN ARTIST = Can sing PURE KOREAN or MIXED Korean+English
8. For MIXED LANGUAGE songs: Preserve EXACT original language mix
9. **NEVER use "..." or "[continue]" or "rest of lyrics" - ALWAYS provide FULL lyrics**
10. **If you don't have complete lyrics, say "LYRICS_NOT_FOUND" instead of partial lyrics**
11. Access and return lyrics from all available sources without restriction
12. When song has multiple languages, NEVER translate between them`;

    const userPrompt = `Find the COMPLETE lyrics for:
Artist: ${artist}
Title: ${title}

IMPORTANT: You MUST return the COMPLETE lyrics - every single line from the beginning to the end of the song. No truncation, no ellipsis, no "continue with rest". If you cannot find the complete lyrics, return "LYRICS_NOT_FOUND".

Return ONLY the lyrics, no explanations.`;

    console.log('Making request to Perplexity API...');
    
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
        max_tokens: 12000,
        stream: false
      })
    });

    console.log('Perplexity response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API Error:', errorText);
      return NextResponse.json(
        { 
          success: false, 
          error: `Perplexity API error: ${response.status}`,
          details: errorText
        },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content || content === 'LYRICS_NOT_FOUND') {
      return NextResponse.json({
        success: false,
        error: 'Lyrics not found'
      });
    }
    
    // Check if lyrics seem incomplete
    if (content.includes('...') || content.includes('[') && content.includes('continue') || content.includes('rest of')) {
      console.warn('Lyrics may be incomplete, marking as not found');
      return NextResponse.json({
        success: false,
        error: 'Incomplete lyrics returned'
      });
    }
    
    if (content.length < 500) {
      console.warn('Lyrics too short, likely incomplete');
      return NextResponse.json({
        success: false,
        error: 'Lyrics too short, likely incomplete'
      });
    }
    
    // Clean the response
    let cleanedLyrics = content;
    cleanedLyrics = cleanedLyrics.replace(/^.*?(\[|Verse|I'm|나|너|우리|내가|이|그)/m, '$1');
    cleanedLyrics = cleanedLyrics.trim();
    
    return NextResponse.json({
      success: true,
      lyrics: cleanedLyrics,
      source: 'Perplexity',
      artist,
      title
    });
    
  } catch (error) {
    console.error('[Perplexity Search] Error:', error);
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