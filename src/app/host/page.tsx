'use client';

import React, { useState } from 'react';
import { Search, Play, Settings, Monitor, Music } from 'lucide-react';
import { useLRCFetcher } from '@/domains/lrc-fetcher';
import { toast } from 'sonner';

interface HostSettings {
  youtubeUrl: string;
  lyricsId: string;
  syncOffset: number;
  viewerLanguage: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: 'classic' | 'kpop' | 'ballad';
}

export default function HostControlPanel() {
  const [settings, setSettings] = useState<HostSettings>({
    youtubeUrl: '',
    lyricsId: '',
    syncOffset: 0,
    viewerLanguage: 'en',
    fontSize: 60,
    fontFamily: 'Noto Sans',
    fontStyle: 'classic'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isLive, setIsLive] = useState(false);
  
  const {
    isSearching,
    searchResults,
    selectedResult,
    search,
    selectResult,
    fetchLRC
  } = useLRCFetcher();

  // YouTube URL 처리
  const handleYouTubeConnect = () => {
    if (!settings.youtubeUrl) {
      toast.error('YouTube URL을 입력해주세요');
      return;
    }

    // YouTube URL에서 video ID 추출
    const videoId = extractYouTubeId(settings.youtubeUrl);
    if (!videoId) {
      toast.error('올바른 YouTube URL이 아닙니다');
      return;
    }

    // localStorage에 저장 (실시간 동기화용)
    localStorage.setItem('youtube_url', settings.youtubeUrl);
    localStorage.setItem('youtube_video_id', videoId);
    toast.success('YouTube MR이 연결되었습니다');
  };

  // 가사 검색
  const handleLyricsSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('검색어를 입력해주세요');
      return;
    }
    await search(searchQuery);
  };

  // 싱크 조절
  const adjustSync = (delta: number) => {
    const newOffset = settings.syncOffset + delta;
    setSettings(prev => ({ ...prev, syncOffset: newOffset }));
    localStorage.setItem('sync_offset', newOffset.toString());
  };

  // 방송 시작
  const startBroadcast = () => {
    if (!settings.youtubeUrl || !selectedResult) {
      toast.error('YouTube MR과 가사를 모두 선택해주세요');
      return;
    }

    setIsLive(true);
    
    // 설정 저장
    localStorage.setItem('host_settings', JSON.stringify(settings));
    localStorage.setItem('is_live', 'true');
    
    // 호스트 라이브 페이지로 이동
    window.open('/host/live', '_blank');
    
    toast.success('방송이 시작되었습니다!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🎤 노래방 호스트 컨트롤
          </h1>
          <p className="text-gray-600">
            MR을 연결하고 가사를 선택한 후 방송을 시작하세요
          </p>
        </div>

        {/* 1. MR 선택 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center mb-4">
            <Music className="w-6 h-6 text-blue-500 mr-2" />
            <h2 className="text-xl font-semibold">1. MR 선택</h2>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="YouTube URL 입력 (예: https://youtube.com/watch?v=...)"
              value={settings.youtubeUrl}
              onChange={(e) => setSettings(prev => ({ ...prev, youtubeUrl: e.target.value }))}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleYouTubeConnect}
              className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
            >
              연결
            </button>
          </div>
        </div>

        {/* 2. 가사 검색 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center mb-4">
            <Search className="w-6 h-6 text-blue-500 mr-2" />
            <h2 className="text-xl font-semibold">2. 가사 검색</h2>
          </div>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="아티스트 또는 노래 제목"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLyricsSearch()}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleLyricsSearch}
              disabled={isSearching}
              className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {isSearching ? '검색중...' : '검색'}
            </button>
          </div>

          {/* 검색 결과 */}
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  onClick={() => selectResult(result)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedResult?.id === result.id
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium">{result.title}</div>
                  <div className="text-sm text-gray-600">
                    {result.artist} • {result.provider}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. 싱크 조절 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center mb-4">
            <Settings className="w-6 h-6 text-blue-500 mr-2" />
            <h2 className="text-xl font-semibold">3. 싱크 조절</h2>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => adjustSync(-5)}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              -5초
            </button>
            <button
              onClick={() => adjustSync(-1)}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              -1초
            </button>
            <div className="px-6 py-2 bg-blue-50 rounded-lg min-w-[120px] text-center">
              <span className="font-mono font-semibold">
                {settings.syncOffset > 0 ? '+' : ''}{settings.syncOffset.toFixed(1)}초
              </span>
            </div>
            <button
              onClick={() => adjustSync(1)}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              +1초
            </button>
            <button
              onClick={() => adjustSync(5)}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              +5초
            </button>
          </div>
          <p className="text-sm text-gray-500 text-center mt-2">
            방송 중에도 단축키로 조절 가능합니다 (←/→)
          </p>
        </div>

        {/* 4. 시청자 설정 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center mb-4">
            <Monitor className="w-6 h-6 text-blue-500 mr-2" />
            <h2 className="text-xl font-semibold">4. 시청자 설정</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* 번역 언어 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                번역 언어
              </label>
              <select
                value={settings.viewerLanguage}
                onChange={(e) => setSettings(prev => ({ ...prev, viewerLanguage: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="en">영어</option>
                <option value="ja">일본어</option>
                <option value="zh">중국어</option>
                <option value="es">스페인어</option>
              </select>
            </div>

            {/* 폰트 크기 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                폰트 크기: {settings.fontSize}px
              </label>
              <input
                type="range"
                min="30"
                max="100"
                value={settings.fontSize}
                onChange={(e) => setSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                className="w-full"
              />
            </div>

            {/* 폰트 종류 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                폰트 종류
              </label>
              <select
                value={settings.fontFamily}
                onChange={(e) => setSettings(prev => ({ ...prev, fontFamily: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Noto Sans">Noto Sans</option>
                <option value="Pretendard">Pretendard</option>
                <option value="Inter">Inter</option>
              </select>
            </div>

            {/* 스타일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                스타일
              </label>
              <select
                value={settings.fontStyle}
                onChange={(e) => setSettings(prev => ({ ...prev, fontStyle: e.target.value as any }))}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="classic">클래식</option>
                <option value="kpop">K-POP</option>
                <option value="ballad">발라드</option>
              </select>
            </div>
          </div>
        </div>

        {/* 방송 시작 버튼 */}
        <button
          onClick={startBroadcast}
          disabled={isLive}
          className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all ${
            isLive
              ? 'bg-red-500 text-white cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-lg transform hover:-translate-y-0.5'
          }`}
        >
          {isLive ? (
            <span className="flex items-center justify-center">
              <Play className="w-5 h-5 mr-2" />
              방송 중...
            </span>
          ) : (
            '🔴 방송 시작'
          )}
        </button>

        {/* OBS 설정 안내 */}
        {isLive && (
          <div className="mt-4 p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-800">
              <strong>OBS 설정:</strong> 브라우저 소스 → URL: http://localhost:3002/obs/viewer
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// YouTube URL에서 video ID 추출
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}