import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';
import { scoreLyrics, normalizeLyrics, detectDominantLang } from '../quality';

function validateLyricsText(text: string): boolean {
  if (!text) return false;
  const lines = text.split('\n').map(l => l.trim());
  // 최소 라인 수 및 평균 라인 길이 체크
  if (lines.filter(Boolean).length < 10) return false;
  const avgLen = lines.reduce((a, b) => a + b.length, 0) / Math.max(1, lines.length);
  if (avgLen < 5) return false;
  // 금지된 환각 패턴 즉시 거절
  if (/In the autumn of my memories/i.test(text)) return false;
  return true;
}

// Search with Claude
async function searchWithClaude(artist: string, title: string): Promise<any | null> {
  const { getSecret } = await import('@/lib/secure-secrets');
  const CLAUDE_API_KEY = (await getSecret('anthropic')) || process.env.CLAUDE_API_KEY;
  
  if (!CLAUDE_API_KEY) {
    return null;
  }
  
  const timer = new APITimer('Claude Search');
  
  try {
    const expectedLang = detectDominantLang(`${artist} ${title}`) || 'unknown';
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 6000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Task: Return the exact original song lyrics for "${title}" by "${artist}". Do not translate or paraphrase. Preserve line breaks.\n\nConstraints:\n- Do NOT fabricate or guess lines.\n- If you do not know the exact lyrics, set hasLyrics=false.\n- Language hint: output in the song's original language (likely: ${expectedLang}).\n\nOutput JSON ONLY (no extra text):\n{\n  "artist": "${artist}",\n  "title": "${title}",\n  "lyrics": "full lyrics with \\n as line breaks",\n  "language": "ko|en|ja|...",\n  "hasLyrics": true|false\n }`
              }
            ]
          }
        ]
      })
    });
    
    if (!response.ok) {
      // Basic retry for rate limit
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, 600));
        const { getSecret: getSecretOpenAI } = await import('@/lib/secure-secrets');
        const OPENAI_API_KEY = (await getSecretOpenAI('openai')) || process.env.OPENAI_API_KEY;
        const retry = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4.1',
            messages: [
              { role: 'system', content: 'You return only strict JSON. If unknown, set hasLyrics=false. Never invent lyrics.' },
              { role: 'user', content: `Return exact original lyrics for "${title}" by "${artist}". No translation, preserve line breaks. Language hint: ${expectedLang}.\n\nJSON ONLY:\n{\n  "artist": "${artist}",\n  "title": "${title}",\n  "lyrics": "full lyrics with \\n breaks",\n  "language": "ko|en|ja|...",\n  "hasLyrics": true|false\n }` }
            ],
            temperature: 0.0,
            max_tokens: 6000,
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
          timer.success(`Found lyrics: ${retryParsed.lyrics.length} chars (retry)`);
          return { ...retryParsed, source: 'gpt', confidence: 0.88 };
        }
        timer.fail('No lyrics found');
        return null;
      }
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
  const { getSecret } = await import('@/lib/secure-secrets');
  const OPENAI_API_KEY = (await getSecret('openai')) || process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    return null;
  }
  
  const timer = new APITimer('GPT Search');
  
  try {
    const expectedLang = detectDominantLang(`${artist} ${title}`) || 'unknown';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: 'You are a lyrics finder. Output strict JSON only. Never fabricate lyrics; if unknown set hasLyrics=false.'
          },
          {
            role: 'user',
            content: `Return the exact original lyrics for "${title}" by "${artist}". No translation, preserve line breaks. Language hint: ${expectedLang}.
\nJSON ONLY:\n{\n  "artist": "${artist}",\n  "title": "${title}",\n  "lyrics": "full lyrics with \\n breaks",\n  "language": "ko|en|ja|...",\n  "hasLyrics": true|false\n }`
          }
        ],
        temperature: 0.0,
        max_tokens: 6000,
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
  const { getSecret } = await import('@/lib/secure-secrets');
  const GROQ_API_KEY = (await getSecret('groq')) || process.env.GROQ_API_KEY;
  
  if (!GROQ_API_KEY) {
    return null;
  }
  
  const timer = new APITimer('Groq Search');
  
  try {
    const expectedLang = detectDominantLang(`${artist} ${title}`) || 'unknown';
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-r1-distill-llama-70b',
        messages: [
          {
            role: 'system',
            content: `You are a lyrics database. Output strict JSON. Do NOT invent lyrics. If unknown, set hasLyrics=false. Preserve line breaks; do not translate. Language hint: ${expectedLang}.`
          },
          {
            role: 'user',
            content: `Return exact original lyrics for "${title}" by "${artist}". JSON ONLY with fields artist,title,lyrics,language,hasLyrics. No extra text.`
          }
        ],
        temperature: 0.0,
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
  const { getSecret } = await import('@/lib/secure-secrets');
  const PERPLEXITY_API_KEY = (await getSecret('perplexity')) || process.env.PERPLEXITY_API_KEY;
  
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
        model: 'sonar-pro',
        messages: [
          {
            role: 'user',
            content: `Return ONLY the exact original lyrics for "${title}" by "${artist}". No commentary, no metadata, no translation. Preserve line breaks. If you do not know the exact lyrics, reply exactly: LYRICS_NOT_FOUND.`
          }
        ],
        temperature: 0.0,
        max_tokens: 6000
      })
    });
    
    if (!response.ok) {
      // Fallback on 429/400
      if (response.status === 429 || response.status === 400) {
        await new Promise(r => setTimeout(r, 600));
        const retry = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              { role: 'user', content: `ONLY output the exact original lyrics for "${title}" by "${artist}". No commentary. If unknown, output exactly: LYRICS_NOT_FOUND.` }
            ],
            temperature: 0.0,
            max_tokens: 6000
          })
        });
        if (!retry.ok) {
          timer.fail(`HTTP ${retry.status}`);
          return null;
        }
        const retryData = await retry.json();
        const retryContent = retryData.choices?.[0]?.message?.content || '';
        if (retryContent && retryContent.length > 200) {
          timer.success(`Found lyrics (fallback) ${retryContent.length} chars`);
          return { artist, title, lyrics: retryContent, source: 'perplexity', confidence: 0.75 };
        }
      }
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
      
      if (lyrics.length > 200 && validateLyricsText(lyrics)) {
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
    // Sequential to reduce 429 bursts
    const funcs = [searchWithGroq, searchWithGPT, searchWithClaude, searchWithPerplexity];
    const validResults: any[] = [];
    for (const fn of funcs) {
      try {
        const v = await fn(artist, title);
        if (v && v.lyrics) validResults.push(v);
      } catch {}
      await new Promise(r => setTimeout(r, 100 + Math.floor(Math.random() * 80)));
    }
    
    if (validResults.length === 0) {
      timer.fail('No results from any LLM');
      return NextResponse.json({
        success: false,
        error: 'Could not find lyrics from any LLM'
      });
    }
    
    // Heuristic quality scoring and normalization
    const expected = detectDominantLang(`${artist} ${title}`);
    validResults.forEach(r => {
      r.lyrics = normalizeLyrics(String(r.lyrics || ''));
      r._quality = scoreLyrics(r.lyrics, expected as any);
      // tighten confidence with heuristic
      r.confidence = 0.4 * (r.confidence || 0) + 0.6 * (r._quality || 0);
    });
    validResults.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    // 품질이 낮거나 결과가 없는 경우 Search Engine으로 폴백(스크래핑 기반, 환각 방지)
    if (validResults.length === 0 || (validResults[0]._quality || 0) < 0.6) {
      try {
        const { searchEngine } = await import('../search-engine/utils');
        const se = await searchEngine({ artist, title, engine: 'perplexity' });
        if (se?.success && se.result) {
          timer.success('Fallback via Search Engine');
          return NextResponse.json(se);
        }
      } catch {}
    }

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