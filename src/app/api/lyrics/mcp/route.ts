import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';
import { normalizeLyrics, scoreLyrics, detectDominantLang } from '../quality';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { getSecret } from '@/lib/secure-secrets';

// Lazy import to avoid client bundling issues
async function getDbClient() {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase');
    return supabaseAdmin();
  } catch {
    try {
      const { supabase } = await import('@/lib/supabase');
      return supabase; // falls back to anon client
    } catch {
      return null;
    }
  }
}

async function readFromCache(artist: string, title: string) {
  const db = await getDbClient();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from('ai_lyrics_cache')
      .select('id, lyrics, source, confidence, search_time')
      .eq('artist', artist)
      .eq('title', title)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;
    // fire-and-forget: increment hit_count
    db.from('ai_lyrics_cache')
      .update({ hit_count: (data as any).hit_count ? (data as any).hit_count + 1 : 1 })
      .eq('id', (data as any).id)
      .then(() => {});
    return data;
  } catch {
    return null;
  }
}

// FS 캐시 (로컬 개발용) - Supabase 미구성 시 사용
function getFsCachePath() {
  const dir = path.resolve(process.cwd(), '.cache');
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  }
  return path.join(dir, 'lyrics-cache.json');
}

async function readFromFsCache(artist: string, title: string) {
  try {
    const file = getFsCachePath();
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw || '{}');
    const key = `${artist}|||${title}`;
    const val = data[key];
    return val || null;
  } catch { return null; }
}

async function saveToFsCache(entry: any) {
  try {
    const file = getFsCachePath();
    let data: Record<string, any> = {};
    if (fs.existsSync(file)) {
      try { data = JSON.parse(fs.readFileSync(file, 'utf8') || '{}'); } catch { data = {}; }
    }
    const key = `${entry.artist}|||${entry.title}`;
    data[key] = entry;
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

async function saveToCache(params: {
  artist: string;
  title: string;
  lyrics: string;
  source: string;
  confidence: number;
  searchTime?: number;
  ttlDays?: number;
}) {
  const db = await getDbClient();
  if (!db) return false;
  try {
    const ttlDays = Math.max(1, Math.min(30, params.ttlDays ?? parseInt(process.env.LYRICS_CACHE_TTL_DAYS || '7', 10)));
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
    const payload = {
      artist: params.artist,
      title: params.title,
      lyrics: params.lyrics,
      lrc_format: null,
      source: params.source,
      confidence: params.confidence,
      search_time: params.searchTime ?? null,
      expires_at: expiresAt,
    } as any;
    const { error } = await db
      .from('ai_lyrics_cache')
      .upsert(payload, { onConflict: 'artist,title' });
    return !error;
  } catch {
    return false;
  }
}

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
const USE_LLM = process.env.LYRICS_USE_LLM === 'true';
const USE_LLM_URL = process.env.LYRICS_URL_SUGGEST_LLM === 'true';
const QUALITY_MODE = process.env.LYRICS_QUALITY_MODE === 'true';
const TIME_BUDGET_MS = parseInt(process.env.LYRICS_SEARCH_TIMEOUT_MS || '17000', 10);

function deriveBaseUrl(req: NextRequest) {
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

async function parseQuerySmart(raw: string, baseUrl: string): Promise<{ artist: string; title: string } | null> {
  if (!raw || !raw.trim()) return null;
  try {
    const res = await fetch(`${baseUrl}/api/lyrics/parse-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: raw })
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (data?.success && data?.parsed?.artist && data?.parsed?.title) {
      return { artist: data.parsed.artist, title: data.parsed.title };
    }
    return null;
  } catch {
    return null;
  }
}

// Firecrawl 호출은 크레딧이 소모되므로, 우선 직접 fetch로 시도 후 필요 시 폴백
async function firecrawlScrape(url: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const candidates: Array<string | undefined> = [
      data?.markdown, data?.html, data?.text, data?.content,
      data?.data?.markdown, data?.data?.html, data?.data?.text, data?.data?.content,
    ];
    const first = candidates.find(Boolean);
    return first ? String(first).slice(0, 40000) : null;
  } catch {
    return null;
  }
}

async function suggestUrls(artist: string, title: string): Promise<string[]> {
  const queryLang = detectDominantLang(`${artist} ${title}`);
  const DOMAIN_SETS: Record<string, string[]> = {
    ko: [
      'genius.com',
      'klyrics.net',
      'melon.com',
      'genie.co.kr',
      'music.bugs.co.kr',
      'vibe.naver.com',
      'mnet.com',
      'gasa-lyrics.tistory.com',
      'blog.naver.com',
    ],
    ja: [
      'genius.com',
      'utamap.com',
      'uta-net.com',
      'j-lyric.net',
      'petitlyrics.com',
      'animelyrics.com',
      'jpopasia.com',
    ],
    en: [
      'genius.com',
      'azlyrics.com',
      'lyrics.com',
      'oldielyrics.com',
      'songlyrics.com',
    ],
    zh: [
      'mojim.com',
      'kkbox.com',
      'genius.com',
    ],
  };

  const preferred = DOMAIN_SETS[queryLang] || [
    'genius.com', 'azlyrics.com', 'lyrics.fandom.com', 'klyrics.net'
  ];

  function buildHeuristicUrls(): string[] {
    const urls: string[] = [];
    const slugArtist = encodeURIComponent(artist);
    const slugTitle = encodeURIComponent(title);
    const azArtist = artist.toLowerCase().replace(/[^a-z0-9]/gi, '');
    const azTitle = title.toLowerCase().replace(/[^a-z0-9]/gi, '');
    const fandomArtist = artist.replace(/\s+/g, '_');
    const fandomTitle = title.replace(/\s+/g, '_');
    urls.push(`https://genius.com/${slugArtist}-${slugTitle}-lyrics`);
    urls.push(`https://www.azlyrics.com/lyrics/${azArtist}/${azTitle}.html`);
    urls.push(`https://lyrics.fandom.com/wiki/${encodeURIComponent(fandomArtist)}:${encodeURIComponent(fandomTitle)}`);
    urls.push(`https://klyrics.net/?s=${encodeURIComponent(`${artist} ${title}`)}`);
    urls.push(`https://www.uta-net.com/search/?Aselect=2&Keyword=${encodeURIComponent(title)}`);
    urls.push(`https://www.j-lyric.net/index.php?c=search&kt=${encodeURIComponent(title)}&ka=${encodeURIComponent(artist)}`);
    urls.push(`https://duckduckgo.com/html/?q=${encodeURIComponent(`${artist} ${title} lyrics`)}`);
    return urls;
  }

  async function tavilySearchUrls(): Promise<string[]> {
    try {
      const apiKey = (await getSecret('tavily')) || process.env.TAVILY_API_KEY || '';
      if (!apiKey) return [];
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          query: `${artist} ${title} lyrics`,
          include_domains: preferred,
          max_results: 8,
          search_depth: 'advanced',
        }),
      });
      if (!res.ok) return [];
      const data = await res.json().catch(() => null);
      const urls: string[] = (data?.results || [])
        .map((r: any) => r.url)
        .filter((u: string) => typeof u === 'string');
      return urls;
    } catch {
      return [];
    }
  }

  if (USE_LLM_URL && GOOGLE_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const out = await model.generateContent(
        `Find reliable pages that contain the COMPLETE lyrics for "${title}" by ${artist}.
Return ONLY valid URLs, one per line (3-5).`
      );
      const text = out.response.text().trim();
      const urls = (text.match(/https?:\/\/[^\s]+/g) || []).slice(0, 5);
      if (urls.length) return urls;
    } catch {
      // fallthrough to heuristic
    }
  }
  const heuristic = buildHeuristicUrls();
  const tav = await tavilySearchUrls();
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const u of [...heuristic, ...tav]) {
    const key = u.replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (!seen.has(key)) { seen.add(key); merged.push(u); }
  }
  return merged.slice(0, 20);
}

function extractLyricsHeuristic(raw: string): string | null {
  const cleaned = (raw || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  const text = cleaned
    .replace(/<br\s*\/?>(?=\s*\n)?/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\r\n/g, '\n');
  const blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  const scored = blocks.map(b => ({ b, lines: b.split('\n').length }))
    .filter(x => x.lines >= 8)
    .sort((a, b) => b.lines - a.lines);
  if (!scored.length) return null;
  const best = scored[0].b.trim();
  return best.length >= 100 ? normalizeLyrics(best) : null;
}

async function extractLyricsLLM(raw: string, artist: string, title: string): Promise<string | null> {
  if (!GOOGLE_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const cleaned = (raw || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .slice(0, 20000);
  const prompt = `Extract ONLY the song lyrics for "${title}" by ${artist}.
- Preserve line breaks and stanza structure.
- No metadata/explanations.
- If not found, return "NO_LYRICS_FOUND".

Content:
${cleaned}

Lyrics:`;
  try {
    const out = await model.generateContent(prompt);
    const txt = out.response.text().trim();
    if (!txt || txt.includes('NO_LYRICS_FOUND') || txt.length < 100) return null;
    return normalizeLyrics(txt);
  } catch {
    return null;
  }
}

function scriptRatios(text: string): { hangul: number; kana: number; han: number; latin: number } {
  const total = Math.max(1, text.length);
  const hangul = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) || []).length / total;
  const kana = (text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length / total;
  const han = (text.match(/[\u4E00-\u9FFF]/g) || []).length / total;
  const latin = (text.match(/[A-Za-z]/g) || []).length / total;
  return { hangul, kana, han, latin };
}

function isScriptIntegrityOk(lyrics: string, expected: 'ko' | 'ja' | 'zh' | 'en' | 'unknown'): boolean {
  const { hangul, kana, han, latin } = scriptRatios(lyrics);
  switch (expected) {
    case 'ko':
      // 한글 비중이 충분히 높아야 함 (영문 표기만 가득한 경우 배제)
      return hangul >= 0.35; // 허용치(혼합 라인 감안)
    case 'ja':
      return kana >= 0.30; // 히라가나/가타카나 비중
    case 'zh':
      return han >= 0.30;
    case 'en':
      return latin >= 0.50;
    default:
      return true;
  }
}

export async function POST(request: NextRequest) {
  const timer = new APITimer('MCP Lyrics');
  try {
    const { artist, title, query, strategy, bypassCache } = await request.json().catch(() => ({}));
    const baseUrl = deriveBaseUrl(request);
    if ((!artist || !title) && !query) {
      timer.fail('missing-params');
      return NextResponse.json({ success: false, error: 'artist/title or query required' }, { status: 400 });
    }
    // Smart parse: LLM로 자유 입력을 정교하게 파싱
    let a = artist || '';
    let t = title || '';
    const raw = (query && String(query)) || `${a} ${t}`;
    const parsed = await parseQuerySmart(raw, baseUrl);
    if (parsed?.artist && parsed?.title) {
      a = parsed.artist;
      t = parsed.title;
    }
    const display = query || `${a} - ${t}`;
    logger.search(`MCP: ${display}`);

    // 0) 캐시 조회 (옵션으로 우회 가능)
    if (!bypassCache) {
      let cached = await readFromCache(a, t);
      if (!cached) {
        cached = await readFromFsCache(a, t);
      }
      if (cached?.lyrics) {
        logger.cache(true, `${a} - ${t}`);
        const ms = timer.skip('cache-hit');
        return NextResponse.json({
          success: true,
          result: {
            lyrics: cached.lyrics,
            source: cached.source?.startsWith('cache:') ? cached.source : `cache:${cached.source || 'fs'}`,
            url: undefined,
            artist: a,
            title: t || a,
            confidence: cached.confidence ?? 0.8,
            hasTimestamps: /^\[\d{2}:\d{2}/m.test(cached.lyrics),
            searchTime: cached.search_time ?? ms,
          },
        });
      } else {
        logger.cache(false, `${a} - ${t}`);
      }
    }

    const firecrawlKey = (await getSecret('firecrawl')) || process.env.FIRECRAWL_API_KEY || '';

    // 1) URL 후보 준비 (LLM 사용 여부에 따라)
    const urls = await suggestUrls(a, t);
    if (!urls.length) {
      timer.fail('no-url-suggestions');
      return NextResponse.json({ success: false, error: 'no url suggestions' }, { status: 404 });
    }

    // 2) 각 URL 시도
    // strategy:
    //  - 'direct-first' (default): 무료 direct → 실패 시 firecrawl 폴백
    //  - 'firecrawl-only': 곧바로 firecrawl만 사용
    //  - 'no-firecrawl': firecrawl 미사용(절대 크레딧 쓰지 않음)
    const strat = (strategy as string) || (QUALITY_MODE ? 'firecrawl-only' : 'direct-first');

    type CandidateResult = { url: string; lyrics: string; confidence: number; sourceTag: string; hasTimestamps: boolean };
    async function processCandidate(url: string): Promise<CandidateResult | null> {
      try {
        let raw: string | null = null;
        if (strat === 'firecrawl-only') {
          if (firecrawlKey) raw = await firecrawlScrape(url, firecrawlKey);
        } else if (strat === 'no-firecrawl') {
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' } }).catch(() => null);
          if (r && r.ok) raw = await r.text();
        } else {
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' } }).catch(() => null);
          if (r && r.ok) raw = await r.text();
          if (!raw && firecrawlKey) raw = await firecrawlScrape(url, firecrawlKey);
        }
        if (!raw) return null;
        const lyrics = USE_LLM ? (await extractLyricsLLM(raw, a, t)) : extractLyricsHeuristic(raw);
        if (!lyrics) return null;
        const expected = detectDominantLang(`${a} ${t}`);
        // 스크립트 무결성 정책: 예상 언어 스크립트 비중이 낮으면 후보 탈락
        if (!isScriptIntegrityOk(lyrics, expected)) return null;
        const confidence = scoreLyrics(lyrics, expected);
        return { url, lyrics, confidence, sourceTag: `mcp:${new URL(url).hostname.replace('www.', '')}`, hasTimestamps: /^\[\d{2}:\d{2}/m.test(lyrics) };
      } catch {
        return null;
      }
    }

    if (QUALITY_MODE) {
      const limited = urls.slice(0, 12);
      const results = await Promise.allSettled(limited.map(processCandidate));
      const valid = results.map(r => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean) as CandidateResult[];
      if (valid.length > 0) {
        valid.sort((a, b) => (b.confidence - a.confidence) || (b.lyrics.length - a.lyrics.length));
        const best = valid[0];
        const ms = timer.success(`Selected best (${Math.round(best.confidence*100)}%) from ${best.sourceTag}`);
        saveToCache({ artist: a, title: t || a, lyrics: best.lyrics, source: best.sourceTag, confidence: best.confidence, searchTime: ms }).then(()=>{}).catch(()=>{});
        saveToFsCache({ artist: a, title: t || a, lyrics: best.lyrics, source: `cache:${best.sourceTag}`, confidence: best.confidence, search_time: ms });
        return NextResponse.json({ success: true, result: { lyrics: best.lyrics, source: best.sourceTag, url: best.url, artist: a, title: t || a, confidence: best.confidence, hasTimestamps: best.hasTimestamps, searchTime: ms } });
      }
    } else {
      const started = Date.now();
      for (const url of urls) {
        if (Date.now() - started > TIME_BUDGET_MS) break;
        const r = await processCandidate(url);
        if (!r) continue;
        const ms = timer.success(`Found ${r.lyrics.length} chars from ${url}`);
        saveToCache({ artist: a, title: t || a, lyrics: r.lyrics, source: r.sourceTag, confidence: r.confidence, searchTime: ms }).then(()=>{}).catch(()=>{});
        saveToFsCache({ artist: a, title: t || a, lyrics: r.lyrics, source: `cache:${r.sourceTag}`, confidence: r.confidence, search_time: ms });
        return NextResponse.json({ success: true, result: { lyrics: r.lyrics, source: r.sourceTag, url, artist: a, title: t || a, confidence: r.confidence, hasTimestamps: r.hasTimestamps, searchTime: ms } });
      }
    }

    // Lyrics 실패 시에도 최소 메타데이터 반환 시도
    const metaRes = await fetch(`${baseUrl}/api/album/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist: a, title: t || a })
    }).catch(() => null);
    let albumInfo: any = null;
    if (metaRes && metaRes.ok) {
      const j = await metaRes.json().catch(() => null);
      albumInfo = j?.albumInfo || null;
    }

    timer.fail('no-lyrics');
    return NextResponse.json({
      success: false,
      error: 'lyrics not found',
      result: {
        lyrics: '',
        source: 'none',
        url: undefined,
        artist: a,
        title: t || a,
        confidence: 0,
        hasTimestamps: false,
        searchTime: TIME_BUDGET_MS,
        albumInfo: albumInfo || { album: '', coverUrl: '' }
      }
    }, { status: 404 });
  } catch (err) {
    timer.fail(err instanceof Error ? err.message : 'unknown');
    logger.error('MCP Lyrics error', err);
    return NextResponse.json({ success: false, error: 'internal-error' }, { status: 500 });
  }
}


