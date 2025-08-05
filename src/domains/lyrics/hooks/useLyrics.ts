/**
 * React hook for lyrics playback and synchronization
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ParsedLRC, LyricLine, WordTiming, LyricsPlaybackState } from '../types/lyrics.types';
import { LRCParser } from '../parser/lrc-parser';
import { findClosestLine, findCurrentWord } from '../parser/parser-utils';

interface UseLyricsOptions {
  autoPlay?: boolean;
  playbackRate?: number;
  offset?: number; // Manual timing offset in milliseconds
  onLineChange?: (line: LyricLine | null, index: number) => void;
  onWordChange?: (word: WordTiming | null, index: number) => void;
}

interface UseLyricsReturn {
  // State
  lyrics: ParsedLRC | null;
  playbackState: LyricsPlaybackState;
  currentLine: LyricLine | null;
  currentWord: WordTiming | null;
  
  // Actions
  loadLRC: (content: string) => void;
  loadParsedLRC: (parsedLRC: ParsedLRC) => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setOffset: (offset: number) => void;
  setPlaybackRate: (rate: number) => void;
  reset: () => void;
}

export function useLyrics(options: UseLyricsOptions = {}): UseLyricsReturn {
  const {
    autoPlay = false,
    playbackRate: initialRate = 1.0,
    offset: initialOffset = 0,
    onLineChange,
    onWordChange,
  } = options;
  
  // State
  const [lyrics, setLyrics] = useState<ParsedLRC | null>(null);
  const [playbackState, setPlaybackState] = useState<LyricsPlaybackState>({
    isPlaying: false,
    currentTime: 0,
    currentLineIndex: -1,
    currentWordIndex: -1,
    playbackRate: initialRate,
    progress: 0,
  });
  const [offset, setOffsetState] = useState(initialOffset);
  
  // Refs
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);
  const parserRef = useRef(new LRCParser());
  
  // Computed values
  const currentLine = lyrics && playbackState.currentLineIndex >= 0
    ? lyrics.lines[playbackState.currentLineIndex]
    : null;
    
  const currentWord = currentLine && playbackState.currentWordIndex >= 0
    ? currentLine.words[playbackState.currentWordIndex]
    : null;
  
  // Load LRC content
  const loadLRC = useCallback((content: string) => {
    const parseResult = parserRef.current.parse(content);
    
    if (parseResult.success && parseResult.data) {
      setLyrics(parseResult.data);
      reset();
      
      if (autoPlay) {
        play();
      }
    } else {
      console.error('Failed to parse LRC:', parseResult.error);
    }
  }, [autoPlay]);
  
  // Load parsed LRC directly
  const loadParsedLRC = useCallback((parsedLRC: ParsedLRC) => {
    setLyrics(parsedLRC);
    reset();
    
    if (autoPlay) {
      play();
    }
  }, [autoPlay]);
  
  // Animation loop
  const animate = useCallback(() => {
    if (!lyrics || !startTimeRef.current) return;
    
    const elapsed = (performance.now() - startTimeRef.current) * playbackState.playbackRate;
    const currentTime = pausedTimeRef.current + elapsed + offset;
    
    // Find current line
    const lineIndex = findClosestLine(lyrics.lines, currentTime);
    const line = lyrics.lines[lineIndex];
    
    // Find current word within the line
    let wordIndex = -1;
    if (line && line.words.length > 0) {
      wordIndex = findCurrentWord(line.words, currentTime);
    }
    
    // Update state if changed
    setPlaybackState(prev => {
      const hasLineChanged = prev.currentLineIndex !== lineIndex;
      const hasWordChanged = prev.currentWordIndex !== wordIndex;
      
      if (hasLineChanged || hasWordChanged || prev.currentTime !== currentTime) {
        // Trigger callbacks
        if (hasLineChanged) {
          onLineChange?.(line, lineIndex);
        }
        if (hasWordChanged && line) {
          onWordChange?.(line.words[wordIndex] || null, wordIndex);
        }
        
        const progress = lyrics.totalDuration > 0 
          ? (currentTime / lyrics.totalDuration) * 100 
          : 0;
        
        return {
          ...prev,
          currentTime,
          currentLineIndex: lineIndex,
          currentWordIndex: wordIndex,
          progress: Math.min(100, Math.max(0, progress)),
        };
      }
      
      return prev;
    });
    
    // Continue animation
    if (playbackState.isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [lyrics, offset, playbackState.playbackRate, playbackState.isPlaying, onLineChange, onWordChange]);
  
  // Play
  const play = useCallback(() => {
    if (!lyrics) return;
    
    startTimeRef.current = performance.now();
    
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: true,
    }));
  }, [lyrics]);
  
  // Pause
  const pause = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (startTimeRef.current) {
      const elapsed = (performance.now() - startTimeRef.current) * playbackState.playbackRate;
      pausedTimeRef.current += elapsed;
      startTimeRef.current = null;
    }
    
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: false,
    }));
  }, [playbackState.playbackRate]);
  
  // Seek
  const seek = useCallback((time: number) => {
    pausedTimeRef.current = Math.max(0, time);
    
    if (playbackState.isPlaying) {
      startTimeRef.current = performance.now();
    }
    
    // Update current position immediately
    if (lyrics) {
      const lineIndex = findClosestLine(lyrics.lines, time);
      const line = lyrics.lines[lineIndex];
      let wordIndex = -1;
      
      if (line && line.words.length > 0) {
        wordIndex = findCurrentWord(line.words, time);
      }
      
      const progress = lyrics.totalDuration > 0 
        ? (time / lyrics.totalDuration) * 100 
        : 0;
      
      setPlaybackState(prev => ({
        ...prev,
        currentTime: time,
        currentLineIndex: lineIndex,
        currentWordIndex: wordIndex,
        progress: Math.min(100, Math.max(0, progress)),
      }));
    }
  }, [lyrics, playbackState.isPlaying]);
  
  // Set offset
  const setOffset = useCallback((newOffset: number) => {
    setOffsetState(newOffset);
  }, []);
  
  // Set playback rate
  const setPlaybackRate = useCallback((rate: number) => {
    // Adjust paused time to maintain current position
    if (startTimeRef.current) {
      const elapsed = (performance.now() - startTimeRef.current) * playbackState.playbackRate;
      pausedTimeRef.current += elapsed;
      startTimeRef.current = performance.now();
    }
    
    setPlaybackState(prev => ({
      ...prev,
      playbackRate: rate,
    }));
  }, [playbackState.playbackRate]);
  
  // Reset
  const reset = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
    
    setPlaybackState({
      isPlaying: false,
      currentTime: 0,
      currentLineIndex: -1,
      currentWordIndex: -1,
      playbackRate: initialRate,
      progress: 0,
    });
  }, [initialRate]);
  
  // Start/stop animation loop
  useEffect(() => {
    if (playbackState.isPlaying && lyrics) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [playbackState.isPlaying, lyrics, animate]);
  
  return {
    // State
    lyrics,
    playbackState,
    currentLine,
    currentWord,
    
    // Actions
    loadLRC,
    loadParsedLRC,
    play,
    pause,
    seek,
    setOffset,
    setPlaybackRate,
    reset,
  };
}