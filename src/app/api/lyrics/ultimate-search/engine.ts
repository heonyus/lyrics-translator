import { APITimer, logger } from '@/lib/logger';
import { searchEngine } from '../../lyrics/search-engine/utils';
import { searchKoreanSites } from '../../lyrics/korean-scrapers/utils';

export interface EngineResult {
  source: string;
  lyrics: string;
  confidence: number;
  hasTimestamps: boolean;
  metadata?: any;
}

async function searchLRCLIBDirect(artist: string, title: string): Promise<EngineResult | null> {
  const timer = new APITimer('LRCLIB');
  try {
    const params = new URLSearchParams({ artist_name: artist, track_name: title });
    const url = `https://lrclib.net/api/search?${params}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'LyricsTranslator/1.0' } });
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      timer.skip('No results');
      return null;
    }
    const best = results[0];
    // prefer synced
    if (best?.syncedLyrics) {
      timer.success('Found synced');
      return { source: 'lrclib', lyrics: best.syncedLyrics, confidence: 0.95, hasTimestamps: true, metadata: { album: best.albumName } };
    }
    if (best?.plainLyrics) {
      timer.success('Found plain');
      return { source: 'lrclib', lyrics: best.plainLyrics, confidence: 0.85, hasTimestamps: false, metadata: { album: best.albumName } };
    }
    timer.skip('No lyrics payload');
    return null;
  } catch (e) {
    timer.fail(e instanceof Error ? e.message : 'Unknown');
    logger.error('[Engine] LRCLIB error', e);
    return null;
  }
}

export async function runUltimateEngine({ artist, title }: { artist: string; title: string; }): Promise<EngineResult[]> {
  const all: EngineResult[] = [];

  // 1) Korean official sites first (Bugs/Melon/Genie site parsers)
  try {
    const kr = await searchKoreanSites({ artist, title });
    if (kr?.success && kr.result?.lyrics) {
      all.push({
        source: kr.result.source || 'korean-sites',
        lyrics: kr.result.lyrics,
        confidence: kr.result.confidence || 0.92,
        hasTimestamps: !!kr.result.hasTimestamps,
        metadata: kr.result
      });
    }
  } catch (e) {
    logger.error('[Engine] Korean sites error', e);
  }

  // 2) Perplexity + Groq search engine pipeline
  try {
    const se = await searchEngine({ artist, title, engine: 'perplexity' });
    if (se?.success && se.result?.lyrics) {
      all.push({
        source: se.result.source || 'search-engine',
        lyrics: se.result.lyrics,
        confidence: se.result.confidence || 0.88,
        hasTimestamps: !!se.result.hasTimestamps,
        metadata: se.result
      });
    }
  } catch (e) {
    logger.error('[Engine] Search engine error', e);
  }

  // 3) LRCLIB fallback (timestamps 가능)
  try {
    const lrc = await searchLRCLIBDirect(artist, title);
    if (lrc) all.push(lrc);
  } catch (e) {
    logger.error('[Engine] LRCLIB fallback error', e);
  }

  return all;
}


