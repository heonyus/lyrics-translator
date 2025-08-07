"use client";

import React, { useState, useEffect } from 'react';
import { 
  GlassmorphicCard, 
  NeonButton,
  useNeonToast 
} from '@/components/design-system';
import { Play, Pause, RotateCcw, Copy, Search, Settings2, Monitor, Edit3 } from 'lucide-react';
import { LyricsTimingEditor } from '@/components/lyrics-editor';
import { useLRCFetcher } from '@/domains/lrc-fetcher';
import { supabase } from '@/lib/supabase';
import { LRCParser } from '@/domains/lyrics/services/lrc-parser';

export default function OBSControlPage() {
  const { success, error, info } = useNeonToast();
  const { search, searchResults, isSearching, selectResult, fetchLRC, fetchedLRC, isFetching } = useLRCFetcher();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLyrics, setCurrentLyrics] = useState<any>(null);
  const [recentLyrics, setRecentLyrics] = useState<any[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const lrcParser = new LRCParser();
  
  // OBS 설정
  const [obsSettings, setObsSettings] = useState({
    chromaKey: '#00FF00',
    fontSize: 60,
    textColor: '#FFFFFF', 
    highlightColor: '#FFD700',
    targetLang: 'en',
    showTranslation: true,
  });

  // 최근 사용한 가사 불러오기
  useEffect(() => {
    loadRecentLyrics();
  }, []);

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // 입력 필드에 포커스가 있으면 단축키 무시
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':  // Space bar
          e.preventDefault();
          handlePlayPause();
          break;
        case 'r':  // R key
          e.preventDefault();
          handleReset();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying]);

  const loadRecentLyrics = async () => {
    try {
      const { data } = await supabase
        .from('lyrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (data) {
        setRecentLyrics(data);
      }
    } catch (err) {
      console.error('Failed to load recent lyrics:', err);
    }
  };

  // 가사 검색
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      await search(searchQuery);
    }
  };

  // 가사 선택 및 로드
  const handleSelectAndLoad = async (result: any) => {
    selectResult(result);
    await fetchLRC(result);
    
    // fetchedLRC from hook will be available after fetchLRC completes
    if (fetchedLRC) {
      // 로컬 스토리지에 저장
      localStorage.setItem('current_lrc', fetchedLRC);
      localStorage.setItem('current_title', result.title);
      localStorage.setItem('current_artist', result.artist);
      
      const parseResult = lrcParser.parse(fetchedLRC);
      setCurrentLyrics({
        title: result.title,
        artist: result.artist,
        lrc: fetchedLRC,
        parsedLRC: parseResult.success ? parseResult.data : null
      });
      
      success('가사 로드됨', `${result.title} - ${result.artist}`);
      
      // 최근 목록 새로고침
      loadRecentLyrics();
    }
  };

  // 최근 가사 로드
  const loadRecentLyric = (lyric: any) => {
    localStorage.setItem('current_lrc', lyric.lrc_content);
    localStorage.setItem('current_title', lyric.title);
    localStorage.setItem('current_artist', lyric.artist);
    
    const parseResult = lrcParser.parse(lyric.lrc_content);
    setCurrentLyrics({
      title: lyric.title,
      artist: lyric.artist,
      lrc: lyric.lrc_content,
      parsedLRC: parseResult.success ? parseResult.data : null
    });
    
    success('가사 로드됨', `${lyric.title} - ${lyric.artist}`);
  };

  // 재생 컨트롤
  const handlePlayPause = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);
    localStorage.setItem('karaoke_control', newState ? 'play' : 'pause');
    info(newState ? '재생 시작' : '일시정지');
  };

  const handleReset = () => {
    setIsPlaying(false);
    localStorage.setItem('karaoke_control', 'reset');
    info('처음으로 이동');
  };

  // OBS URL 생성
  const generateOBSUrl = () => {
    const params = new URLSearchParams({
      chromaKey: obsSettings.chromaKey,
      fontSize: obsSettings.fontSize.toString(),
      textColor: obsSettings.textColor,
      highlightColor: obsSettings.highlightColor,
      lang: obsSettings.targetLang,
      showTranslation: obsSettings.showTranslation.toString(),
    });
    
    return `${window.location.origin}/obs?${params.toString()}`;
  };

  // URL 복사
  const copyOBSUrl = () => {
    navigator.clipboard.writeText(generateOBSUrl());
    success('복사됨', 'OBS URL이 클립보드에 복사되었습니다');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900/20 to-black p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-neon-blue mb-8">OBS 가사 컨트롤러</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 검색 및 최근 가사 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 검색 */}
            <GlassmorphicCard variant="dark" blur="md">
              <h2 className="text-xl font-semibold text-neon-pink mb-4">가사 검색</h2>
              <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="제목, 아티스트, YouTube URL..."
                  className="flex-1 px-4 py-2 bg-black/50 border border-neon-pink/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-pink"
                />
                <NeonButton type="submit" color="pink" disabled={isSearching}>
                  <Search className="w-4 h-4" />
                </NeonButton>
              </form>
              
              {/* 검색 결과 */}
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map((result) => (
                    <div
                      key={`${result.provider}-${result.id}`}
                      onClick={() => handleSelectAndLoad(result)}
                      className="p-3 bg-black/30 rounded-lg cursor-pointer hover:bg-black/50 transition-colors"
                    >
                      <div className="flex justify-between">
                        <div>
                          <div className="font-medium text-white">{result.title}</div>
                          <div className="text-sm text-gray-400">{result.artist}</div>
                        </div>
                        <div className="text-xs text-neon-green">
                          {result.provider}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassmorphicCard>

            {/* 최근 사용 */}
            <GlassmorphicCard variant="dark" blur="md">
              <h2 className="text-xl font-semibold text-neon-green mb-4">최근 사용한 가사</h2>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {recentLyrics.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">최근 사용한 가사가 없습니다</p>
                ) : (
                  recentLyrics.map((lyric) => (
                    <div
                      key={lyric.id}
                      onClick={() => loadRecentLyric(lyric)}
                      className="p-3 bg-black/30 rounded-lg cursor-pointer hover:bg-black/50 transition-colors"
                    >
                      <div className="font-medium text-white">{lyric.title}</div>
                      <div className="text-sm text-gray-400">{lyric.artist}</div>
                    </div>
                  ))
                )}
              </div>
            </GlassmorphicCard>
          </div>

          {/* 오른쪽: 컨트롤 및 설정 */}
          <div className="space-y-6">
            {/* 현재 가사 정보 */}
            {currentLyrics && (
              <GlassmorphicCard variant="dark" blur="md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-neon-yellow">현재 가사</h3>
                  <NeonButton 
                    onClick={() => setShowEditor(!showEditor)} 
                    variant="outline" 
                    color="yellow" 
                    size="sm"
                  >
                    <Edit3 className="w-4 h-4" />
                  </NeonButton>
                </div>
                <div className="p-3 bg-black/30 rounded-lg">
                  <div className="font-medium text-white">{currentLyrics.title}</div>
                  <div className="text-sm text-gray-400">{currentLyrics.artist}</div>
                </div>
              </GlassmorphicCard>
            )}

            {/* 재생 컨트롤 */}
            <GlassmorphicCard variant="dark" blur="md">
              <h3 className="text-lg font-semibold text-neon-blue mb-4">재생 컨트롤</h3>
              <div className="flex justify-center gap-4">
                <NeonButton onClick={handleReset} color="purple" variant="outline">
                  <RotateCcw className="w-5 h-5" />
                </NeonButton>
                <NeonButton onClick={handlePlayPause} color="blue" size="lg">
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </NeonButton>
              </div>
              
              {/* 키보드 단축키 안내 */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>재생/정지:</span>
                    <kbd className="px-2 py-0.5 bg-gray-800 rounded text-gray-300">Space</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>처음으로:</span>
                    <kbd className="px-2 py-0.5 bg-gray-800 rounded text-gray-300">R</kbd>
                  </div>
                </div>
              </div>
            </GlassmorphicCard>

            {/* OBS 설정 */}
            <GlassmorphicCard variant="dark" blur="md">
              <h3 className="text-lg font-semibold text-neon-orange mb-4 flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                OBS 설정
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">글자 크기</label>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    value={obsSettings.fontSize}
                    onChange={(e) => setObsSettings({...obsSettings, fontSize: parseInt(e.target.value)})}
                    className="w-full"
                  />
                  <span className="text-xs text-gray-500">{obsSettings.fontSize}px</span>
                </div>

                <div>
                  <label className="text-sm text-gray-400">번역 언어</label>
                  <select
                    value={obsSettings.targetLang}
                    onChange={(e) => setObsSettings({...obsSettings, targetLang: e.target.value})}
                    className="w-full px-3 py-2 bg-black/50 border border-neon-orange/30 rounded-lg text-white focus:outline-none"
                  >
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                    <option value="zh">中文</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showTranslation"
                    checked={obsSettings.showTranslation}
                    onChange={(e) => setObsSettings({...obsSettings, showTranslation: e.target.checked})}
                    className="rounded"
                  />
                  <label htmlFor="showTranslation" className="text-sm text-gray-300">
                    번역 표시
                  </label>
                </div>
              </div>
            </GlassmorphicCard>

            {/* OBS URL */}
            <GlassmorphicCard variant="dark" blur="md">
              <h3 className="text-lg font-semibold text-neon-purple mb-3 flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                OBS 브라우저 소스
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-black/30 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">URL:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={generateOBSUrl()}
                      readOnly
                      className="flex-1 px-2 py-1 bg-black/50 border border-neon-purple/30 rounded text-xs text-white"
                    />
                    <NeonButton onClick={copyOBSUrl} color="purple" size="sm">
                      <Copy className="w-4 h-4" />
                    </NeonButton>
                  </div>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>• 크로마키: 녹색 (#00FF00)</p>
                  <p>• 크기: 1920x1080</p>
                  <p>• FPS: 30 이상</p>
                </div>
              </div>
            </GlassmorphicCard>
          </div>
        </div>

        {/* 가사 타이밍 편집기 */}
        {showEditor && currentLyrics && currentLyrics.parsedLRC && (
          <div className="mt-6">
            <LyricsTimingEditor
              lyrics={currentLyrics.parsedLRC}
              onSave={(updatedLyrics) => {
                // Update localStorage
                const updatedLRC = formatLRCFromParsed(updatedLyrics);
                localStorage.setItem('current_lrc', updatedLRC);
                
                // Update state
                setCurrentLyrics({
                  ...currentLyrics,
                  lrc: updatedLRC,
                  parsedLRC: updatedLyrics
                });
                
                success('저장됨', '가사 타이밍이 업데이트되었습니다');
                setShowEditor(false);
              }}
              onCancel={() => setShowEditor(false)}
              currentTime={currentTime}
              isPlaying={isPlaying}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to format ParsedLRC back to LRC string
function formatLRCFromParsed(parsedLRC: any): string {
  let lrcContent = '';
  
  // Add metadata
  if (parsedLRC.metadata) {
    Object.entries(parsedLRC.metadata).forEach(([key, value]) => {
      lrcContent += `[${key}:${value}]
`;
    });
  }
  
  // Add lines
  parsedLRC.lines.forEach((line: any) => {
    const minutes = Math.floor(line.startTime / 60000);
    const seconds = Math.floor((line.startTime % 60000) / 1000);
    const centiseconds = Math.floor((line.startTime % 1000) / 10);
    
    const timeTag = `[${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}]`;
    
    lrcContent += `${timeTag}${line.text}
`;
  });
  
  return lrcContent;
}