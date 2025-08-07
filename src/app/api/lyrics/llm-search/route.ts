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

// Whitelist for safe lyric source hosts
const ALLOWED_HOSTS = [
  // Korean first
  'klyrics.net',
  'colorcodedlyrics.com',
  // English
  'genius.com',
  'azlyrics.com',
  'lyrics.com',
  'musixmatch.com',
  // Generic
  'lyricstranslate.com',
  // Japanese (limited)
  'uta-net.com',
  'utaten.com'
];

async function fetchUrlForTool(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    if (!ALLOWED_HOSTS.includes(host)) {
      return { ok: false, error: 'host_not_allowed', url };
    }
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US,en;q=0.8'
      }
    });
    if (!res.ok) return { ok: false, status: res.status, url };
    const htmlRaw = await res.text();
    const cleaned = htmlRaw
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .slice(0, 45000);
    return { ok: true, url, html: cleaned };
  } catch (e) {
    return { ok: false, error: String(e), url };
  }
}

// Extract first JSON object from arbitrary text (handles code fences)
function extractFirstJsonObject(text: string): string | null {
  if (!text) return null;
  // Remove common code fences
  const cleaned = text.replace(/```json[\s\S]*?```/gi, (m) => m.replace(/```json|```/gi, '')).trim();
  let start = cleaned.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return cleaned.slice(start, i + 1);
      }
    }
  }
  return null;
}

// OpenAI tools (function calling) agent that browses and extracts lyrics from HTML
async function searchWithOpenAITools(artist: string, title: string): Promise<any | null> {
  const { getSecret } = await import('@/lib/secure-secrets');
  const OPENAI_API_KEY = (await getSecret('openai')) || process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return null;

  const timer = new APITimer('GPT Tools Search');

  try {
    const expectedLang = detectDominantLang(`${artist} ${title}`) || 'unknown';
    const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5';

    const system = [
      {
        role: 'system',
        content: [
          'You are a strict lyrics extraction agent.',
          '- You may browse using the tool fetch_url to retrieve HTML from ALLOWED_HOSTS only.',
          '- Goal: return ONLY the exact original lyrics, preserving line breaks. Do not translate or paraphrase.',
          '- If unknown or blocked, output hasLyrics=false.',
          `- Language hint: ${expectedLang}`,
          '- Final answer MUST be strict JSON: { "artist": "...", "title": "...", "lyrics": "...", "language": "ko|en|ja|...", "hasLyrics": true|false }',
          '- Never include code fences or commentary in final answer.',
          '- Validate that lyrics contain multiple lines and >200 chars; otherwise set hasLyrics=false.',
          '- Site-specific hints: Genius uses containers with data-lyrics-container; Musixmatch often wraps lyrics in mxm-lyrics__content; AZLyrics uses a main div with the lyric text; ColorCodedLyrics often has verses separated by <br> tags.',
          '- Think silently; do not include reasoning.'
        ].join('\n')
      } as any
    ];

    const fewShot = [
      { role: 'user', content: 'Find lyrics: "광화문에서 (At Gwanghwamun)" by "KYUHYUN".' },
      { role: 'assistant', content: JSON.stringify({ artist: 'KYUHYUN', title: '광화문에서 (At Gwanghwamun)', lyrics: 'LYRICS_NOT_FOUND', language: 'ko', hasLyrics: false }) }
    ];

    const user = [
      {
        role: 'user',
        content: [
          `Task: Get the exact lyrics for "${title}" by "${artist}".`,
          'Process:',
          '1) Suggest 1-3 canonical lyrics page URLs from ALLOWED_HOSTS only.',
          '2) Call fetch_url for each candidate sequentially.',
          '3) Parse HTML and extract ONLY the lyrics text (no titles/credits/annotations). Prefer site main lyric container, remove headers/credits.',
          '4) Return FINAL strict JSON as specified. If unavailable, hasLyrics=false.',
          '',
          'Rules:',
          '- Do NOT choose search pages or query pages (paths containing /search, ?q=, /tag/, /category/, /artist without a specific song).',
          '- Prefer domains by language: ko -> klrics.net, colorcodedlyrics.com; ja -> uta-net.com, utaten.com; en -> genius.com, azlyrics.com, lyrics.com, musixmatch.com; else lyricstranslate.com.',
          '- Prefer URLs that look like canonical song pages (e.g., contains -lyrics or /lyrics/).',
          'ALLOWED_HOSTS:',
          ALLOWED_HOSTS.join(', ')
        ].join('\n')
      } as any
    ];

    const tools = [
      {
        type: 'function',
        function: {
          name: 'fetch_url',
          description: 'Fetch a public webpage (lyrics page) and return cleaned HTML.',
          parameters: {
            type: 'object',
            properties: { url: { type: 'string' } },
            required: ['url']
          }
        }
      }
    ];

    const messages: any[] = [...system, ...fewShot, ...user];
    const maxSteps = 8;

    for (let step = 0; step < maxSteps; step++) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.0,
          max_tokens: 7000,
          response_format: { type: 'json_object' }
        })
      });

      if (!resp.ok) {
        timer.fail(`HTTP ${resp.status}`);
        return null;
      }
      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      const calls = msg?.tool_calls || [];

      if (calls.length > 0) {
        for (const c of calls) {
          if (c.type === 'function' && c.function?.name === 'fetch_url') {
            let args: any = {};
            try { args = JSON.parse(c.function.arguments || '{}'); } catch {}
            const result = await fetchUrlForTool(String(args.url || ''));
            messages.push({
              role: 'tool',
              tool_call_id: c.id,
              name: 'fetch_url',
              content: JSON.stringify(result)
            });
          }
        }
        // continue next loop to let the model reason on tool outputs
        continue;
      }

      const content = msg?.content || '';
      if (content) {
        try {
          const jsonText = extractFirstJsonObject(content) || content;
          const parsed = JSON.parse(jsonText);
          if (parsed && typeof parsed === 'object' && 'hasLyrics' in parsed) {
            if (parsed.hasLyrics && parsed.lyrics) {
              const lyrics = normalizeLyrics(String(parsed.lyrics));
              if (validateLyricsText(lyrics)) {
                timer.success(`Found lyrics: ${lyrics.length} chars`);
                return { ...parsed, lyrics, source: 'gpt-tools', confidence: 0.92 };
              }
            }
            // even if hasLyrics=false, return to respect non-filtering philosophy up the chain if needed
            timer.success('No lyrics (hasLyrics=false)');
            return { ...parsed, source: 'gpt-tools', confidence: 0.3 };
          }
        } catch {
          timer.fail('Non-JSON final answer');
          return null;
        }
      }
    }

    timer.fail('Max steps reached');
    return null;
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
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
    const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4.1';
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
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
        const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5';
        const retry = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: OPENAI_MODEL,
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
    const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
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
    const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3-groq-70b-tool-use';
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
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
    const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || 'gpt-4.1';
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
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
            model: process.env.PERPLEXITY_MODEL_FALLBACK || 'claude-4.0-sonnet',
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
    
    // Search with tools-enabled GPT first (browsing + HTML extraction), then others
    // Sequential to reduce 429 bursts
    const funcs = [searchWithOpenAITools, searchWithGroq, searchWithGPT, searchWithClaude, searchWithPerplexity];
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