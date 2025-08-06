'use client';

import React, { useState, useEffect } from 'react';

interface ViewerSettings {
  language: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: 'classic' | 'kpop' | 'ballad';
}

interface LyricsLine {
  time: number;
  text: string;
  translation: string;
}

const stylePresets = {
  classic: {
    textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
    animation: 'none',
    fontWeight: '400'
  },
  kpop: {
    textShadow: '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.5)',
    animation: 'glow',
    fontWeight: '700'
  },
  ballad: {
    textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
    animation: 'fade',
    fontWeight: '400'
  }
};

export default function OBSViewerOverlay() {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [lyrics, setLyrics] = useState<LyricsLine[]>([]);
  const [settings, setSettings] = useState<ViewerSettings>({
    language: 'en',
    fontSize: 60,
    fontFamily: 'Noto Sans',
    fontStyle: 'classic'
  });

  useEffect(() => {
    // 설정 로드
    const hostSettings = localStorage.getItem('host_settings');
    if (hostSettings) {
      const parsed = JSON.parse(hostSettings);
      setSettings({
        language: parsed.viewerLanguage || 'en',
        fontSize: parsed.fontSize || 60,
        fontFamily: parsed.fontFamily || 'Noto Sans',
        fontStyle: parsed.fontStyle || 'classic'
      });
    }

    // 샘플 번역 가사 (실제로는 API에서 가져옴)
    setLyrics([
      { time: 0, text: "어쩜 이렇게 하늘은", translation: "How can the sky be" },
      { time: 3.5, text: "더 파란 건지", translation: "So blue today" },
      { time: 7, text: "오늘따라 왜 바람은", translation: "Why is the wind" },
      { time: 10.5, text: "또 완벽한지", translation: "So perfect today" },
      { time: 14, text: "그냥 모르는 척 하나 못들은 척", translation: "Should I pretend I don't know, pretend I didn't hear" },
      { time: 17.5, text: "지워버린 척 딴 얘길 시작할까", translation: "Pretend I forgot and start a different story" },
      { time: 21, text: "아무 말 못하게 입맞출까", translation: "Should I kiss you so you can't say anything" },
      { time: 24.5, text: "눈물이 차올라서 고갤 들어", translation: "Tears well up so I lift my head" },
      { time: 28, text: "흐르지 못하게 또 살짝 웃어", translation: "I smile slightly so they won't fall" },
      { time: 31.5, text: "내게 왜 이러는지 무슨 말을 하는지", translation: "Why are you doing this to me, what are you saying" },
      { time: 35, text: "오늘 했던 모든 말 저 하늘 위로", translation: "All the words said today, up to the sky" },
      { time: 38.5, text: "한번도 못했던 말", translation: "Words I've never said before" },
      { time: 42, text: "울면서 할 줄은 나 몰랐던 말", translation: "Words I didn't know I'd say while crying" },
      { time: 45.5, text: "나는요 오빠가 좋은걸 어떡해", translation: "I like you, oppa, what should I do" }
    ]);
  }, []);

  // 동기화 폴링
  useEffect(() => {
    const interval = setInterval(() => {
      const syncTime = parseFloat(localStorage.getItem('sync_time') || '0');
      const syncOffset = parseFloat(localStorage.getItem('sync_offset') || '0');
      const adjustedTime = syncTime;
      
      // 현재 라인 찾기
      const lineIndex = lyrics.findIndex((line, index) => {
        const nextLine = lyrics[index + 1];
        return adjustedTime >= line.time && (!nextLine || adjustedTime < nextLine.time);
      });
      
      if (lineIndex !== -1 && lineIndex !== currentLineIndex) {
        setCurrentLineIndex(lineIndex);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [lyrics, currentLineIndex]);

  const currentStyle = stylePresets[settings.fontStyle];
  const currentLine = lyrics[currentLineIndex];
  const prevLine = lyrics[currentLineIndex - 1];
  const nextLine = lyrics[currentLineIndex + 1];

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-8"
      style={{ backgroundColor: '#00FF00' }} // 크로마키 그린
    >
      <style jsx global>{`
        @keyframes glow {
          0%, 100% { opacity: 1; filter: brightness(1); }
          50% { opacity: 0.9; filter: brightness(1.2); }
        }
        
        @keyframes fade {
          0% { opacity: 0; transform: translateY(10px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
        
        .lyrics-glow {
          animation: glow 2s ease-in-out infinite;
        }
        
        .lyrics-fade {
          animation: fade 4s ease-in-out;
        }
      `}</style>
      
      <div className="max-w-6xl w-full text-center space-y-6">
        {/* 이전 라인 (희미하게) */}
        {prevLine && (
          <div 
            className="transition-all duration-500"
            style={{
              fontSize: `${settings.fontSize * 0.8}px`,
              fontFamily: settings.fontFamily,
              fontWeight: currentStyle.fontWeight,
              color: 'rgba(255, 255, 255, 0.5)',
              textShadow: currentStyle.textShadow,
            }}
          >
            {prevLine.translation}
          </div>
        )}
        
        {/* 현재 라인 (강조) */}
        {currentLine && (
          <div 
            className={`transition-all duration-300 ${
              currentStyle.animation === 'glow' ? 'lyrics-glow' : 
              currentStyle.animation === 'fade' ? 'lyrics-fade' : ''
            }`}
            style={{
              fontSize: `${settings.fontSize}px`,
              fontFamily: settings.fontFamily,
              fontWeight: currentStyle.fontWeight,
              color: '#FFD700', // 골드 색상
              textShadow: currentStyle.textShadow,
              lineHeight: 1.4,
            }}
          >
            <div className="inline-block relative">
              <span className="absolute -left-8 text-yellow-300">▶</span>
              {currentLine.translation}
              <span className="absolute -right-8 text-yellow-300">◀</span>
            </div>
          </div>
        )}
        
        {/* 다음 라인 (희미하게) */}
        {nextLine && (
          <div 
            className="transition-all duration-500"
            style={{
              fontSize: `${settings.fontSize * 0.8}px`,
              fontFamily: settings.fontFamily,
              fontWeight: currentStyle.fontWeight,
              color: 'rgba(255, 255, 255, 0.3)',
              textShadow: currentStyle.textShadow,
            }}
          >
            {nextLine.translation}
          </div>
        )}
      </div>
    </div>
  );
}