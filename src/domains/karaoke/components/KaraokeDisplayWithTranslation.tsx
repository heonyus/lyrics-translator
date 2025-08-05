'use client';

import React, { useEffect, useState } from 'react';
import { KaraokeDisplay } from './KaraokeDisplay';
import { ParsedLRC, LyricLine, WordTiming } from '@/domains/lyrics/types/lyrics.types';
import { useTranslation, SupportedLanguage } from '@/domains/translation';
import { cn } from '@/lib/utils';

interface KaraokeDisplayWithTranslationProps {
  lyrics: ParsedLRC | null;
  currentLine: LyricLine | null;
  currentWord: WordTiming | null;
  currentTime: number;
  targetLanguages: SupportedLanguage[];
  sourceLanguage?: SupportedLanguage;
  className?: string;
  highlightColor?: string;
  fontSize?: number;
  fontFamily?: string;
  animationType?: 'fade' | 'slide' | 'glow';
  onTranslationError?: (error: Error) => void;
}

export function KaraokeDisplayWithTranslation({
  lyrics,
  currentLine,
  currentWord,
  currentTime,
  targetLanguages,
  sourceLanguage,
  className,
  highlightColor = '#FFD700',
  fontSize = 24,
  fontFamily = 'Arial, sans-serif',
  animationType = 'fade',
  onTranslationError,
}: KaraokeDisplayWithTranslationProps) {
  const { translateBatch, isTranslating } = useTranslation({
    onError: onTranslationError,
  });
  
  const [translatedLyrics, setTranslatedLyrics] = useState<ParsedLRC | null>(null);
  const [currentTranslations, setCurrentTranslations] = useState<Map<string, string>>(new Map());
  
  // Translate lyrics when they change or target languages change
  useEffect(() => {
    if (!lyrics || targetLanguages.length === 0) {
      setTranslatedLyrics(lyrics);
      return;
    }
    
    const translateLyrics = async () => {
      // Extract all unique text from lyrics
      const textsToTranslate = lyrics.lines.map(line => line.text);
      
      // Translate to the first target language
      const result = await translateBatch(
        textsToTranslate,
        targetLanguages[0],
        sourceLanguage
      );
      
      if (result) {
        // Create a map of original text to translation
        const translationMap = new Map<string, string>();
        lyrics.lines.forEach((line, index) => {
          if (result.translations[index]) {
            translationMap.set(line.text, result.translations[index].translatedText);
          }
        });
        
        setCurrentTranslations(translationMap);
        
        // Create translated lyrics object
        const translated: ParsedLRC = {
          ...lyrics,
          lines: lyrics.lines.map(line => ({
            ...line,
            translation: translationMap.get(line.text) || line.text
          }))
        };
        
        setTranslatedLyrics(translated);
      }
    };
    
    translateLyrics();
  }, [lyrics, targetLanguages, sourceLanguage, translateBatch]);
  
  // Get current line with translation
  const currentLineWithTranslation = currentLine && translatedLyrics
    ? translatedLyrics.lines.find(line => line.id === currentLine.id) || currentLine
    : currentLine;
  
  return (
    <div className={cn('karaoke-display-with-translation', className)}>
      {isTranslating && (
        <div className="absolute top-2 right-2 text-sm text-gray-500">
          번역 중...
        </div>
      )}
      
      <KaraokeDisplay
        lyrics={translatedLyrics}
        currentLine={currentLineWithTranslation}
        currentWord={currentWord}
        currentTime={currentTime}
        highlightColor={highlightColor}
        fontSize={fontSize}
        fontFamily={fontFamily}
        showTranslation={true}
        animationType={animationType}
        className="w-full"
      />
      
      {targetLanguages.length > 1 && (
        <div className="mt-4 text-center text-sm text-gray-600">
          <span>추가 언어 사용 가능: </span>
          {targetLanguages.slice(1).map((lang, index) => (
            <span key={lang}>
              {index > 0 && ', '}
              {lang.toUpperCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}