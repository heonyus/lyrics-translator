"use client";

import React, { useState, useEffect } from 'react';
import { useKaraokePlayback } from '@/domains/karaoke/hooks/useKaraokePlayback';
import { useImprovedLyrics } from '@/domains/lyrics/hooks/useImprovedLyrics';
import { Line } from '@/domains/lyrics/types';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function OBSOverlayPage() {
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  
  // 크로마키 설정 (기본값: 녹색)
  const chromaKey = searchParams.get('chromaKey') || '#00FF00';
  const fontSize = parseInt(searchParams.get('fontSize') || '60');
  const textColor = searchParams.get('textColor') || '#FFFFFF';
  const highlightColor = searchParams.get('highlightColor') || '#FFD700';
  const targetLang = searchParams.get('lang') || 'en';
  const showTranslation = searchParams.get('showTranslation') !== 'false';
  
  const { 
    lyrics, 
    loadLRC, 
    playbackState,
    play, 
    pause, 
    reset,
    togglePlayPause,
    skipForward,
    skipBackward,
    setPlaybackRate,
    currentLine: lyricsCurrentLine,
    currentWord
  } = useImprovedLyrics({
    autoPlay: false,
    targetFPS: 60,
    interpolation: true,
  });
  
  const [currentLine, setCurrentLine] = useState<Line | null>(null);
  const [translation, setTranslation] = useState<string>('');
  const [lyricsId, setLyricsId] = useState<string | null>(null);
  const [showTranslationState, setShowTranslationState] = useState(showTranslation);
  
  // 키보드 단축키 설정
  useKeyboardShortcuts({
    onPlayPause: togglePlayPause,
    onReset: reset,
    onSkipForward: () => skipForward(5),
    onSkipBackward: () => skipBackward(5),
    onStop: () => {
      pause();
      reset();
    },
    onSpeedUp: () => setPlaybackRate(Math.min(2, playbackState.playbackRate + 0.1)),
    onSpeedDown: () => setPlaybackRate(Math.max(0.5, playbackState.playbackRate - 0.1)),
    onToggleTranslation: () => setShowTranslationState(prev => !prev),
    enabled: true,
  });

  // 가사 로드 및 저장
  useEffect(() => {
    const loadAndSaveLyrics = async () => {
      const storedLRC = localStorage.getItem('current_lrc');
      const storedTitle = localStorage.getItem('current_title');
      const storedArtist = localStorage.getItem('current_artist');
      
      if (storedLRC && storedTitle && storedArtist) {
        try {
          // 먼저 DB에서 확인
          const { data: existingLyrics } = await supabase
            .from('lyrics')
            .select('*')
            .eq('title', storedTitle)
            .eq('artist', storedArtist)
            .single();

          if (existingLyrics) {
            setLyricsId(existingLyrics.id);
            // 기존 가사 사용
            loadLRC(existingLyrics.lrc_content);
          } else {
            // 새로 저장
            const { data: newLyrics, error } = await supabase
              .from('lyrics')
              .insert({
                title: storedTitle,
                artist: storedArtist,
                lrc_content: storedLRC,
                lines: parseLRCToLines(storedLRC),
                metadata: {
                  source: 'manual',
                  created_at: new Date().toISOString(),
                }
              })
              .select()
              .single();

            if (newLyrics) {
              setLyricsId(newLyrics.id);
            }

            loadLRC(storedLRC);
          }
        } catch (error) {
          console.error('Failed to save lyrics:', error);
          // 저장 실패해도 가사는 표시
          loadLRC(storedLRC);
        }
      }
    };

    loadAndSaveLyrics();

    // 로컬 스토리지 변경 감지
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'current_lrc') {
        loadAndSaveLyrics();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadLRC]);

  // 현재 라인 업데이트
  useEffect(() => {
    if (lyricsCurrentLine) {
      setCurrentLine(lyricsCurrentLine as any);
    }
  }, [lyricsCurrentLine]);

  // 번역 캐싱 시스템
  useEffect(() => {
    const fetchTranslation = async () => {
      if (!currentLine || !showTranslationState || !lyricsId) return;

      try {
        // 먼저 캐시된 번역 확인
        const { data: cachedTranslation } = await supabase
          .from('translations')
          .select('translated_text')
          .eq('lyrics_id', lyricsId)
          .eq('line_index', playbackState.currentLineIndex)
          .eq('target_language', targetLang)
          .single();

        if (cachedTranslation) {
          setTranslation(cachedTranslation.translated_text);
        } else {
          // 번역 API 호출
          const response = await fetch('/api/translate/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: currentLine.text,
              targetLanguage: targetLang,
              context: {
                title: lyrics?.metadata?.title,
                artist: lyrics?.metadata?.artist,
                previousLine: playbackState.currentLineIndex > 0 ? lyrics?.lines[playbackState.currentLineIndex - 1].text : null,
                nextLine: playbackState.currentLineIndex < lyrics!.lines.length - 1 ? lyrics?.lines[playbackState.currentLineIndex + 1].text : null,
              }
            }),
          });

          const data = await response.json();
          
          if (data.translation) {
            setTranslation(data.translation);
            
            // 번역 결과 저장 (타이밍 정보와 함께)
            await supabase
              .from('translations')
              .insert({
                lyrics_id: lyricsId,
                line_index: playbackState.currentLineIndex,
                original_text: currentLine.text,
                translated_text: data.translation,
                target_language: targetLang,
                timestamp: currentLine.timestamp,
                duration: currentLine.duration,
                metadata: {
                  words: currentLine.words,
                  context_used: true,
                }
              });
          }
        }
      } catch (error) {
        console.error('Translation error:', error);
      }
    };

    fetchTranslation();
  }, [currentLine, showTranslationState, targetLang, lyricsId, playbackState.currentLineIndex, lyrics]);

  // 컨트롤 명령 처리
  useEffect(() => {
    const handleControl = (e: StorageEvent) => {
      if (e.key === 'karaoke_control') {
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
      
      // 수동 라인 진행
      if (e.key === 'current_line_index') {
        const index = parseInt(e.newValue || '0');
        if (lyrics && index >= 0 && index < lyrics.lines.length) {
          // 특정 라인으로 직접 이동
          const targetLine = lyrics.lines[index];
          if (targetLine) {
            setCurrentLine(targetLine as any);
            // playbackState 업데이트는 hook 내부에서 처리
          }
        }
      }
      
      // 번역 업데이트
      if (e.key === 'current_translations') {
        try {
          const translations = JSON.parse(e.newValue || '{}');
          const currentLang = targetLang;
          if (translations[currentLang] && playbackState.currentLineIndex < translations[currentLang].length) {
            setTranslation(translations[currentLang][playbackState.currentLineIndex]);
          }
        } catch (error) {
          console.error('Failed to parse translations:', error);
        }
      }
    };

    window.addEventListener('storage', handleControl);
    return () => window.removeEventListener('storage', handleControl);
  }, [play, pause, reset]);

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: chromaKey }}
    >
      <AnimatePresence mode="wait">
        {currentLine && (
          <motion.div
            key={playbackState.currentLineIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="text-center px-10 max-w-[90%]"
          >
            {/* 원본 가사 */}
            <div 
              className="mb-6"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: 1.3,
                fontWeight: 'bold',
                textShadow: `
                  0 0 30px rgba(0,0,0,1),
                  0 0 20px rgba(0,0,0,1),
                  0 0 10px rgba(0,0,0,1),
                  3px 3px 6px rgba(0,0,0,1),
                  -1px -1px 2px rgba(0,0,0,1)
                `,
              }}
            >
              {currentLine.words ? (
                // 단어별 하이라이팅
                currentLine.words.map((word, idx) => (
                  <span
                    key={idx}
                    style={{
                      color: idx <= playbackState.currentWordIndex ? highlightColor : textColor,
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'inline-block',
                      transform: idx <= playbackState.currentWordIndex ? 'scale(1.1)' : 'scale(1)',
                      textShadow: idx <= playbackState.currentWordIndex 
                        ? `
                          0 0 40px ${highlightColor}88,
                          0 0 30px rgba(0,0,0,1),
                          0 0 20px rgba(0,0,0,1),
                          3px 3px 6px rgba(0,0,0,1)
                        `
                        : 'inherit',
                    }}
                  >
                    {word.text}
                    {idx < currentLine.words!.length - 1 && ' '}
                  </span>
                ))
              ) : (
                <span style={{ color: textColor }}>
                  {currentLine.text}
                </span>
              )}
            </div>

            {/* 번역 */}
            {showTranslationState && translation && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{
                  fontSize: `${fontSize * 0.7}px`,
                  color: textColor,
                  fontWeight: 'normal',
                  opacity: 0.95,
                  textShadow: `
                    0 0 20px rgba(0,0,0,1),
                    0 0 10px rgba(0,0,0,1),
                    2px 2px 4px rgba(0,0,0,1)
                  `,
                }}
              >
                {translation}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 디버그 정보 (개발용) */}
      {searchParams.get('debug') === 'true' && (
        <div className="fixed top-4 left-4 text-white text-xs bg-black/50 p-2 rounded">
          <div>Line: {playbackState.currentLineIndex + 1}/{lyrics?.lines.length || 0}</div>
          <div>Playing: {playbackState.isPlaying ? 'Yes' : 'No'}</div>
          <div>LyricsID: {lyricsId || 'Not saved'}</div>
        </div>
      )}
    </div>
  );
}

// LRC 파싱 헬퍼 함수
function parseLRCToLines(lrcContent: string): any[] {
  const lines: any[] = [];
  const lrcLines = lrcContent.split('\n');
  
  for (const line of lrcLines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const [, minutes, seconds, milliseconds, text] = match;
      const timestamp = parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000;
      
      // 단어별 타이밍 파싱
      const words: any[] = [];
      const wordPattern = /<(\d{2}):(\d{2})\.(\d{2})>([^<]+)/g;
      let wordMatch;
      
      while ((wordMatch = wordPattern.exec(text)) !== null) {
        const [, wMin, wSec, wMs, word] = wordMatch;
        words.push({
          text: word,
          timestamp: parseInt(wMin) * 60 + parseInt(wSec) + parseInt(wMs) / 100,
        });
      }
      
      lines.push({
        timestamp,
        text: text.replace(/<\d{2}:\d{2}\.\d{2}>/g, '').trim() || text.trim(),
        words: words.length > 0 ? words : null,
      });
    }
  }
  
  return lines;
}