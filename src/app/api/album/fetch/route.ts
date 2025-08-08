import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';
import { detectDominantLang } from '@/app/api/lyrics/quality';

type ItunesResult = {
  trackName?: string;
  collectionName?: string; // album
  artistName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  trackNumber?: number;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(feat\.[^)]+\)/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreItunesMatch(inputArtist: string, inputTitle: string, r: ItunesResult): number {
  const a = normalize(inputArtist);
  const t = normalize(inputTitle);
  const ra = normalize(r.artistName || '');
  const rt = normalize(r.trackName || '');
  let score = 0;
  if (ra === a) score += 0.6; else if (ra.includes(a) || a.includes(ra)) score += 0.4;
  if (rt === t) score += 0.6; else if (rt.includes(t) || t.includes(rt)) score += 0.4;
  return score;
}

function upscaleArtwork(url?: string, size = 600): string {
  if (!url) return '';
  // Typical pattern: .../100x100bb.jpg → 600x600bb.jpg
  return url.replace(/\/[0-9]+x[0-9]+bb\./, `/${size}x${size}bb.`);
}

async function fetchFromItunesMulti(artist: string, title: string) {
  const q = encodeURIComponent(`${artist} ${title}`);
  const countries = ['kr', 'us', 'jp'];
  const out: Record<string, { album?: string; coverUrl?: string; releaseDate?: string; genre?: string; trackNumber?: number; artistName?: string; trackName?: string }> = {};
  for (const country of countries) {
    const url = `https://itunes.apple.com/search?term=${q}&entity=song&limit=10&country=${country}`;
    const res = await fetch(url).catch(() => null);
    if (!res || !res.ok) continue;
    const json = await res.json().catch(() => null);
    const results: ItunesResult[] = json?.results || [];
    if (!results.length) continue;
    results.sort((x, y) => scoreItunesMatch(artist, title, y) - scoreItunesMatch(artist, title, x));
    const best = results[0];
    if (!best) continue;
    out[country] = {
      album: best.collectionName || '',
      coverUrl: upscaleArtwork(best.artworkUrl100, 600),
      releaseDate: best.releaseDate || '',
      genre: best.primaryGenreName || '',
      trackNumber: best.trackNumber || 0,
      artistName: best.artistName,
      trackName: best.trackName,
    };
  }
  return out;
}

export async function POST(request: NextRequest) {
  const timer = new APITimer('Album Fetch');
  try {
    const { artist, title } = await request.json();
    if (!artist || !title) {
      timer.fail('missing-params');
      return NextResponse.json({ success: false, error: 'Artist and title are required' }, { status: 400 });
    }

    logger.info(`🎨 Fetching album info for: ${artist} - ${title}`);

    // 1) iTunes 우선 시도(무인증/간편) + 멀티 스토어 매핑
    const multi = await fetchFromItunesMulti(artist, title);
    const preferred = multi['kr'] || multi['us'] || multi['jp'];
    if (preferred) {
      // Display mapping: input 스크립트 기준으로 영어/일본어 병기
      const script = detectDominantLang(`${artist} ${title}`);
      const en = multi['us'];
      const jp = multi['jp'];
      let artistDisplay = artist;
      let titleDisplay = title;
      if (script === 'ko') {
        if (en?.artistName && en.artistName.toLowerCase() !== artist.toLowerCase()) artistDisplay = `${artist} (${en.artistName})`;
        if (en?.trackName && en.trackName.toLowerCase() !== title.toLowerCase()) titleDisplay = `${title} (${en.trackName})`;
      } else if (script === 'ja') {
        if (en?.artistName && en.artistName.toLowerCase() !== artist.toLowerCase()) artistDisplay = `${artist} (${en.artistName})`;
        if (en?.trackName && en.trackName.toLowerCase() !== title.toLowerCase()) titleDisplay = `${title} (${en.trackName})`;
      } else {
        // 영어 입력 등: 일본어가 있으면 병기
        if (jp?.artistName && jp.artistName.toLowerCase() !== artist.toLowerCase()) artistDisplay = `${artist} (${jp.artistName})`;
        if (jp?.trackName && jp.trackName.toLowerCase() !== title.toLowerCase()) titleDisplay = `${title} (${jp.trackName})`;
      }
      timer.success('Album info fetched from iTunes');
      return NextResponse.json({ success: true, albumInfo: { ...preferred, artistDisplay, titleDisplay, artistEn: en?.artistName, titleEn: en?.trackName, artistJa: jp?.artistName, titleJa: jp?.trackName } });
    }

    // 2) 실패 시 graceful degrade
    timer.skip('No album info found');
    return NextResponse.json({
      success: true,
      albumInfo: {
        album: '',
        coverUrl: '',
        releaseDate: '',
        genre: '',
        trackNumber: 0,
      },
    });
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Album fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch album info' }, { status: 500 });
  }
}