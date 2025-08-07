'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast, Toaster } from 'sonner';
import { SearchIcon, PlayIcon, PauseIcon, ResetIcon, MoonIcon, SunIcon, MusicIcon, MicIcon, NextIcon, LoaderIcon } from '@/components/Icons';

// 인기 검색어
const popularSearches = [
  '샘킴 Make Up',
  '아이유 좋은날',
  'YOASOBI 夜に駆ける',
  'NewJeans Ditto',
  'BTS Dynamite',
  '임영웅 사랑은 늘 도망가',
  'Charlie Puth Left and Right',
  'Ed Sheeran Perfect'
];

// 검색 결과 타입
interface PronunciationResult {
  pronunciation: string;
  detectedLanguage: string;
  cached: boolean;
}

export default function Home() {
  // 다크모드
  const [isDark, setIsDark] = useState(false);
  
  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  // 가사 상태
  const [lyrics, setLyrics] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [showPronunciation, setShowPronunciation] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState('');
  
  // 재생 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  
  // 설정 패널
  const [activeTab, setActiveTab] = useState<'preview' | 'settings' | 'shortcuts'>('preview');
  const [fontSize, setFontSize] = useState(60);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [highlightColor, setHighlightColor] = useState('#FFD700');
  const [chromaColor, setChromaColor] = useState('#00FF00');
  
  // OBS URL
  const [obsUrl, setObsUrl] = useState('');
  
  // 자동 검색 API
  const searchAPIs = ['perplexity', 'gemini', 'claude', 'gpt'] as const;
  
  // 다크모드 초기화
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);
  
  // 최근 검색 불러오기
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);
  
  // 다크모드 토글
  const toggleDarkMode = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    
    if (newDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };
  
  // 스마트 파싱 (아티스트와 제목 분리)
  const parseSearchQuery = (query: string): { artist: string, title: string } => {
    // 패턴 매칭
    const patterns = [
      /^(.+?)\s*-\s*(.+)$/,     // "아티스트 - 제목"
      /^(.+?)의\s+(.+)$/,        // "아티스트의 제목"
      /^(.+?)\s+(.+)$/,          // "아티스트 제목"
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        return { artist: match[1].trim(), title: match[2].trim() };
      }
    }
    
    // 기본: 첫 단어를 아티스트로
    const words = query.split(' ');
    if (words.length >= 2) {
      return {
        artist: words[0],
        title: words.slice(1).join(' ')
      };
    }
    
    return { artist: query, title: '' };
  };
  
  // 검색 실행
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('검색어를 입력하세요');
      return;
    }
    
    // 파싱
    const { artist, title } = parseSearchQuery(searchQuery);
    
    if (!title) {
      toast.error('아티스트와 제목을 함께 입력하세요 (예: 아이유 좋은날)');
      return;
    }
    
    // 최근 검색에 추가
    const newRecent = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem('recentSearches', JSON.stringify(newRecent));
    
    setIsSearching(true);
    setCurrentStep(0);
    setLyrics('');
    setPronunciation('');
    setShowSuggestions(false);
    
    // 순차적 검색
    for (let i = 0; i < searchAPIs.length; i++) {
      setCurrentStep(i + 1);
      const api = searchAPIs[i];
      
      try {
        let response;
        
        switch (api) {
          case 'perplexity':
            response = await fetch('/api/lyrics/ai-search-multi', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ artist, title })
            });
            break;
            
          case 'gemini':
            response = await fetch('/api/lyrics/gemini-search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ artist, title })
            });
            break;
            
          case 'claude':
            response = await fetch('/api/lyrics/claude-search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ artist, title })
            });
            break;
            
          case 'gpt':
            response = await fetch('/api/lyrics/gpt-search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ artist, title })
            });
            break;
        }
        
        if (response && response.ok) {
          const data = await response.json();
          
          if (data.success && data.lyrics) {
            setLyrics(data.lyrics);
            toast.success(`가사를 찾았습니다!`);
            
            // 자동 발음 변환
            await handlePronunciation(data.lyrics);
            
            // localStorage 저장
            localStorage.setItem('current_lyrics', data.lyrics);
            localStorage.setItem('current_artist', artist);
            localStorage.setItem('current_title', title);
            
            // OBS URL 생성
            generateObsUrl();
            
            break;
          }
        }
      } catch (error) {
        console.error(`${api} search error:`, error);
      }
    }
    
    setIsSearching(false);
    
    if (!lyrics) {
      toast.error('가사를 찾을 수 없습니다');
    }
  };
  
  // 발음 변환
  const handlePronunciation = async (text: string) => {
    try {
      const response = await fetch('/api/pronunciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang: 'ko' })
      });
      
      if (response.ok) {
        const data: PronunciationResult = await response.json();
        setPronunciation(data.pronunciation);
        setDetectedLanguage(data.detectedLanguage);
        localStorage.setItem('lyrics_pronunciation', data.pronunciation);
        
        if (data.detectedLanguage !== 'ko' && data.detectedLanguage !== 'unknown') {
          toast.success('발음 변환 완료');
          setShowPronunciation(true);
        }
      }
    } catch (error) {
      console.error('Pronunciation error:', error);
    }
  };
  
  // OBS URL 생성
  const generateObsUrl = () => {
    const params = new URLSearchParams({
      chromaKey: chromaColor,
      fontSize: fontSize.toString(),
      textColor,
      highlightColor,
      showTranslation: 'false'
    });
    
    const url = `${window.location.origin}/obs?${params}`;
    setObsUrl(url);
  };
  
  // 재생 제어
  const handlePlayPause = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);
    localStorage.setItem('obs_control', newState ? 'play' : 'pause');
  };
  
  const handleReset = () => {
    setCurrentLineIndex(0);
    setIsPlaying(false);
    localStorage.setItem('obs_control', 'reset');
    localStorage.setItem('current_line_index', '0');
  };
  
  // 키보드 단축키
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying]);
  
  // 크로마키 프리뷰
  const renderChromaPreview = () => {
    const lines = (showPronunciation ? pronunciation : lyrics).split('\n').filter(l => l.trim());
    const currentLine = lines[currentLineIndex] || '';
    const nextLine = lines[currentLineIndex + 1] || '';
    
    return (
      <div 
        className="w-full h-64 rounded-2xl overflow-hidden relative shadow-2xl"
        style={{ backgroundColor: chromaColor }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
          <div 
            className="text-center font-bold mb-4 animate-fade-in"
            style={{ 
              fontSize: fontSize * 0.4,
              color: textColor,
              textShadow: '3px 3px 6px rgba(0,0,0,0.9)'
            }}
          >
            {currentLine}
          </div>
          <div 
            className="text-center opacity-70"
            style={{ 
              fontSize: fontSize * 0.3,
              color: textColor,
              textShadow: '2px 2px 4px rgba(0,0,0,0.9)'
            }}
          >
            {nextLine}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className={`min-h-screen transition-all duration-700 relative overflow-hidden ${
      isDark 
        ? 'bg-gradient-to-br from-slate-950 via-purple-950/50 to-black' 
        : 'bg-gradient-to-br from-blue-50 via-violet-50 to-pink-50'
    }`}>
      <Toaster position="top-center" theme={isDark ? 'dark' : 'light'} />
      
      {/* iOS 26 리퀴드 글래스 배경 효과 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* 그라디언트 메시 오브 */}
        <div className="absolute top-20 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-float" />
        <div className="absolute top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-float-delayed" />
        <div className="absolute -bottom-20 left-40 w-80 h-80 bg-gradient-to-br from-violet-400 to-indigo-400 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-float-slow" />
        
        {/* 스펙큘러 하이라이트 */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-1/2 h-64 bg-gradient-to-b from-white/5 to-transparent blur-2xl" />
          <div className="absolute bottom-0 right-1/4 w-1/2 h-64 bg-gradient-to-t from-white/5 to-transparent blur-2xl" />
        </div>
      </div>
      
      {/* iOS 26 리퀴드 글래스 헤더 */}
      <header className={`relative z-50 backdrop-blur-2xl backdrop-saturate-200 border-b ${
        isDark 
          ? 'bg-black/10 border-white/10 shadow-2xl shadow-black/20' 
          : 'bg-white/30 border-white/20 shadow-2xl shadow-black/5'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className={`relative p-2 rounded-2xl backdrop-blur-xl ${
                isDark 
                  ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 shadow-lg shadow-purple-500/10' 
                  : 'bg-gradient-to-br from-purple-400/20 to-pink-400/20 shadow-lg shadow-purple-400/10'
              }`}>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/20 to-white/0" />
                <div className={`relative ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <MusicIcon />
                </div>
              </div>
              <h1 className={`text-2xl font-semibold tracking-tight`}>
                <span className={`bg-gradient-to-r ${
                  isDark 
                    ? 'from-white via-purple-200 to-pink-200' 
                    : 'from-gray-900 via-purple-700 to-pink-700'
                } bg-clip-text text-transparent`}>
                  Karaoke Live
                </span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full backdrop-blur-xl ${
                  isDark
                    ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-purple-200 border border-purple-400/30'
                    : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-700 border border-purple-300/30'
                }`}>
                  Pro
                </span>
              </h1>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative p-3 rounded-2xl transition-all duration-300 hover:scale-105 group ${
                isDark 
                  ? 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl border border-white/10 hover:border-yellow-400/30' 
                  : 'bg-gradient-to-br from-white/50 to-gray-100/50 backdrop-blur-xl border border-black/5 hover:border-purple-400/30'
              }`}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className={`relative transition-transform group-hover:rotate-12 ${
                isDark ? 'text-yellow-400' : 'text-purple-600'
              }`}>
                {isDark ? <SunIcon /> : <MoonIcon />}
              </div>
            </button>
          </div>
        </div>
      </header>
      
      {/* 메인 컨텐츠 */}
      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* iOS 26 리퀴드 글래스 검색창 */}
        <div className={`relative backdrop-blur-2xl backdrop-saturate-200 rounded-3xl p-8 mb-8 overflow-hidden ${
          isDark 
            ? 'bg-gradient-to-br from-gray-800/30 via-gray-800/20 to-gray-900/30 border border-white/10 shadow-2xl shadow-black/30' 
            : 'bg-gradient-to-br from-white/40 via-white/30 to-white/40 border border-white/30 shadow-2xl shadow-black/10'
        }`}>
          {/* 글래스 하이라이트 효과 */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl" />
          <div className="relative">
            <div className="relative">
              <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder="노래 검색하기... (예: 아이유 좋은날, YOASOBI 夜に駆ける)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className={`w-full pl-12 pr-32 py-4 text-lg rounded-2xl backdrop-blur-xl transition-all duration-300 ${
                  isDark 
                    ? 'bg-black/30 text-white border border-white/20 focus:border-purple-400 focus:bg-black/40' 
                    : 'bg-white/50 text-gray-900 border border-black/10 focus:border-purple-500 focus:bg-white/70'
                } focus:outline-none focus:ring-4 focus:ring-purple-500/20 placeholder:text-gray-500`}
              />
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className={`absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 group ${
                  isSearching || !searchQuery.trim()
                    ? 'bg-gray-400/50 backdrop-blur-xl cursor-not-allowed opacity-50'
                    : isDark
                      ? 'bg-gradient-to-r from-purple-500/80 to-pink-500/80 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg hover:shadow-xl hover:scale-105 backdrop-blur-xl border border-white/20'
                      : 'bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl hover:scale-105 backdrop-blur-xl border border-white/30'
                }`}
              >
                <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  {isSearching ? (
                    <LoaderIcon className="w-5 h-5" />
                  ) : (
                    '검색'
                  )}
                </div>
              </button>
            </div>
            
            {/* iOS 26 스타일 검색 제안 */}
            {showSuggestions && (
              <div className={`absolute top-full left-0 right-0 mt-3 rounded-2xl overflow-hidden z-50 backdrop-blur-2xl backdrop-saturate-200 ${
                isDark 
                  ? 'bg-gray-900/80 border border-white/10 shadow-2xl shadow-black/50' 
                  : 'bg-white/80 border border-black/5 shadow-2xl shadow-black/20'
              }`}>
                {recentSearches.length > 0 && (
                  <div>
                    <div className={`px-4 py-2.5 text-xs font-semibold tracking-wide backdrop-blur-xl ${
                      isDark 
                        ? 'text-gray-400 bg-black/20 border-b border-white/5' 
                        : 'text-gray-600 bg-white/30 border-b border-black/5'
                    }`}>
                      <span className="inline-block mr-2 text-base">📋</span>
                      최근 검색
                    </div>
                    {recentSearches.map((search, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSearchQuery(search);
                          handleSearch();
                        }}
                        className={`w-full px-4 py-3 text-left transition-all duration-200 group ${
                          isDark 
                            ? 'hover:bg-white/5 text-gray-300 hover:text-white' 
                            : 'hover:bg-black/5 text-gray-700 hover:text-gray-900'
                        }`}
                      >
                        {search}
                      </button>
                    ))}
                  </div>
                )}
                <div>
                  <div className={`px-4 py-2.5 text-xs font-semibold tracking-wide backdrop-blur-xl ${
                    isDark 
                      ? 'text-gray-400 bg-black/20 border-b border-white/5' 
                      : 'text-gray-600 bg-white/30 border-b border-black/5'
                  }`}>
                    <span className="inline-block mr-2 text-base">🔥</span>
                    인기 검색
                  </div>
                  {popularSearches.map((search, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSearchQuery(search);
                        handleSearch();
                      }}
                      className={`w-full px-4 py-3 text-left transition-all duration-200 group ${
                        isDark 
                          ? 'hover:bg-white/5 text-gray-300 hover:text-white' 
                          : 'hover:bg-black/5 text-gray-700 hover:text-gray-900'
                      }`}
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* 검색 진행 상태 */}
          {isSearching && (
            <div className="mt-4">
              <div className="flex items-center justify-center gap-2">
                <LoaderIcon className="w-5 h-5 text-purple-500" />
                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                  검색 중... ({currentStep}/{searchAPIs.length})
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* iOS 26 리퀴드 글래스 메인 영역 */}
        {lyrics && (
          <div className={`relative backdrop-blur-2xl backdrop-saturate-200 rounded-3xl overflow-hidden ${
            isDark 
              ? 'bg-gradient-to-br from-gray-800/30 via-gray-800/20 to-gray-900/30 border border-white/10 shadow-2xl shadow-black/30' 
              : 'bg-gradient-to-br from-white/40 via-white/30 to-white/40 border border-white/30 shadow-2xl shadow-black/10'
          }`}>
            {/* 글래스 하이라이트 */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
            {/* iOS 26 스타일 탭 헤더 */}
            <div className={`relative flex backdrop-blur-xl border-b ${
              isDark ? 'border-white/10 bg-black/10' : 'border-black/5 bg-white/20'
            }`}>
              <button
                onClick={() => setActiveTab('preview')}
                className={`relative flex-1 px-6 py-4 font-medium transition-all duration-300 ${
                  activeTab === 'preview'
                    ? isDark 
                      ? 'text-white'
                      : 'text-gray-900'
                    : isDark
                      ? 'text-gray-400 hover:text-gray-200'
                      : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {activeTab === 'preview' && (
                  <div className={`absolute inset-0 rounded-t-xl ${
                    isDark
                      ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-b-2 border-purple-400'
                      : 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b-2 border-purple-600'
                  }`} />
                )}
                <span className="relative">미리보기</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 px-6 py-4 font-medium transition-colors ${
                  activeTab === 'settings'
                    ? isDark 
                      ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-400'
                      : 'bg-purple-50 text-purple-600 border-b-2 border-purple-600'
                    : isDark
                      ? 'text-gray-400 hover:text-gray-300'
                      : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                설정
              </button>
              <button
                onClick={() => setActiveTab('shortcuts')}
                className={`flex-1 px-6 py-4 font-medium transition-colors ${
                  activeTab === 'shortcuts'
                    ? isDark 
                      ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-400'
                      : 'bg-purple-50 text-purple-600 border-b-2 border-purple-600'
                    : isDark
                      ? 'text-gray-400 hover:text-gray-300'
                      : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                단축키
              </button>
            </div>
            
            {/* 탭 컨텐츠 */}
            <div className="p-8">
              {activeTab === 'preview' && (
                <div className="space-y-6">
                  {/* 발음 전환 */}
                  {pronunciation && detectedLanguage !== 'ko' && (
                    <div className="flex justify-center">
                      <button
                        onClick={() => setShowPronunciation(!showPronunciation)}
                        className={`px-4 py-2 rounded-xl font-medium transition-all ${
                          isDark
                            ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        <span className="inline-block mr-2"><MicIcon /></span>
                        {showPronunciation ? '원본 보기' : '발음 보기'}
                      </button>
                    </div>
                  )}
                  
                  {/* 크로마키 프리뷰 */}
                  {renderChromaPreview()}
                  
                  {/* 재생 컨트롤 */}
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={handleReset}
                      className={`p-3 rounded-xl transition-all hover:scale-110 ${
                        isDark
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      <ResetIcon />
                    </button>
                    <button
                      onClick={handlePlayPause}
                      className={`p-4 rounded-xl transition-all hover:scale-110 shadow-xl ${
                        isDark
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                      }`}
                    >
                      {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <button
                      onClick={() => {
                        const lines = (showPronunciation ? pronunciation : lyrics).split('\n').filter(l => l.trim());
                        const newIndex = Math.min(currentLineIndex + 1, lines.length - 1);
                        setCurrentLineIndex(newIndex);
                        localStorage.setItem('current_line_index', newIndex.toString());
                      }}
                      className={`p-3 rounded-xl transition-all hover:scale-110 ${
                        isDark
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      <NextIcon />
                    </button>
                  </div>
                  
                  {/* 진행 상태 */}
                  <div className={`text-center text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    라인 {currentLineIndex + 1} / {(showPronunciation ? pronunciation : lyrics).split('\n').filter(l => l.trim()).length}
                  </div>
                </div>
              )}
              
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  {/* 크로마키 색상 */}
                  <div>
                    <label className={`text-sm font-medium mb-3 block ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>크로마키 색상</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { color: '#00FF00', name: '녹색' },
                        { color: '#0000FF', name: '파란색' },
                        { color: '#FF00FF', name: '마젠타' }
                      ].map((item) => (
                        <button
                          key={item.color}
                          onClick={() => setChromaColor(item.color)}
                          className={`py-3 rounded-xl font-medium transition-all ${
                            chromaColor === item.color
                              ? isDark
                                ? 'bg-purple-500/30 text-purple-400 border-2 border-purple-400'
                                : 'bg-purple-100 text-purple-700 border-2 border-purple-600'
                              : isDark
                                ? 'bg-gray-700 text-gray-300 border-2 border-transparent hover:border-gray-600'
                                : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:border-gray-300'
                          }`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* 글자 크기 */}
                  <div>
                    <label className={`text-sm font-medium mb-3 block ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      글자 크기: {fontSize}px
                    </label>
                    <input
                      type="range"
                      min="30"
                      max="120"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                  </div>
                  
                  {/* OBS URL */}
                  {obsUrl && (
                    <div>
                      <label className={`text-sm font-medium mb-3 block ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>OBS 브라우저 소스</label>
                      <div className={`p-4 rounded-xl ${
                        isDark ? 'bg-gray-900/50' : 'bg-gray-50'
                      }`}>
                        <div className={`text-xs break-all mb-3 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {obsUrl}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(obsUrl);
                            toast.success('URL 복사됨!');
                          }}
                          className={`w-full py-2 rounded-xl font-medium transition-all ${
                            isDark
                              ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                              : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          }`}
                        >
                          URL 복사
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'shortcuts' && (
                <div className={`space-y-3 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <div className="flex justify-between py-2">
                    <span>재생/일시정지</span>
                    <kbd className={`px-3 py-1 rounded-lg text-sm font-mono ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>Space</kbd>
                  </div>
                  <div className="flex justify-between py-2">
                    <span>리셋</span>
                    <kbd className={`px-3 py-1 rounded-lg text-sm font-mono ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>R</kbd>
                  </div>
                  <div className="flex justify-between py-2">
                    <span>다음 라인</span>
                    <kbd className={`px-3 py-1 rounded-lg text-sm font-mono ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>→</kbd>
                  </div>
                  <div className="flex justify-between py-2">
                    <span>이전 라인</span>
                    <kbd className={`px-3 py-1 rounded-lg text-sm font-mono ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>←</kbd>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}