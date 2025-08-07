// Lightweight lyrics quality heuristics

export type Lang = 'ko' | 'ja' | 'zh' | 'en' | 'unknown';

export function detectDominantLang(text: string): Lang {
  const total = text.length || 1;
  const ko = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) || []).length;
  const ja = (text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
  const zh = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
  const en = (text.match(/[A-Za-z]/g) || []).length;
  const ratios: Array<{ k: Lang; v: number }> = [
    { k: 'ko', v: ko / total },
    { k: 'ja', v: ja / total },
    { k: 'zh', v: zh / total },
    { k: 'en', v: en / total }
  ];
  ratios.sort((a, b) => b.v - a.v);
  return ratios[0].v > 0.25 ? ratios[0].k : 'unknown';
}

export function normalizeLyrics(input: string): string {
  let s = input || '';
  // Normalize whitespace
  s = s.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
  s = s.replace(/\u00A0/g, ' ');
  // Collapse multiple spaces and excessive blank lines
  s = s.replace(/[ ]{2,}/g, ' ');
  s = s.split('\n').map(line => line.trimEnd()).join('\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

export function scoreLyrics(lyrics: string, expected?: Lang): number {
  if (!lyrics) return 0;
  const text = normalizeLyrics(lyrics);
  const len = text.length;
  if (len < 150) return 0.1;
  if (len > 15000) return 0.2;

  let score = 0.5;
  // Language alignment
  const dom = detectDominantLang(text);
  if (expected && expected !== 'unknown') {
    if (dom === expected) score += 0.2; else score -= 0.2;
  } else {
    if (dom !== 'unknown') score += 0.05;
  }

  // Timestamps boost
  if (/^\[\d{2}:\d{2}/m.test(text)) score += 0.25;

  // Penalize long English prose blocks (typical hallucination) when expected is CJK
  if ((expected === 'ko' || expected === 'ja' || expected === 'zh') && /\n\n[A-Za-z][\s\S]{120,}/.test(text)) {
    score -= 0.3;
  }

  // Penalize repeated identical lines
  const lines = text.split('\n').filter(Boolean);
  const map = new Map<string, number>();
  for (const ln of lines) {
    const k = ln.toLowerCase();
    map.set(k, (map.get(k) || 0) + 1);
  }
  const repeats = Array.from(map.values()).filter(v => v > 2).length;
  if (repeats > 3) score -= 0.15;

  // Penalize generic narrative phrases seen in hallucinations
  const badPhrases = [
    'in the autumn of my memories',
    "i'm left with just these memories",
    "i'll stand alone at gwanghwamun",
  ];
  const lower = text.toLowerCase();
  if (badPhrases.some(p => lower.includes(p))) score -= 0.35;

  // Clamp
  if (score < 0) score = 0;
  if (score > 1) score = 1;
  return score;
}

