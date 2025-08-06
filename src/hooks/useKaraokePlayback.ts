import { useState, useEffect, useCallback, useRef } from 'react';

export function useKaraokePlayback(lyrics: any) {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  const play = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    setCurrentLineIndex(0);
    setCurrentWordIndex(0);
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    currentLineIndex,
    currentWordIndex,
    isPlaying,
    play,
    pause,
    reset
  };
}