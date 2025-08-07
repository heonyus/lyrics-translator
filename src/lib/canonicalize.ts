import { APITimer } from '@/lib/logger';

export async function resolveCanonicalPPLX(artist: string, title: string): Promise<{ artist: string; title: string } | null> {
  try {
    const timer = new APITimer('Canonicalize');
    const { getSecret } = await import('@/lib/secure-secrets');
    const PPLX_KEY = (await getSecret('perplexity')) || process.env.PERPLEXITY_API_KEY;
    if (!PPLX_KEY) return null;
    const prompt = [
      'Normalize this music query to canonical artist and track title.',
      'Return strict JSON: {"artist":"...","title":"..."}.',
      `Artist: ${artist}`,
      `Title: ${title}`
    ].join('\n');
    const resp = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PPLX_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.PERPLEXITY_MODEL || 'gpt-4.1', messages: [{ role: 'user', content: prompt }], temperature: 0.0, max_tokens: 200, response_format: { type: 'json_object' } })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content);
    if (parsed?.artist && parsed?.title) {
      timer.success('Canonicalized');
      return { artist: String(parsed.artist), title: String(parsed.title) };
    }
    return null;
  } catch {
    return null;
  }
}

export function buildGenericTitleVariants(title: string): string[] {
  const t = String(title || '').trim();
  const variants = new Set<string>([t]);
  // unify quotes variants (e.g., o'clock ↔ oclock)
  variants.add(t.replace(/['’]/g, ''));
  variants.add(t.replace(/['’]/g, "'"));
  // collapse/expand spaces
  variants.add(t.replace(/\s+/g, ' ').trim());
  variants.add(t.replace(/\s+/g, ''));
  return Array.from(variants);
}

