/**
 * Parser utility functions for LRC processing
 */

/**
 * Format milliseconds to LRC timestamp format [mm:ss.xx]
 */
export function millisecondsToLRCTimestamp(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toFixed(2).padStart(5, '0');
  
  return `[${mm}:${ss}]`;
}

/**
 * Format milliseconds to extended LRC timestamp format <mm:ss.xx>
 */
export function millisecondsToWordTimestamp(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toFixed(2).padStart(5, '0');
  
  return `<${mm}:${ss}>`;
}

/**
 * Validate LRC timestamp format
 */
export function isValidLRCTimestamp(timestamp: string): boolean {
  return /^\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]$/.test(timestamp);
}

/**
 * Validate word timestamp format
 */
export function isValidWordTimestamp(timestamp: string): boolean {
  return /^<\d{1,2}:\d{2}(?:\.\d{1,3})?>$/.test(timestamp);
}

/**
 * Clean text by removing extra whitespace and normalizing
 */
export function cleanLyricText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\u200B/g, '') // Remove zero-width spaces
    .normalize('NFC'); // Normalize unicode
}

/**
 * Split text into words for basic word timing
 */
export function splitIntoWords(text: string): string[] {
  return cleanLyricText(text)
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Estimate word durations based on character count
 */
export function estimateWordDurations(
  words: string[], 
  totalDuration: number
): number[] {
  const totalChars = words.reduce((sum, word) => sum + word.length, 0);
  
  if (totalChars === 0) {
    return words.map(() => totalDuration / words.length);
  }
  
  return words.map(word => {
    const ratio = word.length / totalChars;
    return Math.max(100, Math.round(totalDuration * ratio)); // Min 100ms per word
  });
}

/**
 * Detect file encoding (simplified)
 */
export function detectEncoding(buffer: ArrayBuffer): string {
  const view = new DataView(buffer);
  
  // Check for BOM
  if (view.byteLength >= 3) {
    const byte1 = view.getUint8(0);
    const byte2 = view.getUint8(1);
    const byte3 = view.getUint8(2);
    
    // UTF-8 BOM
    if (byte1 === 0xEF && byte2 === 0xBB && byte3 === 0xBF) {
      return 'utf-8';
    }
    
    // UTF-16 BE BOM
    if (byte1 === 0xFE && byte2 === 0xFF) {
      return 'utf-16be';
    }
    
    // UTF-16 LE BOM
    if (byte1 === 0xFF && byte2 === 0xFE) {
      return 'utf-16le';
    }
  }
  
  // Default to UTF-8
  return 'utf-8';
}

/**
 * Convert buffer to string with encoding
 */
export function bufferToString(buffer: ArrayBuffer, encoding: string = 'utf-8'): string {
  const decoder = new TextDecoder(encoding);
  return decoder.decode(buffer);
}

/**
 * Escape special regex characters in a string
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the closest line for a given time
 */
export function findClosestLine(
  lines: Array<{ startTime: number; endTime: number }>,
  currentTime: number
): number {
  // First, check if we're within any line's time range
  for (let i = 0; i < lines.length; i++) {
    if (currentTime >= lines[i].startTime && currentTime < lines[i].endTime) {
      return i;
    }
  }
  
  // If not within any line, find the closest
  let closestIndex = 0;
  let closestDistance = Math.abs(currentTime - lines[0].startTime);
  
  for (let i = 1; i < lines.length; i++) {
    const distance = Math.abs(currentTime - lines[i].startTime);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = i;
    }
  }
  
  return closestIndex;
}

/**
 * Find the current word within a line
 */
export function findCurrentWord(
  words: Array<{ startTime: number; endTime: number }>,
  currentTime: number
): number {
  for (let i = 0; i < words.length; i++) {
    if (currentTime >= words[i].startTime && currentTime < words[i].endTime) {
      return i;
    }
  }
  
  // If past all words, return last word
  if (currentTime >= words[words.length - 1]?.endTime) {
    return words.length - 1;
  }
  
  // If before all words, return -1
  return -1;
}