import { decryptSecret, encryptSecret } from '@/lib/crypto';
import fs from 'fs';
import path from 'path';

type SecretProvider =
  | 'openai'
  | 'groq'
  | 'anthropic'
  | 'perplexity'
  | 'google'
  | 'soniox'
  | 'deepgram'
  | 'tavily'
  | 'assemblai'
  | 'github'
  | 'figma'
  | 'vercel'
  | 'supabase'
  | 'firecrawl';

export interface SecretRecord {
  id: string;
  provider: SecretProvider;
  key_name: string; // e.g., api_key
  value_enc: string; // iv:ct:tag
  created_at: string;
  updated_at: string;
}

const memoryCache = new Map<string, string>();
let localSecretsLoaded = false;
let localSecrets: Record<string, Record<string, string>> = {}; // provider -> key_name -> value_enc

function getLocalSecretsPath() {
  const p = process.env.LOCAL_SECRETS_FILE || '.secrets.enc.json';
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function loadLocalSecretsOnce() {
  if (localSecretsLoaded) return;
  if (typeof window !== 'undefined') return;
  const filePath = getLocalSecretsPath();
  if (!fs.existsSync(filePath)) {
    localSecretsLoaded = true;
    return;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      localSecrets = parsed;
    }
  } catch {
    // ignore
  } finally {
    localSecretsLoaded = true;
  }
}

function getFromLocal(provider: SecretProvider, keyName: string): string | null {
  loadLocalSecretsOnce();
  const enc = localSecrets[provider]?.[keyName];
  if (!enc) return null;
  try {
    return decryptSecret(enc);
  } catch {
    return null;
  }
}

function cacheKey(provider: string, keyName: string) {
  return `${provider}:${keyName}`;
}

export async function getSecret(provider: SecretProvider, keyName = 'api_key'): Promise<string | null> {
  const ck = cacheKey(provider, keyName);
  if (memoryCache.has(ck)) return memoryCache.get(ck)!;

  // Try env first for simplicity/override
  const envMap: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    anthropic: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
    perplexity: process.env.PERPLEXITY_API_KEY,
    google: process.env.GOOGLE_API_KEY,
    soniox: process.env.SONIOX_API_KEY,
    deepgram: process.env.DEEPGRAM_API_KEY,
    tavily: process.env.TAVILY_API_KEY,
    assemblai: process.env.ASSEMBLAI_API_KEY,
    github: process.env.GITHUB_TOKEN,
    figma: process.env.FIGMA_TOKEN,
    vercel: process.env.VERCEL_TOKEN,
    supabase: process.env.SUPABASE_SERVICE_ROLE,
    firecrawl: process.env.FIRECRAWL_API_KEY,
  };
  const fromEnv = envMap[provider];
  if (fromEnv) {
    memoryCache.set(ck, fromEnv);
    return fromEnv;
  }

  // Server-only: try Supabase admin client
  if (typeof window === 'undefined') {
    try {
      const { supabaseAdmin } = await import('@/lib/supabase');
      const admin = supabaseAdmin();
      const { data, error } = await admin
        .from('secure_secrets')
        .select('provider,key_name,value_enc')
        .eq('provider', provider)
        .eq('key_name', keyName)
        .maybeSingle();
      if (!error && data) {
        const value = decryptSecret(data.value_enc);
        memoryCache.set(ck, value);
        return value;
      }
    } catch {
      // fall through to local file
    }
    // Fallback: local encrypted secrets file
    const localVal = getFromLocal(provider, keyName);
    if (localVal) {
      memoryCache.set(ck, localVal);
      return localVal;
    }
  }
  return null;
}

export async function setSecret(provider: SecretProvider, keyName: string, plain: string) {
  if (typeof window !== 'undefined') throw new Error('Server-side only');
  const packed = encryptSecret(plain);
  const { supabaseAdmin } = await import('@/lib/supabase');
  const admin = supabaseAdmin();
  const { error } = await admin
    .from('secure_secrets')
    .upsert({ provider, key_name: keyName, value_enc: packed }, { onConflict: 'provider,key_name' });
  if (error) throw error;
  memoryCache.set(cacheKey(provider, keyName), plain);
}

