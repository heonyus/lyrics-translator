#!/usr/bin/env node
// Simple API tester for local/prod

const base = process.argv[2] === 'prod'
  ? 'https://lyrics-translator-o6pfsbl81-heonyus-team.vercel.app'
  : 'http://localhost:3001';

const artist = 'dori';
const title = '이 밤';

async function post(path, body) {
  const url = `${base}${path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const ms = Date.now() - started;
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { ok: res.ok, status: res.status, ms, json };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - started, error: e.message };
  }
}

(async () => {
  const tests = [
    { name: 'LLM Search', path: '/api/lyrics/llm-search', body: { artist, title } },
    { name: 'Search Engine', path: '/api/lyrics/search-engine', body: { artist, title, engine: 'auto' } },
    { name: 'Gemini Search', path: '/api/lyrics/gemini-search', body: { artist, title } },
    { name: 'Smart Scraper V2', path: '/api/lyrics/smart-scraper-v2', body: { artist, title } },
    { name: 'Smart Scraper V3', path: '/api/lyrics/smart-scraper-v3', body: { query: `${artist} - ${title}` } },
  ];

  for (const t of tests) {
    const r = await post(t.path, t.body);
    console.log(JSON.stringify({ test: t.name, base, path: t.path, status: r.status, ok: r.ok, ms: r.ms, result: r.json || r.error }, null, 2));
  }
})();

