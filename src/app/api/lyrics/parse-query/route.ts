import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

interface ParsedQuery {
  artist: string | null;
  title: string | null;
  language?: string;
  year?: number | null;
  album?: string | null;
  original_query: string;
  confidence: number;
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query string is required' },
        { status: 400 }
      );
    }
    
    logger.info(`🧠 Parsing query with Groq: "${query}"`);
    
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      logger.warning('Groq API key not found, using fallback parser');
      return NextResponse.json({
        success: true,
        parsed: fallbackParser(query)
      });
    }
    
    // Groq API로 자연어 쿼리 파싱
    const systemPrompt = `You are a music query parser. Extract artist name and song title from user queries.
Handle various formats and languages (Korean, English, Japanese, Chinese).

Rules:
1. Return JSON only, no explanations
2. Handle typos and spacing issues
3. Recognize artist/title in any order
4. Extract year/album if mentioned
5. Detect primary language of the song
6. Handle mixed languages (e.g., "BTS 다이너마이트", "아이유 Good Day")
7. Common patterns:
   - "ARTIST TITLE"
   - "TITLE by ARTIST"
   - "ARTIST의 TITLE"
   - "TITLE ARTIST"
   - Natural language: "아이유가 부른 좋은날"

Return format:
{
  "artist": "extracted artist name",
  "title": "extracted song title",
  "language": "ko/en/ja/zh/unknown",
  "year": null or year if mentioned,
  "album": null or album name if mentioned,
  "confidence": 0.0-1.0
}`;
    
    const userPrompt = `Parse this music query: "${query}"
    
Examples:
- "아이유 좋은날" → {"artist": "아이유", "title": "좋은날", "language": "ko"}
- "샘킴 makeup" → {"artist": "샘킴", "title": "Makeup", "language": "ko"}
- "november rain by jannabi" → {"artist": "JANNABI", "title": "November Rain", "language": "ko"}
- "BTS dynamite" → {"artist": "BTS", "title": "Dynamite", "language": "en"}
- "잔나비의 노래 중에 11월 비" → {"artist": "잔나비", "title": "November Rain", "language": "ko"}
- "좋은날 아이유 2010년" → {"artist": "아이유", "title": "좋은날", "language": "ko", "year": 2010}`;
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      logger.error('Groq API error', `Status: ${response.status}`);
      return NextResponse.json({
        success: true,
        parsed: fallbackParser(query)
      });
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      logger.warning('Empty response from Groq, using fallback');
      return NextResponse.json({
        success: true,
        parsed: fallbackParser(query)
      });
    }
    
    try {
      const parsed = JSON.parse(content) as ParsedQuery;
      
      // Validation and normalization
      if (!parsed.artist && !parsed.title) {
        logger.warning('Groq parsing failed to extract artist/title, using fallback');
        return NextResponse.json({
          success: true,
          parsed: fallbackParser(query)
        });
      }
      
      // Add original query
      parsed.original_query = query;
      
      // Ensure confidence is set
      if (typeof parsed.confidence !== 'number') {
        parsed.confidence = 0.8; // Default confidence for Groq parsing
      }
      
      logger.success(`✨ Parsed: Artist="${parsed.artist}", Title="${parsed.title}", Lang=${parsed.language}`);
      
      return NextResponse.json({
        success: true,
        parsed,
        source: 'groq'
      });
      
    } catch (parseError) {
      logger.error('JSON parse error', parseError);
      return NextResponse.json({
        success: true,
        parsed: fallbackParser(query)
      });
    }
    
  } catch (error) {
    logger.error('Query parsing error', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to parse query',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Fallback parser for when Groq is unavailable
function fallbackParser(query: string): ParsedQuery {
  logger.info('Using fallback parser');
  
  // Remove extra spaces and normalize
  const normalized = query.trim().replace(/\s+/g, ' ');
  
  // Try common patterns
  let artist: string | null = null;
  let title: string | null = null;
  
  // Pattern 1: "ARTIST - TITLE" or "ARTIST – TITLE"
  const dashPattern = /^(.+?)\s*[-–]\s*(.+)$/;
  const dashMatch = normalized.match(dashPattern);
  
  if (dashMatch) {
    artist = dashMatch[1].trim();
    title = dashMatch[2].trim();
    
    // Check if it's duplicated format "ARTIST TITLE - ARTIST TITLE"
    if (artist === title || `${artist} ${title}`.includes(artist + ' ' + artist)) {
      // It's likely just "ARTIST TITLE" duplicated
      const parts = artist.split(' ');
      if (parts.length >= 2) {
        artist = parts[0];
        title = parts.slice(1).join(' ');
      }
    }
  } else {
    // Pattern 2: Try to split by space (assume first word is artist)
    const parts = normalized.split(' ');
    
    // Check for "by" pattern
    const byIndex = parts.findIndex(p => p.toLowerCase() === 'by');
    if (byIndex > 0 && byIndex < parts.length - 1) {
      title = parts.slice(0, byIndex).join(' ');
      artist = parts.slice(byIndex + 1).join(' ');
    } else if (parts.length >= 2) {
      // Assume first part is artist
      artist = parts[0];
      title = parts.slice(1).join(' ');
    } else {
      // Single word query - use as both
      artist = normalized;
      title = normalized;
    }
  }
  
  // Detect language
  const language = detectLanguage(normalized);
  
  return {
    artist,
    title,
    language,
    year: null,
    album: null,
    original_query: query,
    confidence: 0.5 // Lower confidence for fallback
  };
}

// Language detection
function detectLanguage(text: string): string {
  if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text)) return 'ko';
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return 'ja';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  if (/[a-zA-Z]/.test(text)) return 'en';
  return 'unknown';
}