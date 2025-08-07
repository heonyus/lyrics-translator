'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Settings, Globe, Mic, Music } from 'lucide-react';

interface LyricLine {
  text: string;
  startTime: number;
  endTime: number;
  translations?: {
    en?: string;
    ko?: string;
    ja?: string;
    zh?: string;
  };
}

interface Song {
  title: string;
  artist: string;
  lyrics: LyricLine[];
}

export default function OBSAutoOverlay() {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLanguages, setShowLanguages] = useState({
    original: true,
    en: true,
    ko: false,
    ja: false
  });
  const [fontSize, setFontSize] = useState(48);
  const [isSearching, setIsSearching] = useState(false);
  const [chromaKey] = useState('#00FF00');
  
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSearchRef = useRef<string>('');
  const playbackIntervalRef = useRef<NodeJS.Timeout>();

  // 자동 가사 검색
  const autoSearchLyrics = async (query: string) => {
    if (lastSearchRef.current === query || !query) return;
    
    lastSearchRef.current = query;
    setIsSearching(true);
    
    try {
      // Gemini API로 가사 검색
      const response = await fetch('/api/lyrics/gemini-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: query.split(' - ')[0] || '',
          title: query.split(' - ')[1] || query
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.lyrics) {
          // 가사 파싱
          const lines = parseLyrics(data.lyrics);
          
          // 다중 언어 번역 요청
          const translatedLines = await translateAllLines(lines);
          
          setCurrentSong({
            title: query.split(' - ')[1] || query,
            artist: query.split(' - ')[0] || 'Unknown',
            lyrics: translatedLines
          });
          
          setIsPlaying(true);
          setCurrentLineIndex(0);
        }
      }
    } catch (error) {
      console.error('Auto search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // 가사 파싱
  const parseLyrics = (lyricsText: string): LyricLine[] => {
    const lines = lyricsText.split('\n').filter(line => line.trim());
    const duration = 4000; // 기본 4초 per line
    
    return lines.map((text, index) => ({
      text: text.trim(),
      startTime: index * duration,
      endTime: (index + 1) * duration,
      translations: {}
    }));
  };

  // 모든 라인 번역
  const translateAllLines = async (lines: LyricLine[]): Promise<LyricLine[]> => {
    const languages = Object.keys(showLanguages).filter(
      lang => lang !== 'original' && showLanguages[lang as keyof typeof showLanguages]
    );
    
    if (languages.length === 0) return lines;

    try {
      const translatedLines = await Promise.all(
        lines.map(async (line) => {
          const response = await fetch('/api/translate/gemini', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: line.text,
              languages,
              context: {
                songTitle: currentSong?.title,
                artist: currentSong?.artist
              }
            })
          });

          if (response.ok) {
            const data = await response.json();
            return {
              ...line,
              translations: data.translations || {}
            };
          }
          return line;
        })
      );
      
      return translatedLines;
    } catch (error) {
      console.error('Translation error:', error);
      return lines;
    }
  };

  // localStorage 모니터링 (수동 제어용)
  useEffect(() => {
    const checkLocalStorage = () => {
      const query = localStorage.getItem('obs_current_song');
      const control = localStorage.getItem('obs_control');
      
      if (query && query !== lastSearchRef.current) {
        autoSearchLyrics(query);
      }
      
      if (control === 'play') {
        setIsPlaying(true);
      } else if (control === 'pause') {
        setIsPlaying(false);
      } else if (control === 'reset') {
        setCurrentLineIndex(0);
        setIsPlaying(false);
      }
    };

    const interval = setInterval(checkLocalStorage, 500);
    return () => clearInterval(interval);
  }, []);

  // 자동 재생 로직
  useEffect(() => {
    if (isPlaying && currentSong) {
      playbackIntervalRef.current = setInterval(() => {
        setCurrentLineIndex(prev => {
          if (prev < currentSong.lyrics.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, 4000); // 4초마다 다음 라인

      return () => {
        if (playbackIntervalRef.current) {
          clearInterval(playbackIntervalRef.current);
        }
      };
    }
  }, [isPlaying, currentSong]);

  // 현재 라인
  const currentLine = currentSong?.lyrics[currentLineIndex];
  const nextLine = currentSong?.lyrics[currentLineIndex + 1];

  return (
    <div 
      className="min-h-screen relative"
      style={{ backgroundColor: chromaKey }}
    >
      {/* 상태 표시 (디버그용 - 실제로는 숨김) */}
      <div className="absolute top-4 right-4 text-white opacity-0 pointer-events-none">
        {isSearching && <Mic className="animate-pulse" />}
        {isPlaying && <Music className="animate-bounce" />}
      </div>

      {/* 가사 표시 영역 */}
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-6xl px-8">
          {currentLine && (
            <div className="space-y-6">
              {/* 현재 라인 */}
              <div className="text-center animate-fade-in">
                {/* 원본 */}
                {showLanguages.original && (
                  <div 
                    className="text-white font-bold mb-3"
                    style={{
                      fontSize: `${fontSize}px`,
                      textShadow: `
                        0 0 10px rgba(0,0,0,0.9),
                        0 0 20px rgba(0,0,0,0.8),
                        0 0 30px rgba(0,0,0,0.7),
                        2px 2px 4px rgba(0,0,0,1)
                      `,
                      lineHeight: 1.4
                    }}
                  >
                    {currentLine.text}
                  </div>
                )}

                {/* 영어 번역 */}
                {showLanguages.en && currentLine.translations?.en && (
                  <div 
                    className="text-cyan-300 font-semibold"
                    style={{
                      fontSize: `${fontSize * 0.8}px`,
                      textShadow: `
                        0 0 8px rgba(0,0,0,0.9),
                        2px 2px 3px rgba(0,0,0,1)
                      `,
                      lineHeight: 1.3
                    }}
                  >
                    {currentLine.translations.en}
                  </div>
                )}

                {/* 한국어 번역 */}
                {showLanguages.ko && currentLine.translations?.ko && (
                  <div 
                    className="text-yellow-300 font-semibold mt-2"
                    style={{
                      fontSize: `${fontSize * 0.8}px`,
                      textShadow: `
                        0 0 8px rgba(0,0,0,0.9),
                        2px 2px 3px rgba(0,0,0,1)
                      `,
                      lineHeight: 1.3
                    }}
                  >
                    {currentLine.translations.ko}
                  </div>
                )}

                {/* 일본어 번역 */}
                {showLanguages.ja && currentLine.translations?.ja && (
                  <div 
                    className="text-pink-300 font-semibold mt-2"
                    style={{
                      fontSize: `${fontSize * 0.8}px`,
                      textShadow: `
                        0 0 8px rgba(0,0,0,0.9),
                        2px 2px 3px rgba(0,0,0,1)
                      `,
                      lineHeight: 1.3
                    }}
                  >
                    {currentLine.translations.ja}
                  </div>
                )}
              </div>

              {/* 다음 라인 미리보기 (흐릿하게) */}
              {nextLine && (
                <div className="text-center opacity-40 mt-8">
                  <div 
                    className="text-gray-300"
                    style={{
                      fontSize: `${fontSize * 0.6}px`,
                      textShadow: `
                        0 0 5px rgba(0,0,0,0.8),
                        1px 1px 2px rgba(0,0,0,1)
                      `
                    }}
                  >
                    {nextLine.text}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 대기 중 메시지 */}
          {!currentLine && !isSearching && (
            <div className="text-center">
              <div 
                className="text-white/80"
                style={{
                  fontSize: `${fontSize * 0.8}px`,
                  textShadow: '0 0 10px rgba(0,0,0,0.9), 2px 2px 4px rgba(0,0,0,1)'
                }}
              >
                🎵 노래를 재생하면 자동으로 가사가 표시됩니다
              </div>
            </div>
          )}

          {/* 검색 중 */}
          {isSearching && (
            <div className="text-center">
              <div 
                className="text-white animate-pulse"
                style={{
                  fontSize: `${fontSize * 0.8}px`,
                  textShadow: '0 0 10px rgba(0,0,0,0.9), 2px 2px 4px rgba(0,0,0,1)'
                }}
              >
                🔍 가사를 검색하고 있습니다...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 설정 패널 (투명 배경) - 실제로는 컨트롤 페이지에서 제어 */}
      <div className="fixed bottom-4 left-4 opacity-0 pointer-events-none">
        <div className="bg-black/80 backdrop-blur p-4 rounded-lg">
          <div className="flex gap-2 mb-2">
            <button onClick={() => setShowLanguages({...showLanguages, en: !showLanguages.en})}>
              EN
            </button>
            <button onClick={() => setShowLanguages({...showLanguages, ko: !showLanguages.ko})}>
              KO
            </button>
            <button onClick={() => setShowLanguages({...showLanguages, ja: !showLanguages.ja})}>
              JA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}