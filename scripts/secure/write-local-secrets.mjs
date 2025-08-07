#!/usr/bin/env node
// Encrypt selected keys from .env.local into .secrets.enc.json (local fallback)
// Requires: API_KEY_ENCRYPTION_KEY

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function assertEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

const ENC_KEY_RAW = assertEnv('API_KEY_ENCRYPTION_KEY');

function getKey(raw) {
  let buf;
  try { buf = Buffer.from(raw, 'base64'); } catch { buf = Buffer.from(raw, 'utf8'); }
  if (buf.length < 32) { const p = Buffer.alloc(32); buf.copy(p); buf = p; }
  if (buf.length > 32) buf = buf.subarray(0, 32);
  return buf;
}

function encryptSecret(plain, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${ct.toString('hex')}:${tag.toString('hex')}`;
}

function parseDotenv(content) {
  const lines = content.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val) out[key] = val;
  }
  return out;
}

const KEY_MAP = {
  OPENAI_API_KEY: ['openai', 'api_key'],
  GROQ_API_KEY: ['groq', 'api_key'],
  CLAUDE_API_KEY: ['anthropic', 'api_key'],
  ANTHROPIC_API_KEY: ['anthropic', 'api_key'],
  PERPLEXITY_API_KEY: ['perplexity', 'api_key'],
  GOOGLE_API_KEY: ['google', 'api_key'],
  SONIOX_API_KEY: ['soniox', 'api_key'],
  DEEPGRAM_API_KEY: ['deepgram', 'api_key'],
  TAVILY_API_KEY: ['tavily', 'api_key'],
  ASSEMBLAI_API_KEY: ['assemblai', 'api_key'],
};

function main() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error(`.env.local not found at ${envPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(envPath, 'utf8');
  const pairs = parseDotenv(raw);
  const key = getKey(ENC_KEY_RAW);

  const out = {};
  for (const [k, v] of Object.entries(pairs)) {
    if (!KEY_MAP[k]) continue;
    const [provider, key_name] = KEY_MAP[k];
    out[provider] ||= {};
    out[provider][key_name] = encryptSecret(v, key);
  }

  const outPath = path.resolve(process.cwd(), process.env.LOCAL_SECRETS_FILE || '.secrets.enc.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote encrypted secrets to ${outPath}`);
}

main();

