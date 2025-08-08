#!/usr/bin/env node
// Simple API tester for local/prod with MCP cache checks

const mode = process.argv[2] || 'local';
const defaultProd = 'https://lyrics-translator-1mlhr8ffh-heonyus-team.vercel.app';
const base = mode === 'prod'
  ? (process.env.PROD_BASE_URL || defaultProd)
  : (process.env.BASE_URL || 'http://localhost:3000');

const artist = process.argv[3] || 'dori';
const title = process.argv[4] || '이 밤';

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
    { name: 'MCP Lyrics (miss→fill)', path: '/api/lyrics/mcp', body: { artist, title, bypassCache: true } },
    { name: 'MCP Lyrics (cache-hit)', path: '/api/lyrics/mcp', body: { artist, title } },
  ];

  for (const t of tests) {
    const r = await post(t.path, t.body);
    console.log(JSON.stringify({ test: t.name, base, path: t.path, status: r.status, ok: r.ok, ms: r.ms, result: r.json || r.error }, null, 2));
  }
})();

