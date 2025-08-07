import { logger, APITimer } from '@/lib/logger';

// Search with Claude
async function searchWithClaude(artist: string, title: string): Promise<any | null> {
  const { getSecret } = await import('@/lib/secure-secrets');
  const CLAUDE_API_KEY = (await getSecret('anthropic')) || process.env.CLAUDE_API_KEY;
  
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
        model: process.env.CLAUDE_MODEL || 'claude-opus-4.1',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Find the complete lyrics for "${title}" by "${artist}".\n\nReturn the response in this JSON format:\n{\n  "artist": "${artist}",\n  "title": "${title}",\n  "lyrics": "complete lyrics with \\n for line breaks",\n  "language": "ko/en/ja/etc",\n  "hasLyrics": true/false\n}\n\nIf you cannot find the lyrics, set hasLyrics to false.`
              }
            ]
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
  const { getSecret } = await import('@/lib/secure-secrets');
  const OPENAI_API_KEY = (await getSecret('openai')) || process.env.OPENAI_API_KEY;
  
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
        model: process.env.OPENAI_MODEL || 'gpt-5',
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
      // fallback model backoff
      if (response.status === 429 || response.status === 400) {
        await new Promise(r => setTimeout(r, 600));
        const retry = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL_FALLBACK || 'gpt-4.1',
            messages: [
              { role: 'system', content: 'Find complete song lyrics. Return strict JSON.' },
              { role: 'user', content: `Find lyrics for "${title}" by "${artist}"` }
            ],
            temperature: 0.1,
            max_tokens: 4000,
            response_format: { type: 'json_object' }
          })
        });
        if (!retry.ok) {
          timer.fail(`HTTP ${retry.status}`);
          return null;
        }
        const retryData = await retry.json();
        const retryParsed = JSON.parse(retryData.choices?.[0]?.message?.content || '{}');
        if (retryParsed.hasLyrics && retryParsed.lyrics) {
          timer.success(`Found lyrics (${retryParsed.lyrics.length} chars)`);
          return retryParsed;
        }
        timer.fail('No lyrics found');
        return null;
      }
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
  const { getSecret } = await import('@/lib/secure-secrets');
  const GROQ_API_KEY = (await getSecret('groq')) || process.env.GROQ_API_KEY;
  
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
  // Call providers sequentially to reduce 429 rate limits
  const providers = [searchWithGroq, searchWithGPT, searchWithClaude];
  for (const fn of providers) {
    try {
      const val = await fn(artist, title);
      if (val) {
        return {
          success: true,
          result: {
            ...val,
            source: 'llm-search',
            confidence: 0.8
          }
        };
      }
      // small jitter between calls to avoid burst
      await new Promise(r => setTimeout(r, 150 + Math.floor(Math.random() * 200)));
    } catch {
      // continue to next provider
    }
  }

  return {
    success: false,
    message: 'No lyrics found from LLM search'
  };
}