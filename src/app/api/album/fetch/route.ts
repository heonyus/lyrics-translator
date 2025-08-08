import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';
import { detectDominantLang } from '@/app/api/lyrics/quality';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSecret } from '@/lib/secure-secrets';

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

async function llmDisplayMap(
  artist: string,
  title: string,
  enArtist?: string,
  enTitle?: string
): Promise<{ artistDisplay: string; titleDisplay: string } | null> {
  try {
    const apiKey = (await getSecret('google')) || process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!apiKey) return null;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const toUpperTight = (s?: string) => (s || '').replace(/\s+/g, '').toUpperCase();
    const prompt = [
      'You are a formatter for song metadata display. Return JSON only.',
      'Rules:',
      '- Keep ORIGINAL script as-is.',
      '- Append an ASCII English uppercase form in parentheses, with no spaces, e.g. "호시노겐(HOSHINOGEN)", "星野源(HOSHINOGEN)", "محمد عبد الوهاب(MOHAMMADABDALWAHHAB)", "แสตมป์อภิวัชร์(STAMPAPIWAT)".',
      '- Use provided English candidates if they exist; otherwise romanize accurately.',
      '- Never add explanations. Output strictly:\n{"artistDisplay":"...","titleDisplay":"..."}',
      '',
      'Few-shots:',
      'Input: artist="호시노겐", title="코이", enArtist="Hoshino Gen", enTitle="Koi"',
      'Output: {"artistDisplay":"호시노겐(HOSHINOGEN)","titleDisplay":"코이(KOI)"}',
      'Input: artist="星野源", title="恋", enArtist="Hoshino Gen", enTitle="Koi"',
      'Output: {"artistDisplay":"星野源(HOSHINOGEN)","titleDisplay":"恋(KOI)"}',
      'Input: artist="محمد عبد الوهاب", title="الحب", enArtist="Mohammad Abd Al Wahhab", enTitle="Al Hubb"',
      'Output: {"artistDisplay":"محمد عبد الوهاب(MOHAMMADABDALWAHHAB)","titleDisplay":"الحب(ALHUBB)"}',
      'Input: artist="แสตมป์ อภิวัชร์", title="ใจอ้วน", enArtist="Stamp Apiwat", enTitle="Jai Uan"',
      'Output: {"artistDisplay":"แสตมป์ อภิวัชร์(STAMPAPIWAT)","titleDisplay":"ใจอ้วน(JAIUAN)"}',
      '',
      `Input: artist="${artist}", title="${title}", enArtist="${enArtist || ''}", enTitle="${enTitle || ''}"`,
      'Output:'
    ].join('\n');

    const resp = await model.generateContent(prompt);
    const text = resp.response.text().trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    if (!parsed?.artistDisplay || !parsed?.titleDisplay) return null;
    // Ensure uppercase inside parens
    const up = (s: string) => s.replace(/\(([^)]+)\)/, (_m, p1) => `(${toUpperTight(p1)})`);
    return {
      artistDisplay: up(String(parsed.artistDisplay)),
      titleDisplay: up(String(parsed.titleDisplay))
    };
  } catch {
    return null;
  }
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
      const en = multi['us'];
      const jp = multi['jp'];
      // 1) 우선 LLM으로 다국어 표기 매핑 시도
      const llm = await llmDisplayMap(artist, title, en?.artistName, en?.trackName);
      let artistDisplay = llm?.artistDisplay || artist;
      let titleDisplay = llm?.titleDisplay || title;
      // 2) LLM 실패 시 간단한 백업 규칙(영문 병기 or 일본어 병기)
      if (!llm) {
        const script = detectDominantLang(`${artist} ${title}`);
        const jp = multi['jp'];
        const toUpperTight = (s?: string) => (s || '').replace(/\s+/g, '').toUpperCase();
        if (script === 'ko' || script === 'ja') {
          if (en?.artistName && en.artistName.toLowerCase() !== artist.toLowerCase()) artistDisplay = `${artist} (${toUpperTight(en.artistName)})`;
          if (en?.trackName && en.trackName.toLowerCase() !== title.toLowerCase()) titleDisplay = `${title} (${toUpperTight(en.trackName)})`;
        } else if (jp) {
          if (jp.artistName && jp.artistName.toLowerCase() !== artist.toLowerCase()) artistDisplay = `${artist} (${jp.artistName})`;
          if (jp.trackName && jp.trackName.toLowerCase() !== title.toLowerCase()) titleDisplay = `${title} (${jp.trackName})`;
        }
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