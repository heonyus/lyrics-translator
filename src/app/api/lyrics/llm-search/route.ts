import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';

// Search with Claude
async function searchWithClaude(artist: string, title: string): Promise<any | null> {
  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  
  if (!CLAUDE_API_KEY) {
    return null;
  }
  
  const timer = new APITimer('Claude Search');
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `Find the complete lyrics for "${title}" by "${artist}".

Return the response in this JSON format:
{
  "artist": "${artist}",
  "title": "${title}",
  "lyrics": "complete lyrics with \\n for line breaks",
  "language": "ko/en/ja/etc",
  "hasLyrics": true/false
}

If you cannot find the lyrics, set hasLyrics to false.`
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
      if (parsed.hasLyrics && parsed.lyrics) {
        timer.success(`Found lyrics: ${parsed.lyrics.length} chars`);
        return {
          ...parsed,
          source: 'claude',
          confidence: 0.85
        };
      }
    } catch (e) {
      // Try to extract lyrics from plain text
      if (content.length > 500 && content.includes('\n')) {
        timer.success('Found lyrics (plain text)');
        return {
          artist,
          title,
          lyrics: content,
          source: 'claude',
          confidence: 0.7
        };
      }
    }
    
    timer.fail('No lyrics found');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Search with GPT
async function searchWithGPT(artist: string, title: string): Promise<any | null> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    return null;
  }
  
  const timer = new APITimer('GPT Search');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a lyrics finder. Return complete song lyrics in JSON format.'
          },
          {
            role: 'user',
            content: `Find complete lyrics for "${title}" by "${artist}".
            
Return JSON:
{
  "artist": "${artist}",
  "title": "${title}",
  "lyrics": "complete lyrics with \\n for line breaks",
  "language": "ko/en/ja/etc",
  "hasLyrics": true/false
}`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    
    if (parsed.hasLyrics && parsed.lyrics) {
      timer.success(`Found lyrics: ${parsed.lyrics.length} chars`);
      return {
        ...parsed,
        source: 'gpt',
        confidence: 0.9
      };
    }
    
    timer.fail('No lyrics found');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Search with Groq
async function searchWithGroq(artist: string, title: string): Promise<any | null> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  
  if (!GROQ_API_KEY) {
    return null;
  }
  
  const timer = new APITimer('Groq Search');
  
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
            content: `You are a lyrics database. Return complete song lyrics in JSON format.
            
IMPORTANT: If you know the lyrics, return them. If not, set hasLyrics to false.`
          },
          {
            role: 'user',
            content: `Find the complete lyrics for "${title}" by "${artist}".

Return JSON:
{
  "artist": "${artist}",
  "title": "${title}",
  "lyrics": "complete lyrics with \\n for line breaks",
  "language": "ko/en/ja/etc",
  "hasLyrics": true/false
}`
          }
        ],
        temperature: 0.1,
        max_tokens: 8000,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    
    if (parsed.hasLyrics && parsed.lyrics) {
      timer.success(`Found lyrics: ${parsed.lyrics.length} chars`);
      return {
        ...parsed,
        source: 'groq',
        confidence: 0.85
      };
    }
    
    timer.fail('No lyrics found');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Search with Perplexity
async function searchWithPerplexity(artist: string, title: string): Promise<any | null> {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  
  if (!PERPLEXITY_API_KEY) {
    return null;
  }
  
  const timer = new APITimer('Perplexity Search');
  
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
          {
            role: 'system',
            content: 'Search for complete song lyrics and return them in a structured format.'
          },
          {
            role: 'user',
            content: `Find the complete lyrics for the song "${title}" by "${artist}". Return the full lyrics with line breaks.`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Try to extract lyrics from the response
    if (content.length > 500) {
      // Clean up the content
      let lyrics = content
        .replace(/^.*?(?:lyrics|가사)[:：\s]*/i, '')
        .replace(/\[.*?\]/g, '') // Remove annotations
        .trim();
      
      if (lyrics.length > 200) {
        timer.success(`Found lyrics: ${lyrics.length} chars`);
        return {
          artist,
          title,
          lyrics,
          source: 'perplexity',
          confidence: 0.8,
          hasLyrics: true
        };
      }
    }
    
    timer.fail('No lyrics found');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Main handler
export async function POST(request: NextRequest) {
  const timer = new APITimer('LLM Search');
  
  try {
    const { artist, title } = await request.json();
    
    if (!artist || !title) {
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }
    
    logger.search(`🤖 LLM Search: "${artist} - ${title}"`);
    
    // Search with all LLMs in parallel
    const searches = [
      searchWithClaude(artist, title),
      searchWithGPT(artist, title),
      searchWithGroq(artist, title),
      searchWithPerplexity(artist, title)
    ];
    
    const results = await Promise.allSettled(searches);
    
    // Collect successful results
    const validResults = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<any>).value)
      .filter(r => r.lyrics && r.lyrics.length > 100);
    
    if (validResults.length === 0) {
      timer.fail('No results from any LLM');
      return NextResponse.json({
        success: false,
        error: 'Could not find lyrics from any LLM'
      });
    }
    
    // Sort by confidence and length
    validResults.sort((a, b) => {
      const confDiff = (b.confidence || 0) - (a.confidence || 0);
      if (Math.abs(confDiff) > 0.1) return confDiff;
      return b.lyrics.length - a.lyrics.length;
    });
    
    timer.success(`Found ${validResults.length} results`);
    
    // Add metadata to results
    const enrichedResults = validResults.map(result => ({
      ...result,
      artist: result.artist || artist,
      title: result.title || title,
      searchTime: Date.now() - timer['startTime'],
      hasTimestamps: false
    }));
    
    return NextResponse.json({
      success: true,
      results: enrichedResults,
      bestResult: enrichedResults[0],
      searchTime: Date.now() - timer['startTime']
    });
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('LLM Search error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'LLM search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}