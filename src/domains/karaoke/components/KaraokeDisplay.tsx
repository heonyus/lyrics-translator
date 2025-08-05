'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ParsedLRC, LyricLine, WordTiming } from '@/domains/lyrics/types/lyrics.types';
import { cn } from '@/lib/utils';

interface KaraokeDisplayProps {
  lyrics: ParsedLRC | null;
  currentLine: LyricLine | null;
  currentWord: WordTiming | null;
  currentTime: number;
  className?: string;
  highlightColor?: string;
  fontSize?: number;
  fontFamily?: string;
  showTranslation?: boolean;
  animationType?: 'fade' | 'slide' | 'glow';
}

export function KaraokeDisplay({
  lyrics,
  currentLine,
  currentWord,
  currentTime,
  className,
  highlightColor = '#FFD700',
  fontSize = 24,
  fontFamily = 'Arial, sans-serif',
  showTranslation = true,
  animationType = 'fade',
}: KaraokeDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate word progress
  const wordProgress = useMemo(() => {
    if (!currentWord) return 0;
    
    const progress = (currentTime - currentWord.startTime) / currentWord.duration;
    return Math.max(0, Math.min(1, progress));
  }, [currentTime, currentWord]);
  
  // Get surrounding lines for context
  const visibleLines = useMemo(() => {
    if (!lyrics || !currentLine) return [];
    
    const currentIndex = lyrics.lines.findIndex(line => line.id === currentLine.id);
    if (currentIndex === -1) return [];
    
    const prevLine = currentIndex > 0 ? lyrics.lines[currentIndex - 1] : null;
    const nextLine = currentIndex < lyrics.lines.length - 1 ? lyrics.lines[currentIndex + 1] : null;
    
    return [prevLine, currentLine, nextLine].filter(Boolean) as LyricLine[];
  }, [lyrics, currentLine]);
  
  // Animation variants
  const lineVariants = {
    fade: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -20 },
    },
    slide: {
      initial: { x: 100, opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: -100, opacity: 0 },
    },
    glow: {
      initial: { opacity: 0, scale: 0.9 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 1.1 },
    },
  };
  
  const variants = lineVariants[animationType];
  
  // Render a single line with word highlighting
  const renderLine = (line: LyricLine, isActive: boolean) => {
    return (
      <div className={cn(
        'karaoke-line',
        'transition-all duration-300',
        isActive ? 'opacity-100 scale-100' : 'opacity-50 scale-95'
      )}>
        <div className="flex flex-wrap gap-1 justify-center">
          {line.words.map((word, wordIndex) => {
            const isCurrentWord = isActive && currentWord?.word === word.word;
            const isPastWord = isActive && currentTime > word.endTime;
            const isFutureWord = isActive && currentTime < word.startTime;
            
            return (
              <span
                key={`${line.id}-word-${wordIndex}`}
                className={cn(
                  'karaoke-word',
                  'relative inline-block transition-all duration-300',
                  isPastWord && 'text-opacity-80',
                  isFutureWord && 'text-opacity-40'
                )}
                style={{
                  fontSize: `${fontSize}px`,
                  fontFamily,
                  color: isPastWord ? highlightColor : 'currentColor',
                }}
              >
                {isCurrentWord && (
                  <span
                    className="absolute inset-0 overflow-hidden"
                    style={{
                      color: highlightColor,
                      width: `${wordProgress * 100}%`,
                    }}
                  >
                    <span className="absolute">{word.word}</span>
                  </span>
                )}
                <span className={cn(
                  isCurrentWord && animationType === 'glow' && 'animate-pulse'
                )}>
                  {word.word}
                </span>
              </span>
            );
          })}
        </div>
        
        {showTranslation && line.translation && (
          <div 
            className="karaoke-translation mt-2 text-center opacity-70"
            style={{
              fontSize: `${fontSize * 0.8}px`,
              fontFamily,
            }}
          >
            {line.translation}
          </div>
        )}
      </div>
    );
  };
  
  // Auto-scroll to keep current line in view
  useEffect(() => {
    if (containerRef.current && currentLine) {
      const activeElement = containerRef.current.querySelector('.karaoke-line:nth-child(2)');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentLine]);
  
  if (!lyrics) {
    return (
      <div className={cn('karaoke-display', className)}>
        <div className="text-center text-gray-500">
          가사가 로드되지 않았습니다
        </div>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      className={cn(
        'karaoke-display',
        'relative overflow-hidden',
        className
      )}
    >
      <AnimatePresence mode="wait">
        {visibleLines.map((line, index) => {
          const isActive = line.id === currentLine?.id;
          const lineKey = `line-${line.id}`;
          
          return (
            <motion.div
              key={lineKey}
              className={cn(
                'karaoke-line-container',
                'py-4',
                index === 0 && 'opacity-50',
                index === 2 && 'opacity-50'
              )}
              initial={variants.initial}
              animate={variants.animate}
              exit={variants.exit}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              {renderLine(line, isActive)}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}