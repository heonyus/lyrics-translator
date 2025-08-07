import { LyricLine, WordTiming } from '../types/lyrics.types';

// Binary search with lookahead for better performance
export function findClosestLine(lines: LyricLine[], currentTime: number, lastIndex: number = -1): number {
  if (!lines || lines.length === 0) return -1;
  
  // Quick check: if we have a last index, check nearby lines first
  if (lastIndex >= 0 && lastIndex < lines.length) {
    // Check current line
    if (lines[lastIndex].startTime <= currentTime && currentTime < lines[lastIndex].endTime) {
      return lastIndex;
    }
    
    // Check next line
    if (lastIndex + 1 < lines.length) {
      const nextLine = lines[lastIndex + 1];
      if (nextLine.startTime <= currentTime && currentTime < nextLine.endTime) {
        return lastIndex + 1;
      }
    }
    
    // Check if we're between lines (in a gap)
    if (lastIndex + 1 < lines.length) {
      const currentEnd = lines[lastIndex].endTime;
      const nextStart = lines[lastIndex + 1].startTime;
      if (currentTime >= currentEnd && currentTime < nextStart) {
        // Return the last line if we're closer to it, otherwise the next line
        const midPoint = (currentEnd + nextStart) / 2;
        return currentTime < midPoint ? lastIndex : lastIndex + 1;
      }
    }
  }
  
  // Binary search for efficiency with large datasets
  let left = 0;
  let right = lines.length - 1;
  let closestIndex = -1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const line = lines[mid];
    
    if (line.startTime <= currentTime && currentTime < line.endTime) {
      return mid;
    }
    
    if (currentTime < line.startTime) {
      right = mid - 1;
    } else {
      closestIndex = mid;
      left = mid + 1;
    }
  }
  
  // Handle edge cases
  if (closestIndex === -1 && lines.length > 0 && currentTime >= lines[0].startTime) {
    closestIndex = 0;
  }
  
  return closestIndex;
}

export function findCurrentWord(words: WordTiming[], currentTime: number, lastIndex: number = -1): number {
  if (!words || words.length === 0) return -1;
  
  // Quick check: if we have a last index, check nearby words first
  if (lastIndex >= 0 && lastIndex < words.length) {
    // Check current word
    const currentWord = words[lastIndex];
    if (currentWord.startTime <= currentTime && currentTime <= currentWord.endTime) {
      return lastIndex;
    }
    
    // Check next word
    if (lastIndex + 1 < words.length) {
      const nextWord = words[lastIndex + 1];
      if (nextWord.startTime <= currentTime && currentTime <= nextWord.endTime) {
        return lastIndex + 1;
      }
    }
  }
  
  // Binary search for efficiency
  let left = 0;
  let right = words.length - 1;
  let currentIndex = -1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const word = words[mid];
    
    if (word.startTime <= currentTime && currentTime <= word.endTime) {
      return mid;
    }
    
    if (currentTime < word.startTime) {
      right = mid - 1;
    } else {
      currentIndex = mid;
      left = mid + 1;
    }
  }
  
  return currentIndex;
}

// Calculate interpolated progress for smooth animations
export function getInterpolatedProgress(
  startTime: number,
  endTime: number,
  currentTime: number,
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'linear'
): number {
  if (currentTime <= startTime) return 0;
  if (currentTime >= endTime) return 1;
  
  const duration = endTime - startTime;
  const elapsed = currentTime - startTime;
  const progress = elapsed / duration;
  
  switch (easing) {
    case 'ease-in':
      return progress * progress;
    case 'ease-out':
      return 1 - (1 - progress) * (1 - progress);
    case 'ease-in-out':
      return progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    default:
      return progress;
  }
}

// Lookahead function to preload next lines for smoother transitions
export function getUpcomingLines(
  lines: LyricLine[],
  currentIndex: number,
  lookaheadCount: number = 2
): LyricLine[] {
  if (!lines || currentIndex < 0) return [];
  
  const upcoming: LyricLine[] = [];
  const endIndex = Math.min(currentIndex + lookaheadCount, lines.length - 1);
  
  for (let i = currentIndex + 1; i <= endIndex; i++) {
    upcoming.push(lines[i]);
  }
  
  return upcoming;
}

// Time adjustment for sync calibration
export function adjustTimeForLatency(
  currentTime: number,
  latencyMs: number = 0,
  offsetMs: number = 0
): number {
  return currentTime + latencyMs + offsetMs;
}