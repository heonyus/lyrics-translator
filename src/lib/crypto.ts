import crypto from 'crypto';

const ALG = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.API_KEY_ENCRYPTION_KEY || '';
  if (!raw) throw new Error('API_KEY_ENCRYPTION_KEY is not set');
  // Expect base64 or hex or plain; normalize to 32 bytes
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, 'base64');
  } catch {
    buf = Buffer.from(raw, 'utf8');
  }
  if (buf.length < 32) {
    const padded = Buffer.alloc(32);
    buf.copy(padded);
    buf = padded;
  } else if (buf.length > 32) {
    buf = buf.subarray(0, 32);
  }
  return buf;
}

export function encryptSecret(plainText: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as iv:ct:tag hex
  return `${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`;
}

export function decryptSecret(encPacked: string): string {
  const key = getKey();
  const [ivHex, ctHex, tagHex] = encPacked.split(':');
  if (!ivHex || !ctHex || !tagHex) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(ivHex, 'hex');
  const ct = Buffer.from(ctHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString('utf8');
}

