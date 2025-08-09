import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';

let GROQ_API_KEY: string | undefined;
let CLAUDE_API_KEY: string | undefined;
let OPENAI_API_KEY: string | undefined;

async function loadKeys() {
  if (typeof window !== 'undefined') return;
  const { getSecret } = await import('@/lib/secure-secrets');
  GROQ_API_KEY = (await getSecret('groq')) || process.env.GROQ_API_KEY;
  CLAUDE_API_KEY = (await getSecret('claude')) || process.env.CLAUDE_API_KEY;
  OPENAI_API_KEY = (await getSecret('openai')) || process.env.OPENAI_API_KEY;
}

// Parse with Groq (fastest)
async function parseWithGroq(query: string): Promise<any | null> {
  await loadKeys();
  
  if (!GROQ_API_KEY) {
    return null;
  }
  
  const timer = new APITimer('Groq Parse');
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an expert music query parser with extensive knowledge of global music artists.

## MUSIC DOMAIN CONTEXT:
- In Korean/Asian music searches, users type: [ARTIST_NAME] [SONG_TITLE]
- Korean artist names are typically 2-4 characters
- The FIRST word is usually the artist name
- Spaces are SEPARATORS, not grammatical particles

## YOUR MUSIC KNOWLEDGE:
- "아이유" (IU) - Famous Korean solo artist
- "폴킴" (Paul Kim) - Korean R&B singer
- "백예린" (Yerin Baek) - Korean indie artist
- "악동뮤지션" (AKMU) - Korean duo
- BTS, BLACKPINK - K-pop groups

## CHAIN OF THOUGHT (internal process, don't output):
1. Check if first word matches known artist from your training
2. If yes, first word = artist, rest = title
3. If unclear, check common patterns
4. Verify: Is the parsed artist likely an artist name?
5. Return clean JSON

## FEW-SHOT EXAMPLES:

Korean patterns (from your knowledge):
- "아이유 복숭아" → {"artist": "아이유", "title": "복숭아"} // IU is a known artist
- "폴킴 비" → {"artist": "폴킴", "title": "비"} // Paul Kim is a known artist
- "폴킴 커피한잔할래요" → {"artist": "폴킴", "title": "커피한잔할래요"}
- "백예린 스퀘어" → {"artist": "백예린", "title": "스퀘어"}
- "아이유 좋은날" → {"artist": "아이유", "title": "좋은날"}
- "악동뮤지션 오랜날오랜밤" → {"artist": "악동뮤지션", "title": "오랜날오랜밤"}
- "스퀘어 백예린" → {"artist": "백예린", "title": "스퀘어"}  
- "아이유의 좋은날" → {"artist": "아이유", "title": "좋은날"}
- "너의 의미 아이유" → {"artist": "아이유", "title": "너의 의미"}
- "BTS 의 Dynamite" → {"artist": "BTS", "title": "Dynamite"}

English patterns:
- "Ed Sheeran - Perfect" → {"artist": "Ed Sheeran", "title": "Perfect"}
- "Perfect by Ed Sheeran" → {"artist": "Ed Sheeran", "title": "Perfect"}
- "Taylor Swift Blank Space" → {"artist": "Taylor Swift", "title": "Blank Space"}

Japanese patterns:
- "米津玄師 Lemon" → {"artist": "米津玄師", "title": "Lemon"}
- "YOASOBI 夜に駆ける" → {"artist": "YOASOBI", "title": "夜に駆ける"}

Single word/unclear:
- "Yesterday" → {"artist": null, "title": "Yesterday"}
- "봄날" → {"artist": null, "title": "봄날"}

## RULES:
- Return ONLY JSON format
- Use null if artist cannot be determined
- Keep original language/capitalization
- No explanations or additional text`
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    
    if (parsed.artist && parsed.title) {
      timer.success(`Parsed: ${parsed.artist} - ${parsed.title}`);
      return parsed;
    }
    
    timer.fail('Invalid parse result');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Parse with Claude (backup)
async function parseWithClaude(query: string): Promise<any | null> {
  await loadKeys();
  
  if (!CLAUDE_API_KEY) {
    return null;
  }
  
  const timer = new APITimer('Claude Parse');
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Parse this music search query and extract artist and title: "${query}"
            
Return JSON: {"artist": "...", "title": "..."}`
          }
        ]
      })
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    
    try {
      const parsed = JSON.parse(content);
      if (parsed.artist && parsed.title) {
        timer.success(`Parsed: ${parsed.artist} - ${parsed.title}`);
        return parsed;
      }
    } catch (e) {
      // Try to extract from text
      const artistMatch = content.match(/artist["\s:]+([^",}]+)/i);
      const titleMatch = content.match(/title["\s:]+([^",}]+)/i);
      
      if (artistMatch && titleMatch) {
        const result = {
          artist: artistMatch[1].trim(),
          title: titleMatch[1].trim()
        };
        timer.success(`Parsed: ${result.artist} - ${result.title}`);
        return result;
      }
    }
    
    timer.fail('Could not parse');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Parse with GPT (backup)
async function parseWithGPT(query: string): Promise<any | null> {
  await loadKeys();
  
  if (!OPENAI_API_KEY) {
    return null;
  }
  
  const timer = new APITimer('GPT Parse');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5',
        messages: [
          {
            role: 'system',
            content: 'Parse music search queries. Return JSON: {"artist": "...", "title": "..."}'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    
    if (parsed.artist && parsed.title) {
      timer.success(`Parsed: ${parsed.artist} - ${parsed.title}`);
      return parsed;
    }
    
    timer.fail('Invalid parse result');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Fallback simple parser
function simpleParser(query: string): any {
  // Remove extra spaces
  query = query.trim().replace(/\s+/g, ' ');
  
  // Check for Korean artist name patterns (2-4 chars Korean name + title)
  const koreanArtistPattern = /^([가-힣]{2,4})\s+(.+)$/;
  const koreanMatch = query.match(koreanArtistPattern);
  if (koreanMatch) {
    // Common Korean artist names
    const knownArtists = ['폴킴', '아이유', '백예린', '이무진', '멜로망스', '악동뮤지션', '박효신', '임영웅', '이소라', '윤하'];
    if (knownArtists.includes(koreanMatch[1])) {
      return { artist: koreanMatch[1], title: koreanMatch[2].trim() };
    }
  }
  
  // Common patterns
  const patterns = [
    // "artist - title" or "artist – title"
    /^(.+?)\s*[-–]\s*(.+)$/,
    // "title by artist"
    /^(.+?)\s+by\s+(.+)$/i,
    // "artist의 title" (Korean possessive)
    /^(.+?)의\s+(.+)$/,
    // Two words (assume first is artist)
    /^(\S+)\s+(.+)$/
  ];
  
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) {
      if (pattern.toString().includes('by')) {
        // "title by artist" pattern
        return { artist: match[2].trim(), title: match[1].trim() };
      }
      return { artist: match[1].trim(), title: match[2].trim() };
    }
  }
  
  // Single word - use as both
  return { artist: query, title: query };
}

// Main handler
export async function POST(request: NextRequest) {
  const timer = new APITimer('Parse Query');
  
  try {
    const { query } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }
    
    logger.info(`🔍 Parsing query: "${query}"`);
    
    // Try LLM parsers in order of speed/cost
    let parsed = await parseWithGroq(query);
    let source = 'groq';
    
    if (!parsed) {
      parsed = await parseWithGPT(query);
      source = 'gpt';
    }
    
    if (!parsed) {
      parsed = await parseWithClaude(query);
      source = 'claude';
    }
    
    if (!parsed) {
      parsed = simpleParser(query);
      source = 'simple';
      logger.warning('Using simple parser as fallback');
    }
    
    timer.success(`Parsed with ${source}: ${parsed.artist} - ${parsed.title}`);
    
    return NextResponse.json({
      success: true,
      parsed,
      source,
      original: query
    });
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Parse Query error:', error);
    
    // Fallback to simple parser on error
    const query = (await request.json()).query || '';
    const parsed = simpleParser(query);
    
    return NextResponse.json({
      success: true,
      parsed,
      source: 'simple-fallback',
      original: query
    });
  }
}