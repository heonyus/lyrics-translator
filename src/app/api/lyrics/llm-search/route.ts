import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';
import { scoreLyrics, normalizeLyrics, detectDominantLang } from '../quality';
import { extractTextFromHTML, searchKoreanSites } from '../korean-scrapers/utils';

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
  'melon.com',
  'genie.co.kr',
  'music.bugs.co.kr',
  'blog.naver.com',
  'm.blog.naver.com',
  'tistory.com',
  'kgasa.com',
  // English
  'genius.com',
  'azlyrics.com',
  'lyrics.com',
  'musixmatch.com',
  // Generic
  'lyricstranslate.com',
  // Japanese (limited)
  'uta-net.com',
  'utaten.com',
  'j-lyric.net',
  // Backup
  'mojim.com',
  'kkbox.com'
];

function extractLyricsByHost(html: string, host: string): { ok: boolean; text?: string } {
  try {
    const h = host.replace('www.', '');
    const pick = (m: RegExpMatchArray | null) => (m ? extractTextFromHTML(m[1]) : '');
    let text = '';
    if (!html) return { ok: false };
    if (h === 'genius.com') {
      const blocks = Array.from(html.matchAll(/<div[^>]+data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi));
      text = blocks.map(b => extractTextFromHTML(b[1])).join('\n');
    } else if (h === 'azlyrics.com') {
      const cont = html.match(/<!--\s*Usage of azlyrics\.com[\s\S]*?-->([\s\S]*?)<div[^>]*class="[^"]*smt[^>]*>/i) ||
                   html.match(/<div[^>]*class="[^\"]*col-xs-12[^\"]*text-center[^\"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (cont) {
        const inner = cont[1].match(/<div[^>]*>([\s\S]*?)<\/div>/i);
        text = extractTextFromHTML(inner ? inner[1] : cont[1]);
      }
    } else if (h === 'musixmatch.com') {
      const blocks = Array.from(html.matchAll(/<(?:div|span)[^>]*class="[^"]*mxm-lyrics__content[^"]*"[^>]*>([\s\S]*?)<\/(?:div|span)>/gi));
      text = blocks.map(b => extractTextFromHTML(b[1])).join('\n');
    } else if (h === 'lyrics.com') {
      const m = html.match(/<pre[^>]*id="lyric-body-text"[^>]*>([\s\S]*?)<\/pre>/i);
      text = pick(m);
    } else if (h === 'klyrics.net' || h === 'kgasa.com' || h === 'colorcodedlyrics.com') {
      const m = html.match(/<div[^>]*class="[^"]*(?:entry-content|post-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      text = pick(m);
      // strip romanization/translation blocks often marked with headings
      text = text
        .replace(/(^|\n)\s*(Romanization|English Translation|Translation|Lyrics Romanization)\b[\s\S]*$/i, '$1')
        .trim();
    } else if (h.endsWith('naver.com') && (/^blog\./.test(h) || /^m\.blog\./.test(h))) {
      // Naver Blog: try SmartEditor (se-*) or legacy post-view containers
      const cont = html.match(/<div[^>]*class="[^"]*se-main-container[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
        || html.match(/<div[^>]*id="postViewArea"[^>]*>([\s\S]*?)<\/div>/i)
        || html.match(/<div[^>]*class="[^"]*post-view[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (cont) {
        const inner = cont[1];
        const blocks = Array.from(inner.matchAll(/<(?:p|div|span)[^>]*class="[^"]*(?:se-text-paragraph|se-module|se-section|se_component|se_textarea)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div|span)>/gi));
        if (blocks.length > 0) {
          text = blocks.map(b => extractTextFromHTML(b[1])).join('\n');
        } else {
          text = extractTextFromHTML(inner);
        }
      }
    } else if (h.endsWith('tistory.com')) {
      // Tistory: common containers
      const cont = html.match(/<div[^>]*class="[^"]*(?:article|entry-content|tt_article_useless_p_margin)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
        || html.match(/<div[^>]*id="(?:tt-body-page|content)"[^>]*>([\s\S]*?)<\/div>/i);
      if (cont) {
        text = extractTextFromHTML(cont[1]);
      }
    } else if (h === 'uta-net.com') {
      const m = html.match(/<div[^>]*id="kashi_area"[^>]*>([\s\S]*?)<\/div>/i);
      text = pick(m);
    } else if (h === 'utaten.com') {
      const m = html.match(/<div[^>]*class="[^"]*lyricBody[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      text = pick(m);
    } else if (h === 'j-lyric.net') {
      // j-lyric: lyric text inside #Lyric and sometimes .lyrics
      const m = html.match(/<div[^>]*id="Lyric"[^>]*>([\s\S]*?)<\/div>/i) ||
                html.match(/<p[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      text = pick(m);
    } else if (h === 'mojim.com') {
      const m = html.match(/<dd[^>]*class="[^"]*fs[^"]*"[^>]*>([\s\S]*?)<\/dd>/i);
      text = pick(m);
    } else if (h === 'kkbox.com') {
      const m = html.match(/<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      text = pick(m);
    } else if (h === 'melon.com') {
      const m = html.match(/<div[^>]*class="[^"]*lyric[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                html.match(/<div[^>]*id="d_video_summary"[^>]*>([\s\S]*?)<\/div>/i);
      text = pick(m);
    } else if (h === 'genie.co.kr') {
      const m = html.match(/<pre[^>]*id="pLyrics"[^>]*>([\s\S]*?)<\/pre>/i) ||
                html.match(/<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      text = pick(m);
    } else if (h === 'music.bugs.co.kr') {
      const m = html.match(/<div[^>]*class="[^"]*lyricsContainer[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                html.match(/<xmp[^>]*>([\s\S]*?)<\/xmp>/i);
      text = pick(m);
    } else {
      // fallback: take the largest text block from body
      const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      text = extractTextFromHTML(body ? body[1] : html);
    }
    text = text.trim();
    // Remove common site footers/disclaimers
    const cleanupRules: Array<RegExp> = [
      /Bugs\s*님이\s*등록해\s*주신\s*가사입니다\.?/g,
      /제공[:：].*$/gmi,
      /무단전재\s*및\s*배포를\s*금합니다\.?/g,
      /Lyrics\s*provided\s*by\s*.+/gi,
      /^\s*(?:CR:|Credit:?|Source:?|출처:?|Lyrics:?|Hangul:?|Romanization:?|English:?).*/gmi
    ];
    for (const rule of cleanupRules) {
      text = text.replace(rule, '').trim();
    }
    if (text && text.split('\n').filter(Boolean).length >= 6 && text.length > 120) {
      return { ok: true, text };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

function stripSiteFooters(raw: string): string {
  if (!raw) return raw;
  let text = raw;
  const rules: Array<RegExp> = [
    /Bugs\s*님이\s*등록해\s*주신\s*가사입니다\.?/g,
    /제공[:：].*$/gmi,
    /무단전재\s*및\s*배포를\s*금합니다\.?/g,
    /Lyrics\s*provided\s*by\s*.+/gi
  ];
  for (const r of rules) text = text.replace(r, '').trim();
  return text;
}

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
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US,en;q=0.8',
        'Referer': host.includes('naver.com') ? 'https://m.blog.naver.com' : undefined as any
      }
    });
    if (!res.ok) return { ok: false, status: res.status, url };
    const htmlRaw = await res.text();
    const isNaverOrTistory = /naver\.com$|tistory\.com$/.test(host);
    const cleaned = (isNaverOrTistory ? htmlRaw : htmlRaw
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''))
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .slice(0, isNaverOrTistory ? 120000 : 45000);
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
    const OPENAI_MODEL_FALLBACK = process.env.OPENAI_MODEL_FALLBACK || 'gpt-4.1';
    const openaiModels = [OPENAI_MODEL, OPENAI_MODEL_FALLBACK, 'gpt-4o', 'gpt-4o-mini'];
    let currentOpenAIModel = openaiModels[0];

    // Perplexity-backed web search for candidate URLs
    async function searchWebForTool(artistArg: string, titleArg: string) {
      try {
        const PPLX_KEY = (await getSecret('perplexity')) || process.env.PERPLEXITY_API_KEY;
        if (!PPLX_KEY) return { ok: false, error: 'perplexity_key_missing' };
        const lang = detectDominantLang(`${artistArg} ${titleArg}`);
        const providers = (
          lang === 'ko'
            ? [
                'klyrics.net',
                'colorcodedlyrics.com',
                'kgasa.com',
                'blog.naver.com',
                'm.blog.naver.com',
                'tistory.com',
                'kkbox.com',
                'genius.com',
                'azlyrics.com',
                'lyrics.com',
                'musixmatch.com'
              ]
            : lang === 'ja'
            ? ['uta-net.com', 'utaten.com', 'mojim.com', 'genius.com', 'lyrics.com', 'kkbox.com']
            : ['genius.com', 'azlyrics.com', 'lyrics.com', 'musixmatch.com', 'lyricstranslate.com', 'kkbox.com']
        );
        const resp = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${PPLX_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: process.env.PERPLEXITY_MODEL || 'gpt-4.1',
            messages: [
              { role: 'user', content: `Return only canonical lyrics page URLs for "${titleArg}" by "${artistArg}".\nRules:\n- Providers: ${providers.join(', ')}.\n- One URL per line.\n- No duplicates, no commentary, no markdown.\n- Prefer exact song page (not search pages).\n- Exclude URLs containing ?q=, /search, /tag, /category, or artist hubs.` }
            ],
            temperature: 0.1,
            max_tokens: 400
          })
        });
        if (!resp.ok) return { ok: false, status: resp.status };
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || '';
        const all = (content.match(/https?:\/\/[^\s]+/g) || []).map((u: string) => u.replace(/[),.]+$/,''));
        const allowed = all.filter((u: string) => {
          try {
            const host = new URL(u).hostname.replace('www.', '');
            if (!ALLOWED_HOSTS.includes(host)) return false;
            if (/[?]q=|\/search|\/tag\b|\/category\b|\/artist\b/.test(u)) return false;
            return true;
          } catch { return false; }
        });
        const seen = new Set<string>();
        const urls: string[] = [];
        for (const u of allowed) {
          try {
            const parsed = new URL(u);
            const key = parsed.hostname + parsed.pathname;
            if (!seen.has(key)) { seen.add(key); urls.push(u); }
          } catch {}
          if (urls.length >= 5) break;
        }
        return { ok: true, urls };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    }

    const toolHtmlCache = new Map<string, string>();

    const system = [
      {
        role: 'system',
        content: [
          'You are a strict lyrics extraction agent.',
          '- You may browse using the tools: search_web (candidate URLs) and fetch_url (HTML) from ALLOWED_HOSTS only.',
          '- After fetch_url on a known host, you MUST call extract_from_html to get deterministic extraction using site-specific selectors.',
          '- Goal: return ONLY the exact original lyrics, preserving line breaks. Do not translate or paraphrase.',
          '- If unknown or blocked, output hasLyrics=false.',
          `- Language hint: ${expectedLang}`,
          '- If a site rejects bot traffic (blocked/empty HTML), you MUST try alternative allowed hosts (e.g., for ko: kgasa.com, blog.naver.com, tistory.com; for ja: uta-net.com, utaten.com, j-lyric.net).',
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
          '1) Optionally call search_web to get 1-5 candidate URLs (ALLOWED_HOSTS only).',
          '2) Otherwise suggest up to 3 canonical URLs yourself (no search pages).',
          '3) Call fetch_url for each candidate sequentially.',
          '4) Parse HTML and extract ONLY the lyrics text (no titles/credits/annotations). Prefer site main lyric container, remove headers/credits.',
          '5) Return FINAL strict JSON as specified. If unavailable, hasLyrics=false.',
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
          name: 'search_web',
          description: 'Return a list of candidate canonical lyrics page URLs for the song.',
          parameters: {
            type: 'object',
            properties: { artist: { type: 'string' }, title: { type: 'string' } },
            required: ['artist', 'title']
          }
        }
      },
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
      },
      {
        type: 'function',
        function: {
          name: 'extract_from_html',
          description: 'Extract lyrics text using site-specific selectors from the last fetched HTML for the URL.',
          parameters: {
            type: 'object',
            properties: { url: { type: 'string' } },
            required: ['url']
          }
        }
      }
    ];

    const messages: any[] = [...system, ...fewShot, ...user];
    // Prepend strong hint for Korean songs to prefer Bugs/Melon/Genie URLs
    if (expectedLang === 'ko') {
      messages.push({ role: 'system', content: 'When proposing URLs for Korean songs, prefer: music.bugs.co.kr track page, melon.com song detail page, and genie.co.kr songInfo page (not search list).' });
    }
    const maxSteps = 10;

    for (let step = 0; step < maxSteps; step++) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: currentOpenAIModel,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.0,
          max_tokens: 7000,
          response_format: { type: 'json_object' }
        })
      });

      if (!resp.ok) {
        // On model errors, switch to fallback model and retry this step
        if ([400, 404, 422].includes(resp.status)) {
          const idx = openaiModels.indexOf(currentOpenAIModel);
          if (idx >= 0 && idx < openaiModels.length - 1) {
            currentOpenAIModel = openaiModels[idx + 1];
            await new Promise(r => setTimeout(r, 250));
            step--; // retry same step with fallback model
            continue;
          }
        }
        if (resp.status === 429) {
          await new Promise(r => setTimeout(r, 600));
          step--;
          continue;
        }
        timer.fail(`HTTP ${resp.status}`);
        return null;
      }
      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      const calls = msg?.tool_calls || [];

      if (calls.length > 0) {
        for (const c of calls) {
          if (c.type === 'function') {
            if (c.function?.name === 'fetch_url') {
              let args: any = {};
              try { args = JSON.parse(c.function.arguments || '{}'); } catch {}
              const result = await fetchUrlForTool(String(args.url || ''));
              if (result && (result as any).ok && (result as any).html && (result as any).url) {
                try { toolHtmlCache.set((result as any).url, (result as any).html); } catch {}
              }
              messages.push({ role: 'tool', tool_call_id: c.id, name: 'fetch_url', content: JSON.stringify(result) });
            } else if (c.function?.name === 'extract_from_html') {
              let args: any = {};
              try { args = JSON.parse(c.function.arguments || '{}'); } catch {}
              const u = String(args.url || '');
              try {
                const host = new URL(u).hostname.replace('www.', '');
                const html = toolHtmlCache.get(u) || '';
                const parsed = extractLyricsByHost(html, host);
                messages.push({ role: 'tool', tool_call_id: c.id, name: 'extract_from_html', content: JSON.stringify({ url: u, host, ...parsed }) });
              } catch (e) {
                messages.push({ role: 'tool', tool_call_id: c.id, name: 'extract_from_html', content: JSON.stringify({ url: u, ok: false, error: String(e) }) });
              }
            } else if (c.function?.name === 'search_web') {
              let args: any = {};
              try { args = JSON.parse(c.function.arguments || '{}'); } catch {}
              const result = await searchWebForTool(String(args.artist || artist), String(args.title || title));
              messages.push({ role: 'tool', tool_call_id: c.id, name: 'search_web', content: JSON.stringify(result) });
            }
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

// Resolve fuzzy user input (phonetic/translated titles) to canonical artist/title
async function resolveCanonical(artist: string, title: string): Promise<{ artist: string; title: string } | null> {
  try {
    const { getSecret } = await import('@/lib/secure-secrets');
    const PPLX_KEY = (await getSecret('perplexity')) || process.env.PERPLEXITY_API_KEY;
    if (!PPLX_KEY) return null;
    const langHint = detectDominantLang(`${artist} ${title}`);
    // Only resolve for non-ASCII or when likely ko/ja to save cost
    if (!/[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(`${artist}${title}`) && langHint === 'en') {
      return null;
    }
    const prompt = [
      'Normalize the following music query to canonical artist and track title.',
      'Prefer official English or romaji for the title; also consider the original script if that is canonical.',
      'Respond in strict JSON with fields: {"artist":"...","title":"..."}.',
      `Query artist: ${artist}`,
      `Query title: ${title}`,
      'If already canonical, return as-is.'
    ].join('\n');
    const resp = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PPLX_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.PERPLEXITY_MODEL || 'gpt-4.1',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.0,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(content);
      if (parsed?.artist && parsed?.title) {
        return { artist: String(parsed.artist), title: String(parsed.title) };
      }
    } catch {}
    return null;
  } catch {
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
    const CLAUDE_FALLBACK = process.env.CLAUDE_MODEL_FALLBACK || 'claude-3-5-haiku-20241022';
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
      // Retry with Claude fallback on 4xx and rate-limit backoff
      if (response.status === 429 || response.status === 400) {
        await new Promise(r => setTimeout(r, 600));
        const retryClaude = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({
            model: CLAUDE_FALLBACK,
            max_tokens: 6000,
            messages: [
              { role: 'user', content: [{ type: 'text', text: `Return strict JSON lyrics for "${title}" by "${artist}"; no fabrication; preserve line breaks; language hint: ${expectedLang}.\nFields: artist,title,lyrics,language,hasLyrics.` }]}
            ]
          })
        });
        if (!retryClaude.ok) {
          timer.fail(`HTTP ${retryClaude.status}`);
          return null;
        }
        const retryData = await retryClaude.json();
        const retryText = retryData.content?.[0]?.text || '{}';
        const retryParsed = JSON.parse(retryText);
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
    let { artist, title } = await request.json();
    // Heuristic alias normalization (Korean → canonical) for better provider routing
    function normalizeAliases(a: string, t: string) {
      let na = a || '';
      let nt = t || '';
      if (/원오크락|원오케이락/i.test(na)) na = 'ONE OK ROCK';
      if (/왓에발유얼|왓에벌유얼|왓에버유얼|왓에버 유어|왓 에버 유어|왓에버유아|웨러에버유어|웨어에버유어/i.test(nt)) nt = 'Wherever you are';
      // dori 2오클락 변형 보정
      if (/도리/i.test(na)) na = 'dori';
      if (/(\d+)\s*오\s*클락|\d+\s*오클락/i.test(nt)) {
        const m = nt.match(/(\d+)/);
        if (m) nt = `${m[1]} o'clock`;
      }
      return { na, nt };
    }
    const norm = normalizeAliases(String(artist || ''), String(title || ''));
    artist = norm.na;
    title = norm.nt;
    // Canonical resolver (non-hardcoded) for fuzzy inputs like '호시노겐 푸딩' → '星野源 - くだらないの中に' (example)
    try {
      const canonical = await resolveCanonical(artist, title);
      if (canonical?.artist && canonical?.title) {
        artist = canonical.artist;
        title = canonical.title;
      }
    } catch {}
    
    if (!artist || !title) {
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }
    
    logger.search(`🤖 LLM Search: "${artist} - ${title}"`);
    
    // Search with tools-enabled GPT first (browsing + HTML extraction), then others.
    // If Korean language is likely, try deterministic Korean scrapers early.
    const quickKo = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(`${artist}${title}`);
    const langHint = quickKo ? 'ko' : detectDominantLang(`${artist} ${title}`);
    const funcs = (
      langHint === 'ko'
        ? [
            async (a: string, t: string) => {
              try {
                const r = await searchKoreanSites({ artist: a, title: t });
                if (r?.success && r.result?.lyrics) {
                  return { ...r.result, source: r.result.source || 'korean-sites', confidence: 0.95 };
                }
              } catch {}
              return null;
            },
            searchWithOpenAITools,
            searchWithGroq,
            searchWithGPT,
            searchWithClaude,
            searchWithPerplexity
          ]
        : [searchWithOpenAITools, searchWithGroq, searchWithGPT, searchWithClaude, searchWithPerplexity]
    );
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
      r.lyrics = normalizeLyrics(stripSiteFooters(String(r.lyrics || '')));
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