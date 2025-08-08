import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';

// Parse with Groq (fastest)
async function parseWithGroq(query: string): Promise<any | null> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  
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
            content: `You are a music query parser. Parse the user's search query and extract the artist and song title.
            
Examples:
- "백예린 스퀘어" → {"artist": "백예린", "title": "스퀘어"}
- "스퀘어 백예린" → {"artist": "백예린", "title": "스퀘어"}  
- "Square by Yerin Baek" → {"artist": "Yerin Baek", "title": "Square"}
- "백예린의 Square" → {"artist": "백예린", "title": "Square"}
- "아이유 좋은날" → {"artist": "아이유", "title": "좋은날"}
- "Blueming IU" → {"artist": "IU", "title": "Blueming"}

Return ONLY JSON with artist and title fields. Keep original language.`
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
  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  
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
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
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