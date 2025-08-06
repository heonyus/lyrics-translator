'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, Play, Pause, RotateCcw, Settings2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface LyricsLine {
  time: number;
  text: string;
  translation?: string;
}

export default function HostLiveView() {
  const router = useRouter();
  const [lyrics, setLyrics] = useState<LyricsLine[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [syncOffset, setSyncOffset] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // 초기 설정 로드
  useEffect(() => {
    const settings = localStorage.getItem('host_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      setSyncOffset(parsed.syncOffset || 0);
    }

    // 샘플 가사 (실제로는 API에서 가져옴)
    setLyrics([
      { time: 0, text: "어쩜 이렇게 하늘은" },
      { time: 3.5, text: "더 파란 건지" },
      { time: 7, text: "오늘따라 왜 바람은" },
      { time: 10.5, text: "또 완벽한지" },
      { time: 14, text: "그냥 모르는 척 하나 못들은 척" },
      { time: 17.5, text: "지워버린 척 딴 얘길 시작할까" },
      { time: 21, text: "아무 말 못하게 입맞출까" },
      { time: 24.5, text: "눈물이 차올라서 고갤 들어" },
      { time: 28, text: "흐르지 못하게 또 살짝 웃어" },
      { time: 31.5, text: "내게 왜 이러는지 무슨 말을 하는지" },
      { time: 35, text: "오늘 했던 모든 말 저 하늘 위로" },
      { time: 38.5, text: "한번도 못했던 말" },
      { time: 42, text: "울면서 할 줄은 나 몰랐던 말" },
      { time: 45.5, text: "나는요 오빠가 좋은걸 어떡해" }
    ]);
  }, []);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch(e.key) {
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            adjustOffset(-2);
          } else {
            adjustOffset(-0.5);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            adjustOffset(2);
          } else {
            adjustOffset(0.5);
          }
          break;
        case 'r':
        case 'R':
          handleReset();
          break;
        case 's':
        case 'S':
          saveOffset();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [syncOffset, isPlaying]);

  // 재생 타이머
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = Date.now() - currentTime * 1000;
      
      intervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const adjustedTime = elapsed + syncOffset;
        
        setCurrentTime(elapsed);
        
        // localStorage에 현재 시간 저장 (시청자 동기화)
        localStorage.setItem('sync_time', adjustedTime.toString());
        
        // 현재 라인 찾기
        const lineIndex = lyrics.findIndex((line, index) => {
          const nextLine = lyrics[index + 1];
          return adjustedTime >= line.time && (!nextLine || adjustedTime < nextLine.time);
        });
        
        if (lineIndex !== -1 && lineIndex !== currentLineIndex) {
          setCurrentLineIndex(lineIndex);
        }
      }, 50);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, syncOffset, currentTime, lyrics, currentLineIndex]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    localStorage.setItem('is_playing', (!isPlaying).toString());
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentLineIndex(0);
    localStorage.setItem('sync_time', '0');
    localStorage.setItem('is_playing', 'false');
  };

  const adjustOffset = (delta: number) => {
    const newOffset = syncOffset + delta;
    setSyncOffset(newOffset);
    localStorage.setItem('sync_offset', newOffset.toString());
    toast.success(`싱크 조절: ${newOffset > 0 ? '+' : ''}${newOffset.toFixed(1)}초`);
  };

  const saveOffset = () => {
    const settings = JSON.parse(localStorage.getItem('host_settings') || '{}');
    settings.syncOffset = syncOffset;
    localStorage.setItem('host_settings', JSON.stringify(settings));
    toast.success('오프셋이 저장되었습니다');
  };

  const setCurrentLineManually = () => {
    const adjustedTime = currentTime + syncOffset;
    const manualOffset = adjustedTime - (lyrics[currentLineIndex]?.time || 0);
    setSyncOffset(syncOffset - manualOffset);
    localStorage.setItem('sync_offset', (syncOffset - manualOffset).toString());
    toast.success('현재 위치가 가사 시작점으로 설정되었습니다');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 bg-gray-900/50">
        <button
          onClick={() => router.push('/host')}
          className="flex items-center text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          컨트롤로 돌아가기
        </button>
        
        <div className="text-center">
          <h1 className="text-xl font-semibold">좋은날 - 아이유</h1>
          <div className="text-sm text-gray-400">[원본: 한국어]</div>
        </div>
        
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <Settings2 className="w-5 h-5" />
        </button>
      </div>

      {/* 진행 바 */}
      <div className="px-4 py-2 bg-gray-900/30">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono">{formatTime(currentTime)}</span>
          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
              style={{ width: `${(currentTime / 235) * 100}%` }}
            />
          </div>
          <span className="text-sm font-mono">3:55</span>
        </div>
      </div>

      {/* 가사 영역 */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="max-w-4xl w-full">
          {/* 이전 라인 */}
          {currentLineIndex > 0 && (
            <div className="text-3xl text-gray-600 mb-6 text-center">
              {lyrics[currentLineIndex - 1]?.text}
            </div>
          )}
          
          {/* 현재 라인 */}
          <div className="text-5xl font-bold text-center mb-8 relative">
            <div className="absolute -left-12 top-1/2 -translate-y-1/2 text-yellow-400">
              ▶▶▶
            </div>
            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              {lyrics[currentLineIndex]?.text || "가사 준비 중..."}
            </div>
            <div className="absolute -right-12 top-1/2 -translate-y-1/2 text-yellow-400">
              ◀◀◀
            </div>
          </div>
          
          {/* 다음 라인들 */}
          <div className="space-y-4">
            {lyrics.slice(currentLineIndex + 1, currentLineIndex + 3).map((line, index) => (
              <div 
                key={index}
                className="text-3xl text-gray-500 text-center"
                style={{ opacity: 1 - index * 0.3 }}
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 컨트롤 바 */}
      <div className="p-6 bg-gray-900/50">
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={handleReset}
            className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          
          <button
            onClick={handlePlayPause}
            className="p-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full hover:shadow-lg transition-all"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </button>
          
          <button
            onClick={setCurrentLineManually}
            className="px-4 py-3 bg-yellow-600 rounded-lg hover:bg-yellow-500 transition-colors font-medium"
          >
            여기서 시작
          </button>
        </div>
        
        {/* 싱크 조절 */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            onClick={() => adjustOffset(-1)}
            className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600"
          >
            ◀ -1초
          </button>
          <div className="px-4 py-1 bg-gray-800 rounded min-w-[100px] text-center font-mono">
            {syncOffset > 0 ? '+' : ''}{syncOffset.toFixed(1)}초
          </div>
          <button
            onClick={() => adjustOffset(1)}
            className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600"
          >
            +1초 ▶
          </button>
        </div>
        
        {/* 단축키 안내 */}
        <div className="mt-4 text-center text-xs text-gray-500">
          Space: 재생/정지 | ←/→: ±0.5초 | Shift+←/→: ±2초 | S: 오프셋 저장 | R: 리셋
        </div>
      </div>

      {/* 설정 패널 */}
      {showSettings && (
        <div className="absolute top-16 right-4 bg-gray-800 rounded-lg p-4 shadow-xl">
          <h3 className="font-semibold mb-3">빠른 설정</h3>
          <div className="space-y-2 text-sm">
            <div>싱크 오프셋: {syncOffset.toFixed(1)}초</div>
            <div>현재 시간: {formatTime(currentTime)}</div>
            <div>현재 라인: {currentLineIndex + 1}/{lyrics.length}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}