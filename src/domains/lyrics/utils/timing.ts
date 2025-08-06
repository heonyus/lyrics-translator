import { LyricLine, WordTiming } from '../types/lyrics.types';

export function findClosestLine(lines: LyricLine[], currentTime: number): number {
  if (!lines || lines.length === 0) return -1;
  
  let closestIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startTime <= currentTime && currentTime < lines[i].endTime) {
      return i;
    } else if (lines[i].endTime <= currentTime) {
      closestIndex = i;
    }
  }
  
  return closestIndex;
}

export function findCurrentWord(words: WordTiming[], currentTime: number): number {
  if (!words || words.length === 0) return -1;
  
  let currentIndex = -1;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word.startTime <= currentTime && currentTime <= word.endTime) {
      return i;
    } else if (word.endTime < currentTime) {
      currentIndex = i;
    }
  }
  
  return currentIndex;
}