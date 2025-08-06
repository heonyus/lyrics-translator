'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LyricsLine {
  time: number;
  text: string;
}

export default function OBSOverlay() {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [lyrics, setLyrics] = useState<LyricsLine[]>([]);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [translation, setTranslation] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  
  // 번역 캐시 추가
  const translationCache = useRef<Map<string, string>>(new Map());
  const lastTranslatedText = useRef<string>('');
  
  // URL 파라미터 읽기
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const chromaKey = searchParams.get('chromaKey') || '#00FF00';
  const fontSize = parseInt(searchParams.get('fontSize') || '60');
  const textColor = searchParams.get('textColor') || '#FFFFFF';
  const highlightColor = searchParams.get('highlightColor') || '#FFD700';
  
  // 번역 설정 - localStorage 우선, URL 파라미터 폴백
  const [translationSettings, setTranslationSettings] = useState({
    showTranslation: searchParams.get('showTranslation') !== 'false',
    targetLang: searchParams.get('lang') || 'ko',
    translationColor: searchParams.get('translationColor') || '#87CEEB'
  });
  
  // localStorage에서 가사 및 상태 읽기
  useEffect(() => {
    const interval = setInterval(() => {
      // 현재 라인 인덱스
      const lineIndex = localStorage.getItem('current_line_index');
      if (lineIndex) {
        setCurrentLineIndex(parseInt(lineIndex));
      }
      
      // 곡 정보
      const songTitle = localStorage.getItem('current_song_title');
      const songArtist = localStorage.getItem('current_song_artist');
      if (songTitle) setTitle(songTitle);
      if (songArtist) setArtist(songArtist);
      
      // 전체 가사 로드
      const fullLyrics = localStorage.getItem('current_lyrics_full');
      const lrcContent = localStorage.getItem('current_lrc');
      
      if (lrcContent) {
        // LRC 형식 파싱
        const parsedLyrics = parseLRC(lrcContent);
        setLyrics(parsedLyrics);
      } else if (fullLyrics) {
        // 일반 텍스트를 LRC 형식으로 변환
        const lines = fullLyrics.split('\n').filter(line => line.trim());
        const parsedLyrics = lines.map((line, index) => ({
          time: index * 3,
          text: line.trim()
        }));
        setLyrics(parsedLyrics);
      }
      
      // 재생 상태
      const playState = localStorage.getItem('karaoke_control');
      setIsPlaying(playState === 'play');
      
      // 번역 설정 동기화
      const showTrans = localStorage.getItem('obs_show_translation');
      const transLang = localStorage.getItem('obs_translation_lang');
      const transColor = localStorage.getItem('obs_translation_color');
      
      setTranslationSettings(prev => ({
        showTranslation: showTrans !== null ? showTrans === 'true' : prev.showTranslation,
        targetLang: transLang || prev.targetLang,
        translationColor: transColor || prev.translationColor
      }));
    }, 100);
    
    return () => clearInterval(interval);
  }, []);
  
  // 번역 가져오기 (캐싱 적용)
  useEffect(() => {
    if (lyrics[currentLineIndex] && translationSettings.showTranslation) {
      const currentText = lyrics[currentLineIndex].text;
      
      // 빈 텍스트는 번역하지 않음
      if (!currentText.trim()) {
        setTranslation('');
        return;
      }
      
      // 이미 번역한 텍스트인지 확인
      if (lastTranslatedText.current === currentText) {
        return; // 같은 텍스트는 다시 번역하지 않음
      }
      
      // 캐시 키 생성 (텍스트 + 언어)
      const cacheKey = `${currentText}_${translationSettings.targetLang}`;
      
      // 캐시에서 확인
      if (translationCache.current.has(cacheKey)) {
        setTranslation(translationCache.current.get(cacheKey) || '');
        lastTranslatedText.current = currentText;
        return;
      }
      
      // 번역 API 호출
      fetch('/api/translate/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentText,
          targetLang: translationSettings.targetLang,
          sourceLang: 'auto'
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // 캐시에 저장
          translationCache.current.set(cacheKey, data.translation);
          setTranslation(data.translation);
          lastTranslatedText.current = currentText;
        } else {
          setTranslation('');
        }
      })
      .catch(err => {
        console.error('Translation error:', err);
        setTranslation('');
      });
    } else {
      // 번역 표시 안 함
      setTranslation('');
      lastTranslatedText.current = '';
    }
  }, [currentLineIndex, lyrics, translationSettings.showTranslation, translationSettings.targetLang]);
  
  // LRC 파싱 함수
  const parseLRC = (lrcContent: string): LyricsLine[] => {
    const lines = lrcContent.split('\n');
    const lrcPattern = /\[(\d{2}):(\d{2}\.\d{2})\](.*)/;
    const result: LyricsLine[] = [];
    
    for (const line of lines) {
      const match = line.match(lrcPattern);
      if (match) {
        const [, minutes, seconds, text] = match;
        const time = parseInt(minutes) * 60 + parseFloat(seconds);
        result.push({ time, text: text.trim() });
      }
    }
    
    return result;
  };
  
  // 현재, 이전, 다음 라인 가져오기
  const getCurrentLines = () => {
    const prev = currentLineIndex > 0 ? lyrics[currentLineIndex - 1] : null;
    const current = lyrics[currentLineIndex] || null;
    const next = currentLineIndex < lyrics.length - 1 ? lyrics[currentLineIndex + 1] : null;
    return { prev, current, next };
  };
  
  const { prev, current, next } = getCurrentLines();
  
  return (
    <div 
      style={{ 
        backgroundColor: chromaKey,
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* 곡 정보 (상단) */}
      <div 
        style={{
          position: 'absolute',
          top: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          width: '90%'
        }}
      >
        <div
          style={{
            fontSize: `${fontSize * 0.5}px`,
            color: textColor,
            textShadow: `
              -3px -3px 0 #000,  
              3px -3px 0 #000,
              -3px 3px 0 #000,
              3px 3px 0 #000,
              0 0 20px rgba(0,0,0,0.8)
            `,
            fontWeight: 'bold',
            marginBottom: '10px'
          }}
        >
          {title && artist && `${artist} - ${title}`}
        </div>
      </div>
      
      {/* 가사 표시 영역 (중앙) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          textAlign: 'center'
        }}
      >
        {/* 이전 라인 */}
        {prev && (
          <div
            style={{
              fontSize: `${fontSize * 0.7}px`,
              color: textColor,
              opacity: 0.5,
              textShadow: `
                -2px -2px 0 #000,  
                2px -2px 0 #000,
                -2px 2px 0 #000,
                2px 2px 0 #000,
                0 0 15px rgba(0,0,0,0.8)
              `,
              marginBottom: '20px',
              fontWeight: 'bold'
            }}
          >
            {prev.text}
          </div>
        )}
        
        {/* 현재 라인 (하이라이트) */}
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={currentLineIndex}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                fontSize: `${fontSize}px`,
                color: highlightColor,
                textShadow: `
                  -4px -4px 0 #000,  
                  4px -4px 0 #000,
                  -4px 4px 0 #000,
                  4px 4px 0 #000,
                  0 0 30px ${highlightColor}40,
                  0 0 50px rgba(0,0,0,0.9)
                `,
                marginBottom: '15px',
                fontWeight: 'bold',
                letterSpacing: '2px'
              }}
            >
              {current.text}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* 번역 (현재 라인 아래) */}
        {translationSettings.showTranslation && translation && current && (
          <div
            style={{
              fontSize: `${fontSize * 0.6}px`,
              color: translationSettings.translationColor,
              textShadow: `
                -2px -2px 0 #000,  
                2px -2px 0 #000,
                -2px 2px 0 #000,
                2px 2px 0 #000,
                0 0 15px rgba(0,0,0,0.8)
              `,
              marginBottom: '20px',
              fontStyle: 'italic',
              fontWeight: 'bold'
            }}
          >
            {translation}
          </div>
        )}
        
        {/* 다음 라인 */}
        {next && (
          <div
            style={{
              fontSize: `${fontSize * 0.7}px`,
              color: textColor,
              opacity: 0.5,
              textShadow: `
                -2px -2px 0 #000,  
                2px -2px 0 #000,
                -2px 2px 0 #000,
                2px 2px 0 #000,
                0 0 15px rgba(0,0,0,0.8)
              `,
              marginTop: '20px',
              fontWeight: 'bold'
            }}
          >
            {next.text}
          </div>
        )}
      </div>
      
      {/* 진행 표시 (하단) */}
      <div
        style={{
          position: 'absolute',
          bottom: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          height: '10px',
          backgroundColor: 'rgba(255,255,255,0.2)',
          borderRadius: '5px',
          overflow: 'hidden',
          border: '2px solid rgba(0,0,0,0.8)'
        }}
      >
        <div
          style={{
            width: `${((currentLineIndex + 1) / lyrics.length) * 100}%`,
            height: '100%',
            backgroundColor: highlightColor,
            transition: 'width 0.3s ease',
            boxShadow: `0 0 10px ${highlightColor}`
          }}
        />
      </div>
      
      {/* 재생 상태 표시 */}
      {!isPlaying && (
        <div
          style={{
            position: 'absolute',
            top: '100px',
            right: '50px',
            fontSize: '30px',
            color: '#FF6B6B',
            textShadow: `
              -2px -2px 0 #000,  
              2px -2px 0 #000,
              -2px 2px 0 #000,
              2px 2px 0 #000
            `,
            fontWeight: 'bold'
          }}
        >
          ⏸ PAUSED
        </div>
      )}
    </div>
  );
}