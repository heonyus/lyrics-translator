import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format time in seconds to LRC timestamp format [mm:ss.xx]
 */
export function formatLRCTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const mm = minutes.toString().padStart(2, '0');
  const ss = secs.toFixed(2).padStart(5, '0');
  return `[${mm}:${ss}]`;
}

/**
 * Parse LRC timestamp [mm:ss.xx] to seconds
 */
export function parseLRCTimestamp(timestamp: string): number {
  const match = timestamp.match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
  if (!match) return 0;
  
  const minutes = parseInt(match[1], 10);
  const seconds = parseFloat(match[2]);
  return minutes * 60 + seconds;
}

/**
 * Interpolate between two values based on progress
 */
export function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Format milliseconds to human readable time
 */
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Check if running in browser
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get URL parameter value
 */
export function getURLParam(param: string): string | null {
  if (!isBrowser()) return null;
  
  const params = new URLSearchParams(window.location.search);
  return params.get(param);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!isBrowser() || !navigator.clipboard) return false;
  
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}