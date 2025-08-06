'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ParsedLRC, LyricLine, WordTiming } from '../types/lyrics.types';
import { LRCParser } from '../services/lrc-parser';
import { findClosestLine, findCurrentWord } from '../utils/timing';

export interface LyricsPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  currentLineIndex: number;
  currentWordIndex: number;
  playbackRate: number;
  progress: number;
  frameDrops: number;
  lastUpdateTime: number;
}

export interface UseImprovedLyricsOptions {
  autoPlay?: boolean;
  playbackRate?: number;
  offset?: number;
  onLineChange?: (line: LyricLine | null, index: number) => void;
  onWordChange?: (word: WordTiming | null, index: number) => void;
  targetFPS?: number;
  interpolation?: boolean;
}

export interface UseImprovedLyricsReturn {
  lyrics: ParsedLRC | null;
  playbackState: LyricsPlaybackState;
  currentLine: LyricLine | null;
  currentWord: WordTiming | null;
  
  loadLRC: (content: string) => void;
  loadParsedLRC: (parsedLRC: ParsedLRC) => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setOffset: (offset: number) => void;
  setPlaybackRate: (rate: number) => void;
  reset: () => void;
  
  skipForward: (seconds?: number) => void;
  skipBackward: (seconds?: number) => void;
  togglePlayPause: () => void;
}

export function useImprovedLyrics(options: UseImprovedLyricsOptions = {}): UseImprovedLyricsReturn {
  const {
    autoPlay = false,
    playbackRate: initialRate = 1.0,
    offset: initialOffset = 0,
    onLineChange,
    onWordChange,
    targetFPS = 60,
    interpolation = true,
  } = options;
  
  const targetFrameTime = 1000 / targetFPS;
  
  // State
  const [lyrics, setLyrics] = useState<ParsedLRC | null>(null);
  const [playbackState, setPlaybackState] = useState<LyricsPlaybackState>({
    isPlaying: false,
    currentTime: 0,
    currentLineIndex: -1,
    currentWordIndex: -1,
    playbackRate: initialRate,
    progress: 0,
    frameDrops: 0,
    lastUpdateTime: 0,
  });
  const [offset, setOffsetState] = useState(initialOffset);
  
  // Refs
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);
  const parserRef = useRef(new LRCParser());
  const lastFrameTimeRef = useRef<number>(0);
  const frameDropCountRef = useRef<number>(0);
  
  // Performance monitoring
  const performanceMonitorRef = useRef({
    frameCount: 0,
    totalFrameTime: 0,
    lastSecond: 0,
  });
  
  // Computed values
  const currentLine = useMemo(() => {
    return lyrics && playbackState.currentLineIndex >= 0
      ? lyrics.lines[playbackState.currentLineIndex]
      : null;
  }, [lyrics, playbackState.currentLineIndex]);
    
  const currentWord = useMemo(() => {
    return currentLine && playbackState.currentWordIndex >= 0
      ? currentLine.words[playbackState.currentWordIndex]
      : null;
  }, [currentLine, playbackState.currentWordIndex]);
  
  // Load LRC content
  const loadLRC = useCallback((content: string) => {
    const parseResult = parserRef.current.parse(content);
    
    if (parseResult.success && parseResult.data) {
      setLyrics(parseResult.data);
      reset();
      
      if (autoPlay) {
        setTimeout(() => play(), 100);
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
      setTimeout(() => play(), 100);
    }
  }, [autoPlay]);
  
  // Improved animation loop with frame drop detection
  const animate = useCallback((timestamp: number) => {
    if (!lyrics || !startTimeRef.current) return;
    
    // Frame timing calculation
    const frameTime = timestamp - lastFrameTimeRef.current;
    if (lastFrameTimeRef.current && frameTime > targetFrameTime * 1.5) {
      frameDropCountRef.current++;
    }
    lastFrameTimeRef.current = timestamp;
    
    // Performance monitoring
    const currentSecond = Math.floor(timestamp / 1000);
    if (currentSecond !== performanceMonitorRef.current.lastSecond) {
      performanceMonitorRef.current.lastSecond = currentSecond;
      performanceMonitorRef.current.frameCount = 0;
      performanceMonitorRef.current.totalFrameTime = 0;
    }
    performanceMonitorRef.current.frameCount++;
    performanceMonitorRef.current.totalFrameTime += frameTime;
    
    // Calculate current time with high precision
    const elapsed = (timestamp - startTimeRef.current) * playbackState.playbackRate;
    const currentTime = pausedTimeRef.current + elapsed + offset;
    
    // Interpolation for smoother transitions
    const interpolatedTime = interpolation 
      ? currentTime + (frameTime * playbackState.playbackRate * 0.5)
      : currentTime;
    
    // Find current line with lookahead
    const lineIndex = findClosestLine(lyrics.lines, interpolatedTime);
    const line = lyrics.lines[lineIndex];
    
    // Find current word within the line
    let wordIndex = -1;
    if (line && line.words.length > 0) {
      wordIndex = findCurrentWord(line.words, interpolatedTime);
    }
    
    // Update state if changed
    setPlaybackState(prev => {
      const hasLineChanged = prev.currentLineIndex !== lineIndex;
      const hasWordChanged = prev.currentWordIndex !== wordIndex;
      const hasTimeChanged = Math.abs(prev.currentTime - currentTime) > 0.01;
      
      if (hasLineChanged || hasWordChanged || hasTimeChanged) {
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
          frameDrops: frameDropCountRef.current,
          lastUpdateTime: timestamp,
        };
      }
      
      return prev;
    });
    
    // Continue animation
    if (playbackState.isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [lyrics, offset, playbackState.playbackRate, playbackState.isPlaying, onLineChange, onWordChange, targetFrameTime, interpolation]);
  
  // Play with smooth start
  const play = useCallback(() => {
    if (!lyrics) return;
    
    // Reset frame timing
    lastFrameTimeRef.current = performance.now();
    frameDropCountRef.current = 0;
    
    startTimeRef.current = performance.now();
    
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: true,
    }));
  }, [lyrics]);
  
  // Pause with state preservation
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
  
  // Improved seek with instant update
  const seek = useCallback((time: number) => {
    pausedTimeRef.current = Math.max(0, time);
    
    if (playbackState.isPlaying) {
      startTimeRef.current = performance.now();
      lastFrameTimeRef.current = performance.now();
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
      
      // Trigger callbacks
      onLineChange?.(line, lineIndex);
      if (line) {
        onWordChange?.(line.words[wordIndex] || null, wordIndex);
      }
    }
  }, [lyrics, playbackState.isPlaying, onLineChange, onWordChange]);
  
  // Skip forward
  const skipForward = useCallback((seconds: number = 5) => {
    const newTime = playbackState.currentTime + seconds * 1000;
    seek(newTime);
  }, [playbackState.currentTime, seek]);
  
  // Skip backward
  const skipBackward = useCallback((seconds: number = 5) => {
    const newTime = playbackState.currentTime - seconds * 1000;
    seek(Math.max(0, newTime));
  }, [playbackState.currentTime, seek]);
  
  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (playbackState.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [playbackState.isPlaying, play, pause]);
  
  // Set offset
  const setOffset = useCallback((newOffset: number) => {
    setOffsetState(newOffset);
  }, []);
  
  // Set playback rate with smooth transition
  const setPlaybackRate = useCallback((rate: number) => {
    // Adjust paused time to maintain current position
    if (startTimeRef.current) {
      const elapsed = (performance.now() - startTimeRef.current) * playbackState.playbackRate;
      pausedTimeRef.current += elapsed;
      startTimeRef.current = performance.now();
      lastFrameTimeRef.current = performance.now();
    }
    
    setPlaybackState(prev => ({
      ...prev,
      playbackRate: rate,
    }));
  }, [playbackState.playbackRate]);
  
  // Reset with cleanup
  const reset = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
    lastFrameTimeRef.current = 0;
    frameDropCountRef.current = 0;
    
    setPlaybackState({
      isPlaying: false,
      currentTime: 0,
      currentLineIndex: -1,
      currentWordIndex: -1,
      playbackRate: initialRate,
      progress: 0,
      frameDrops: 0,
      lastUpdateTime: 0,
    });
  }, [initialRate]);
  
  // Start/stop animation loop with improved timing
  useEffect(() => {
    if (playbackState.isPlaying && lyrics) {
      lastFrameTimeRef.current = performance.now();
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
    
    // New actions
    skipForward,
    skipBackward,
    togglePlayPause,
  };
}