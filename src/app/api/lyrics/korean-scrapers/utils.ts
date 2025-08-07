import { APITimer, logger } from '@/lib/logger';

// Extract text from HTML preserving line breaks
export function extractTextFromHTML(html: string): string {
  let text = html
    .replace(/<br\s*\/?>(?=\s*\n?)/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, '');

  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9A-F]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)));

  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

// Generate Korean search query variants (romanization, spacing, o'clock normalization)
function generateKoVariants(artist: string, title: string): Array<{ a: string; t: string }> {
  const A = String(artist || '').trim();
  const T = String(title || '').trim();
  const artists = new Set<string>([A]);
  const titles = new Set<string>([T]);

  // Artist romanization
  if (/도리/i.test(A)) {
    artists.add('dori');
    artists.add('DORI');
    artists.add('Dori');
  }

  // Title normalization: "2오클락" → "2 o'clock", "2 oclock"
  const ocRegex = /(\d+)\s*오\s*클락/iu;
  const ocRegex2 = /(\d+)\s*오클락/iu;
  const addOclock = (s: string) => {
    const m = s.match(/(\d+)/);
    if (m) {
      const n = m[1];
      titles.add(`${n} o'clock`);
      titles.add(`${n} O'Clock`);
      titles.add(`${n} oclock`);
      titles.add(`${n} Oclock`);
    }
  };
  if (ocRegex.test(T)) addOclock(T);
  if (ocRegex2.test(T)) addOclock(T);
  // Spacing variants
  titles.add(T.replace(/\s+/g, ' ').trim());
  titles.add(T.replace(/\s*/g, ''));

  const pairs: Array<{ a: string; t: string }> = [];
  for (const a of artists) {
    for (const t of titles) {
      pairs.push({ a, t });
    }
  }
  // Put romanized artist with o'clock variants first for better hit rate
  return pairs;
}

export async function searchBugs(artist: string, title: string): Promise<any | null> {
  const timer = new APITimer('Bugs');
  try {
    const query = `${artist} ${title}`;
    const searchUrl = `https://music.bugs.co.kr/search/integrated?q=${encodeURIComponent(query)}`;
    logger.info(`🔍 Searching Bugs: ${query}`);
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9'
      }
    });
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    const html = await response.text();
    const trackMatch = html.match(/track\/(\d+)/);
    if (!trackMatch) {
      timer.fail('No track found');
      return null;
    }
    const trackId = trackMatch[1];
    const lyricsUrl = `https://music.bugs.co.kr/track/${trackId}`;
    const lyricsResponse = await fetch(lyricsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9'
      }
    });
    if (!lyricsResponse.ok) {
      timer.fail('Failed to fetch lyrics page');
      return null;
    }
    const lyricsHtml = await lyricsResponse.text();
    const lyricsMatch = lyricsHtml.match(/<div[^>]*class="[^"]*lyricsContainer[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                       lyricsHtml.match(/<xmp[^>]*>([\s\S]*?)<\/xmp>/i) ||
                       lyricsHtml.match(/<div[^>]*class="[^"]*lyricsText[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                       lyricsHtml.match(/<section[^>]*class="[^"]*sectionPadding[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/section>/i) ||
                       lyricsHtml.match(/<p[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    if (!lyricsMatch) {
      timer.fail('No lyrics found on page');
      return null;
    }
    const lyrics = extractTextFromHTML(lyricsMatch[1]);
    if (lyrics && lyrics.length > 60) {
      timer.success(`Found ${lyrics.length} chars`);
      return { lyrics, source: 'bugs', url: lyricsUrl, confidence: 0.9 };
    }
    timer.fail('Lyrics too short');
    return null;
  } catch (e) {
    timer.fail(e instanceof Error ? e.message : 'Unknown error');
    return null;
  }
}

export async function searchMelon(artist: string, title: string): Promise<any | null> {
  const timer = new APITimer('Melon');
  try {
    const query = `${artist} ${title}`;
    const searchUrl = `https://www.melon.com/search/total/index.htm?q=${encodeURIComponent(query)}&section=&linkOrText=T&ipath=srch_form`;
    logger.info(`🔍 Searching Melon: ${query}`);
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Cookie': 'PCID=1234567890',
        'Referer': 'https://www.melon.com/',
        'Cache-Control': 'no-cache'
      }
    });
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    const html = await response.text();
    const songMatch = html.match(/goSongDetail\('(\d+)'\)/);
    if (!songMatch) {
      timer.fail('No song found');
      return null;
    }
    const songId = songMatch[1];
    const lyricsUrl = `https://www.melon.com/song/detail.htm?songId=${songId}`;
    const lyricsResponse = await fetch(lyricsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Cookie': 'PCID=1234567890',
        'Referer': searchUrl,
        'Cache-Control': 'no-cache'
      }
    });
    if (!lyricsResponse.ok) {
      timer.fail('Failed to fetch lyrics page');
      return null;
    }
    const lyricsHtml = await lyricsResponse.text();
    const lyricsMatch = lyricsHtml.match(/<div[^>]*class="[^"]*lyric[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                       lyricsHtml.match(/<div[^>]*id="d_video_summary"[^>]*>([\s\S]*?)<\/div>/i);
    if (!lyricsMatch) {
      timer.fail('No lyrics found on page');
      return null;
    }
    const lyrics = extractTextFromHTML(lyricsMatch[1]);
    if (lyrics && lyrics.length > 60) {
      timer.success(`Found ${lyrics.length} chars`);
      return { lyrics, source: 'melon', url: lyricsUrl, confidence: 0.9 };
    }
    timer.fail('Lyrics too short');
    return null;
  } catch (e) {
    timer.fail(e instanceof Error ? e.message : 'Unknown error');
    return null;
  }
}

export async function searchGenie(artist: string, title: string): Promise<any | null> {
  const timer = new APITimer('Genie');
  try {
    const query = `${artist} ${title}`;
    const searchUrl = `https://www.genie.co.kr/search/searchMain?query=${encodeURIComponent(query)}`;
    logger.info(`🔍 Searching Genie: ${query}`);
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://www.genie.co.kr/',
        'Cache-Control': 'no-cache'
      }
    });
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    const html = await response.text();
    let songId: string | null = null;
    const songMatch1 = html.match(/songInfo\((\d+)\)/);
    if (songMatch1) songId = songMatch1[1];
    if (!songId) {
      const songMatch2 = html.match(/detail\/songInfo\?xgnm=(\d+)/);
      if (songMatch2) songId = songMatch2[1];
    }
    if (!songId) {
      const songMatch3 = html.match(/data-song-id=["'](\d+)["']/i);
      if (songMatch3) songId = songMatch3[1];
    }
    if (!songId) {
      timer.fail('No song found');
      return null;
    }
    const lyricsUrl = `https://www.genie.co.kr/detail/songInfo?xgnm=${songId}`;
    const lyricsResponse = await fetch(lyricsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': searchUrl,
        'Cache-Control': 'no-cache'
      }
    });
    if (!lyricsResponse.ok) {
      timer.fail('Failed to fetch lyrics page');
      return null;
    }
    const lyricsHtml = await lyricsResponse.text();
    const lyricsMatch = lyricsHtml.match(/<pre[^>]*id="pLyrics"[^>]*>([\s\S]*?)<\/pre>/i) ||
                       lyricsHtml.match(/<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (!lyricsMatch) {
      timer.fail('No lyrics found on page');
      return null;
    }
    const lyrics = extractTextFromHTML(lyricsMatch[1]);
    if (lyrics && lyrics.length > 60) {
      timer.success(`Found ${lyrics.length} chars`);
      return { lyrics, source: 'genie', url: lyricsUrl, confidence: 0.9 };
    }
    timer.fail('Lyrics too short');
    return null;
  } catch (e) {
    timer.fail(e instanceof Error ? e.message : 'Unknown error');
    return null;
  }
}

export async function searchKoreanSites({ artist, title }: { artist: string; title: string }) {
  const timer = new APITimer('Korean Sites');
  logger.info(`🇰🇷 Searching Korean sites for: ${artist} - ${title}`);
  try {
    const variants = generateKoVariants(artist, title);
    for (const v of variants) {
      const searches = [
        searchBugs(v.a, v.t),
        searchMelon(v.a, v.t),
        searchGenie(v.a, v.t)
      ];
      const results = await Promise.allSettled(searches);
      const validResults = results
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => (r as PromiseFulfilledResult<any>).value);
      if (validResults.length > 0) {
        validResults.sort((a, b) => {
          const confDiff = b.confidence - a.confidence;
          if (Math.abs(confDiff) > 0.1) return confDiff;
          return b.lyrics.length - a.lyrics.length;
        });
        timer.success(`Found from ${validResults[0].source} via variant: ${v.a} - ${v.t}`);
        return {
          success: true,
          results: validResults,
          result: {
            ...validResults[0],
            artist: v.a,
            title: v.t,
            language: 'ko',
            hasTimestamps: false,
            searchTime: Date.now() - (timer as any).startTime
          }
        };
      }
      // small jitter between variant attempts
      await new Promise(r => setTimeout(r, 120));
    }
    // Fallback to search-engine pipeline (Perplexity+Groq) to bypass bot blocks
    try {
      const { searchEngine } = await import('../search-engine/utils');
      const se = await searchEngine({ artist, title, engine: 'perplexity' });
      if (se?.success && se.result) {
        timer.success('Fallback via Search Engine');
        return se;
      }
    } catch {}
    timer.fail('No results from any Korean site');
    return { success: false, error: 'Could not find lyrics from Korean sites' };
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Korean Sites error:', error);
    return {
      success: false,
      error: 'Korean site scraping failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}