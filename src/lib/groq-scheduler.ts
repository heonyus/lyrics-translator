// Simple global scheduler and cooldown for Groq API usage
// Note: Works within a single Node process (dev/server). For serverless
// invocations, cooldown still helps skip Groq quickly across requests if reused.

type Task<T> = () => Promise<T>;

let inFlight = 0;
const queue: Array<() => void> = [];
let lastStart = 0;
let cooldownUntil = 0;

const MIN_INTERVAL_MS = Number(process.env.GROQ_MIN_INTERVAL_MS || 350);
const JITTER_MS = 150;
const COOLDOWN_MS = Number(process.env.GROQ_COOLDOWN_MS || 20000);

export function isGroqAvailable(): boolean {
  return Date.now() >= cooldownUntil;
}

export function reportGroq429() {
  cooldownUntil = Date.now() + COOLDOWN_MS;
}

export async function scheduleGroq<T>(task: Task<T>): Promise<T> {
  // wait for availability + spacing
  await new Promise<void>((resolve) => {
    const tryStart = () => {
      const now = Date.now();
      const sinceLast = now - lastStart;
      if (inFlight === 0 && sinceLast >= MIN_INTERVAL_MS) {
        inFlight = 1;
        lastStart = now;
        resolve();
      } else {
        queue.push(tryStart);
      }
    };
    tryStart();
  });

  try {
    return await task();
  } finally {
    inFlight = 0;
    const next = queue.shift();
    if (next) setTimeout(next, MIN_INTERVAL_MS + Math.floor(Math.random() * JITTER_MS));
  }
}

