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
        timer.success(`Found lyrics (${parsed.lyrics.length} chars)`);
        return parsed;
      }
    } catch (e) {
      // Try to extract lyrics from text
      if (content.includes(title) || content.includes(artist)) {
        timer.success('Found lyrics in text format');
        return {
          artist,
          title,
          lyrics: content,
          language: 'unknown',
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
            content: 'Find complete song lyrics. Return JSON with artist, title, lyrics, language, hasLyrics fields.'
          },
          {
            role: 'user',
            content: `Find lyrics for "${title}" by "${artist}"`
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
      timer.success(`Found lyrics (${parsed.lyrics.length} chars)`);
      return parsed;
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
            content: 'Find complete song lyrics. Return JSON with artist, title, lyrics, language, hasLyrics fields.'
          },
          {
            role: 'user',
            content: `Find the complete lyrics for "${title}" by "${artist}"`
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
      timer.success(`Found lyrics (${parsed.lyrics.length} chars)`);
      return parsed;
    }
    
    timer.fail('No lyrics found');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export async function llmSearch({ artist, title }: { artist: string; title: string }) {
  logger.info(`🤖 LLM Search: ${artist} - ${title}`);
  
  // Try all LLMs in parallel
  const results = await Promise.allSettled([
    searchWithGroq(artist, title),
    searchWithGPT(artist, title),
    searchWithClaude(artist, title)
  ]);
  
  // Find best result
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      return {
        success: true,
        result: {
          ...result.value,
          source: 'llm-search',
          confidence: 0.8
        }
      };
    }
  }
  
  return {
    success: false,
    message: 'No lyrics found from LLM search'
  };
}