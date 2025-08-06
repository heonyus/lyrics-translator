"use client";

import React, { useState, useEffect, useRef } from 'react';
import { KaraokeDisplay } from '@/domains/karaoke';
import { useKaraokePlayback } from '@/domains/karaoke/hooks/useKaraokePlayback';
import { useLyrics } from '@/domains/lyrics';
import { useTranslation } from '@/domains/translation';
import { Line } from '@/domains/lyrics/types';
import { motion, AnimatePresence } from 'framer-motion';

// 오버레이 설정을 URL 파라미터로 받음
interface OverlaySettings {
  fontSize: number;
  primaryColor: string;
  secondaryColor: string;
  showTranslation: boolean;
  translationLang: string;
  position: 'top' | 'center' | 'bottom';
  animation: 'fade' | 'slide' | 'none';
}

export default function SimpleOverlayPage() {
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  
  // URL 파라미터에서 설정 읽기
  const settings: OverlaySettings = {
    fontSize: parseInt(searchParams.get('fontSize') || '48'),
    primaryColor: searchParams.get('primaryColor') || '#FFFFFF',
    secondaryColor: searchParams.get('secondaryColor') || '#FFD700',
    showTranslation: searchParams.get('showTranslation') !== 'false',
    translationLang: searchParams.get('lang') || 'en',
    position: (searchParams.get('position') || 'bottom') as 'top' | 'center' | 'bottom',
    animation: (searchParams.get('animation') || 'fade') as 'fade' | 'slide' | 'none',
  };

  const { lyrics, loadLRC } = useLyrics();
  const { translate } = useTranslation();
  const { currentLineIndex, currentWordIndex, isPlaying, play, pause, reset } = useKaraokePlayback(lyrics);
  
  const [currentLine, setCurrentLine] = useState<Line | null>(null);
  const [nextLine, setNextLine] = useState<Line | null>(null);
  const [translation, setTranslation] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  // 가사 파일 로드 (로컬 스토리지나 URL에서)
  useEffect(() => {
    const loadLyrics = async () => {
      // 로컬 스토리지에서 가사 확인
      const storedLRC = localStorage.getItem('current_lrc');
      const storedTitle = localStorage.getItem('current_title');
      const storedArtist = localStorage.getItem('current_artist');
      
      if (storedLRC) {
        try {
          await loadLRC(storedLRC);
          setIsReady(true);
        } catch (error) {
          console.error('Failed to load lyrics:', error);
        }
      }
    };

    loadLyrics();

    // 로컬 스토리지 변경 감지
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'current_lrc' || e.key === 'control_command') {
        loadLyrics();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadLRC]);

  // 현재 라인 업데이트
  useEffect(() => {
    if (lyrics && lyrics.lines.length > currentLineIndex) {
      setCurrentLine(lyrics.lines[currentLineIndex] as any);
      
      // 다음 라인 설정
      if (currentLineIndex + 1 < lyrics.lines.length) {
        setNextLine(lyrics.lines[currentLineIndex + 1] as any);
      } else {
        setNextLine(null);
      }
    }
  }, [lyrics, currentLineIndex]);

  // 번역 업데이트
  useEffect(() => {
    const updateTranslation = async () => {
      if (currentLine && settings.showTranslation) {
        const translatedText = await translate(
          currentLine.text,
          settings.translationLang as any
        );
        if (translatedText?.translatedText) {
          setTranslation(translatedText.translatedText);
        }
      }
    };

    updateTranslation();
  }, [currentLine, settings.showTranslation, settings.translationLang, translate]);

  // 컨트롤 명령 처리
  useEffect(() => {
    const handleControl = (e: StorageEvent) => {
      if (e.key === 'control_command') {
        const command = e.newValue;
        switch (command) {
          case 'play':
            play();
            break;
          case 'pause':
            pause();
            break;
          case 'reset':
            reset();
            break;
        }
      }
    };

    window.addEventListener('storage', handleControl);
    return () => window.removeEventListener('storage', handleControl);
  }, [play, pause, reset]);

  // 위치 클래스
  const positionClasses = {
    top: 'top-20',
    center: 'top-1/2 -translate-y-1/2',
    bottom: 'bottom-20',
  };

  // 애니메이션 설정
  const animationVariants = {
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    slide: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -20 },
    },
    none: {
      initial: {},
      animate: {},
      exit: {},
    },
  };

  if (!isReady || !lyrics) {
    return null; // 투명 배경 유지
  }

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* 메인 가사 표시 영역 */}
      <div className={`absolute left-0 right-0 ${positionClasses[settings.position]} px-10`}>
        <AnimatePresence mode="wait">
          {currentLine && (
            <motion.div
              key={currentLineIndex}
              variants={animationVariants[settings.animation]}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              {/* 현재 가사 라인 */}
              <div 
                className="mb-4"
                style={{
                  fontSize: `${settings.fontSize}px`,
                  lineHeight: 1.2,
                  textShadow: `
                    0 0 10px rgba(0,0,0,0.8),
                    0 0 20px rgba(0,0,0,0.6),
                    0 0 30px rgba(0,0,0,0.4),
                    2px 2px 4px rgba(0,0,0,1)
                  `,
                }}
              >
                {currentLine.words ? (
                  // 단어별 하이라이팅
                  currentLine.words.map((word, idx) => (
                    <span
                      key={idx}
                      style={{
                        color: idx <= currentWordIndex ? settings.secondaryColor : settings.primaryColor,
                        fontWeight: idx <= currentWordIndex ? 'bold' : 'normal',
                        transition: 'all 0.2s ease',
                        textShadow: idx <= currentWordIndex 
                          ? `0 0 20px ${settings.secondaryColor}66` 
                          : 'inherit',
                      }}
                    >
                      {word.text}
                      {idx < currentLine.words!.length - 1 && ' '}
                    </span>
                  ))
                ) : (
                  // 전체 텍스트
                  <span
                    style={{
                      color: settings.primaryColor,
                      fontWeight: 'bold',
                    }}
                  >
                    {currentLine.text}
                  </span>
                )}
              </div>

              {/* 번역 */}
              {settings.showTranslation && translation && (
                <div
                  style={{
                    fontSize: `${settings.fontSize * 0.7}px`,
                    color: settings.primaryColor,
                    opacity: 0.9,
                    textShadow: `
                      0 0 10px rgba(0,0,0,0.8),
                      0 0 20px rgba(0,0,0,0.6),
                      2px 2px 4px rgba(0,0,0,1)
                    `,
                  }}
                >
                  {translation}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 다음 라인 미리보기 (옵션) */}
        {nextLine && searchParams.get('showNext') === 'true' && (
          <div
            className="text-center mt-8 opacity-50"
            style={{
              fontSize: `${settings.fontSize * 0.6}px`,
              color: settings.primaryColor,
              textShadow: `
                0 0 10px rgba(0,0,0,0.8),
                2px 2px 4px rgba(0,0,0,1)
              `,
            }}
          >
            {nextLine.text}
          </div>
        )}
      </div>

      {/* 진행 바 (옵션) */}
      {searchParams.get('showProgress') === 'true' && lyrics && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${((currentLineIndex + 1) / lyrics.lines.length) * 100}%`,
              backgroundColor: settings.secondaryColor,
              boxShadow: `0 0 10px ${settings.secondaryColor}66`,
            }}
          />
        </div>
      )}
    </div>
  );
}