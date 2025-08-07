'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast, Toaster } from 'sonner';
import { SearchIcon, PlayIcon, PauseIcon, ResetIcon, MoonIcon, SunIcon, MusicIcon, MicIcon, NextIcon, LoaderIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/Icons';
import { DEFAULT_SEARCH_PROMPT } from '@/lib/constants/defaultPrompt';
import { supabase } from '@/lib/supabase';

// 기본 인기 검색어
const defaultPopularSearches = [
  '아이유 좋은날',
  'NewJeans Ditto',
  'YOASOBI 夜に駆ける',
  '임영웅 사랑은 늘 도망가',
  'BTS Dynamite'
];

// 언어 옵션
const LANGUAGE_OPTIONS = [
  { value: 'en', label: '영어' },
  { value: 'ja', label: '일본어' },
  { value: 'zh', label: '중국어' },
  { value: 'es', label: '스페인어' },
  { value: 'fr', label: '프랑스어' }
];

interface Song {
  id: string;
  artist: string;
  title: string;
  lyrics: string;
  playCount?: number;
  lastPlayed?: string;
  youtubeUrl?: string;
}

interface Translation {
  [language: string]: string[];
}

export default function Home() {
  // 다크모드
  const [isDark, setIsDark] = useState(false);
  
  // 탭 상태
  const [activeTab, setActiveTab] = useState<'dashboard' | 'search' | 'prompt' | 'preview' | 'settings'>('dashboard');
  
  // 대시보드 상태
  const [favoriteSongs, setFavoriteSongs] = useState<Song[]>([]);
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);
  
  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularSearches, setPopularSearches] = useState<string[]>(defaultPopularSearches);
  
  // 가사 상태
  const [lyrics, setLyrics] = useState('');
  const [lyricsPreview, setLyricsPreview] = useState('');
  const [lyricsLines, setLyricsLines] = useState<string[]>([]);
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [confirmedLyrics, setConfirmedLyrics] = useState('');
  const [lastSearchedArtist, setLastSearchedArtist] = useState('');
  const [lastSearchedTitle, setLastSearchedTitle] = useState('');
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  
  // YouTube/MR 상태
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  
  // 번역 상태
  const [targetLanguages, setTargetLanguages] = useState<string[]>(['en']);
  const [translations, setTranslations] = useState<Translation>({});
  const [isTranslating, setIsTranslating] = useState(false);
  
  // 프롬프트 상태
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_SEARCH_PROMPT);
  
  // 재생/진행 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [manualMode, setManualMode] = useState(true);
  const [isRecordingTimings, setIsRecordingTimings] = useState(false);
  const [timingData, setTimingData] = useState<any[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  
  // 설정 상태
  const [fontSize, setFontSize] = useState(60);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [highlightColor, setHighlightColor] = useState('#FFD700');
  const [chromaColor, setChromaColor] = useState('#00FF00');
  const [obsUrl, setObsUrl] = useState('');
  
  // 사용자 세션
  const [userSession, setUserSession] = useState('');
  
  // 초기화
  useEffect(() => {
    // 사용자 세션 생성/복구
    let session = localStorage.getItem('user_session');
    if (!session) {
      session = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('user_session', session);
    }
    setUserSession(session);
    
    // 다크모드 초기화
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
    
    // 플레이리스트 로드
    loadPlaylist(session);
  }, []);
  
  // 플레이리스트 로드
  const loadPlaylist = async (session: string) => {
    try {
      // 즐겨찾기 로드
      const { data: favorites } = await supabase
        .from('playlists')
        .select(`
          *,
          songs (*)
        `)
        .eq('user_session', session)
        .eq('is_favorite', true)
        .order('play_count', { ascending: false })
        .limit(5);
      
      if (favorites) {
        setFavoriteSongs(favorites.map((f: any) => ({
          ...f.songs,
          playCount: f.play_count,
          lastPlayed: f.last_played
        })));
      }
      
      // 최근 재생 로드
      const { data: recent } = await supabase
        .from('playlists')
        .select(`
          *,
          songs (*)
        `)
        .eq('user_session', session)
        .order('last_played', { ascending: false, nullsLast: true })
        .limit(5);
      
      if (recent) {
        setRecentSongs(recent.map((r: any) => ({
          ...r.songs,
          playCount: r.play_count,
          lastPlayed: r.last_played
        })));
      }
    } catch (error) {
      console.error('Failed to load playlist:', error);
    }
  };
  
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
  
  // YouTube URL에서 ID 추출
  const extractYoutubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    return match ? match[1] : '';
  };
  
  // 검색어 파싱
  const parseSearchQuery = (query: string) => {
    const parts = query.split(' ');
    const dashIndex = parts.indexOf('-');
    
    if (dashIndex > 0) {
      const artist = parts.slice(0, dashIndex).join(' ').trim();
      const title = parts.slice(dashIndex + 1).join(' ').trim();
      return { artist, title };
    }
    
    if (parts.length >= 2) {
      return {
        artist: parts[0],
        title: parts.slice(1).join(' ')
      };
    }
    
    return { artist: query, title: '' };
  };
  
  // 가사 검색
  const handleSearch = async (useCustomPrompt = true) => {
    if (!searchQuery.trim() && !lastSearchedArtist) {
      toast.error('검색어를 입력하세요');
      return;
    }
    
    const queryToUse = searchQuery || `${lastSearchedArtist} ${lastSearchedTitle}`;
    const { artist, title } = parseSearchQuery(queryToUse);
    
    if (!title) {
      toast.error('아티스트와 제목을 함께 입력하세요 (예: 아이유 좋은날)');
      return;
    }
    
    setLastSearchedArtist(artist);
    setLastSearchedTitle(title);
    
    // 최근 검색 저장
    const newRecent = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem('recentSearches', JSON.stringify(newRecent));
    
    setIsSearching(true);
    setLyrics('');
    setLyricsPreview('');
    
    try {
      // 1. DB에서 먼저 검색
      const { data: existingSong } = await supabase
        .from('songs')
        .select('*')
        .eq('artist', artist)
        .eq('title', title)
        .single();
      
      if (existingSong) {
        // DB에 있으면 바로 사용
        setCurrentSongId(existingSong.id);
        setLyrics(existingSong.lyrics);
        setLyricsPreview(existingSong.lyrics);
        setLyricsLines(existingSong.lyrics.split('\n').filter((line: string) => line.trim()));
        
        // 검색 카운트 증가
        await supabase
          .from('songs')
          .update({ search_count: (existingSong.search_count || 0) + 1 })
          .eq('id', existingSong.id);
        
        toast.success('저장된 가사를 불러왔습니다!');
        setActiveTab('preview');
      } else {
        // 2. API로 검색
        const response = await fetch('/api/lyrics/ai-search-multi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            artist, 
            title,
            customPrompt: useCustomPrompt ? customPrompt.replace('{artist}', artist).replace('{title}', title) : undefined
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          
          let lyricsData = null;
          if (data.success && data.results && data.results.length > 0) {
            const bestResult = data.results[0];
            if (bestResult.lyrics && bestResult.confidence > 0) {
              lyricsData = bestResult.lyrics;
            }
          } else if (data.success && data.lyrics) {
            lyricsData = data.lyrics;
          }
          
          if (lyricsData) {
            // 3. DB에 저장
            const { data: newSong } = await supabase
              .from('songs')
              .insert({
                artist,
                title,
                lyrics: lyricsData,
                lyrics_language: 'ko',
                search_count: 1
              })
              .select()
              .single();
            
            if (newSong) {
              setCurrentSongId(newSong.id);
            }
            
            setLyrics(lyricsData);
            setLyricsPreview(lyricsData);
            setLyricsLines(lyricsData.split('\n').filter(line => line.trim()));
            toast.success('가사를 찾았습니다! 확인 후 OBS로 전송하세요.');
            setActiveTab('preview');
          } else {
            toast.error('가사를 찾을 수 없습니다.');
          }
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('검색 중 오류가 발생했습니다.');
    }
    
    setIsSearching(false);
  };
  
  // 번역 실행
  const translateLyrics = async () => {
    if (!currentSongId || targetLanguages.length === 0) {
      toast.error('번역할 가사와 언어를 선택하세요.');
      return;
    }
    
    setIsTranslating(true);
    const newTranslations: Translation = {};
    
    try {
      for (const lang of targetLanguages) {
        // 1. 캐시 확인
        const { data: cached } = await supabase
          .from('translations_cache')
          .select('full_translation')
          .eq('song_id', currentSongId)
          .eq('target_language', lang)
          .single();
        
        if (cached) {
          newTranslations[lang] = cached.full_translation.lines.map((l: any) => l.translated);
          continue;
        }
        
        // 2. 번역 API 호출
        const response = await fetch('/api/translate/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lines: lyricsLines,
            targetLanguage: lang,
            context: {
              artist: lastSearchedArtist,
              title: lastSearchedTitle
            }
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          newTranslations[lang] = data.translations;
          
          // 3. 캐시 저장
          await supabase
            .from('translations_cache')
            .insert({
              song_id: currentSongId,
              source_language: 'ko',
              target_language: lang,
              full_translation: {
                lines: lyricsLines.map((line, idx) => ({
                  original: line,
                  translated: data.translations[idx]
                }))
              }
            });
        }
      }
      
      setTranslations(newTranslations);
      toast.success('번역이 완료되었습니다!');
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('번역 중 오류가 발생했습니다.');
    }
    
    setIsTranslating(false);
  };
  
  // 가사 확인 및 OBS 전송
  const confirmAndSendToOBS = async () => {
    if (!lyricsPreview) {
      toast.error('전송할 가사가 없습니다.');
      return;
    }
    
    // localStorage에 저장
    localStorage.setItem('current_lyrics', lyricsPreview);
    localStorage.setItem('current_artist', lastSearchedArtist);
    localStorage.setItem('current_title', lastSearchedTitle);
    localStorage.setItem('current_line_index', '0');
    localStorage.setItem('current_translations', JSON.stringify(translations));
    localStorage.setItem('target_languages', JSON.stringify(targetLanguages));
    
    setConfirmedLyrics(lyricsPreview);
    
    // YouTube URL 저장
    if (youtubeUrl) {
      localStorage.setItem('current_youtube_url', youtubeUrl);
    }
    
    // 플레이리스트에 추가/업데이트
    if (currentSongId) {
      await supabase
        .from('playlists')
        .upsert({
          user_session: userSession,
          song_id: currentSongId,
          play_count: 1,
          last_played: new Date().toISOString()
        }, {
          onConflict: 'user_session,song_id'
        });
    }
    
    // OBS URL 생성
    generateObsUrl();
    
    toast.success('가사가 OBS로 전송되었습니다!', {
      description: 'OBS 브라우저 소스에서 가사를 확인하세요.'
    });
  };
  
  // OBS URL 생성
  const generateObsUrl = () => {
    const params = new URLSearchParams({
      chromaKey: chromaColor,
      fontSize: fontSize.toString(),
      textColor,
      highlightColor,
      lang: targetLanguages.join(','),
      showTranslation: 'true'
    });
    
    const url = `${window.location.origin}/obs?${params.toString()}`;
    setObsUrl(url);
    return url;
  };
  
  // 라인 이동
  const goToLine = (index: number) => {
    if (index >= 0 && index < lyricsLines.length) {
      setCurrentLineIndex(index);
      localStorage.setItem('current_line_index', index.toString());
      
      // 타이밍 기록
      if (isRecordingTimings) {
        const currentTime = (Date.now() - sessionStartTime) / 1000;
        setTimingData([...timingData, { line_index: index, clicked_at: currentTime }]);
      }
    }
  };
  
  const nextLine = () => goToLine(currentLineIndex + 1);
  const prevLine = () => goToLine(currentLineIndex - 1);
  
  // 타이밍 기록 시작/중지
  const toggleTimingRecording = () => {
    if (!isRecordingTimings) {
      setSessionStartTime(Date.now());
      setTimingData([]);
      setIsRecordingTimings(true);
      toast.info('타이밍 기록을 시작합니다.');
    } else {
      setIsRecordingTimings(false);
      // 타이밍 데이터 저장
      if (currentSongId && timingData.length > 0) {
        saveTi밍Data();
      }
      toast.success('타이밍 기록이 완료되었습니다.');
    }
  };
  
  // 타이밍 데이터 저장
  const saveTimingData = async () => {
    if (!currentSongId) return;
    
    try {
      // 세션 저장
      await supabase
        .from('play_sessions')
        .insert({
          song_id: currentSongId,
          user_session: userSession,
          line_timings: timingData,
          translation_languages: targetLanguages,
          completed: true
        });
      
      // 타이밍 패턴 업데이트
      for (const timing of timingData) {
        // 여기서는 저장 프로시저를 호출하거나 직접 업데이트
        // update_timing_pattern 함수 호출
      }
    } catch (error) {
      console.error('Failed to save timing data:', error);
    }
  };
  
  // 재생 컨트롤
  const handlePlay = () => {
    setIsPlaying(true);
    localStorage.setItem('karaoke_control', 'play');
  };
  
  const handlePause = () => {
    setIsPlaying(false);
    localStorage.setItem('karaoke_control', 'pause');
  };
  
  const handleReset = () => {
    setIsPlaying(false);
    setCurrentLineIndex(0);
    localStorage.setItem('karaoke_control', 'reset');
    localStorage.setItem('current_line_index', '0');
  };
  
  // 키보드 단축키
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (activeTab === 'preview' && confirmedLyrics) {
        switch (e.key) {
          case ' ':
            e.preventDefault();
            nextLine();
            break;
          case 'ArrowLeft':
            prevLine();
            break;
          case 'ArrowRight':
            nextLine();
            break;
          case 'r':
          case 'R':
            handleReset();
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeTab, confirmedLyrics, currentLineIndex, lyricsLines]);
  
  // 대시보드에서 바로 시작
  const quickStart = async (song: Song) => {
    setSearchQuery(`${song.artist} ${song.title}`);
    setLastSearchedArtist(song.artist);
    setLastSearchedTitle(song.title);
    setCurrentSongId(song.id);
    setLyrics(song.lyrics);
    setLyricsPreview(song.lyrics);
    setLyricsLines(song.lyrics.split('\n').filter(line => line.trim()));
    
    if (song.youtubeUrl) {
      setYoutubeUrl(song.youtubeUrl);
      setYoutubeId(extractYoutubeId(song.youtubeUrl));
    }
    
    setActiveTab('preview');
    toast.success('가사를 불러왔습니다!');
  };
  
  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'}`}>
      <Toaster position="top-center" />
      
      {/* 헤더 */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <MusicIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                노래방 가사 번역기 - 호스트 컨트롤
              </h1>
            </div>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {isDark ? (
                <SunIcon className="w-5 h-5 text-yellow-500" />
              ) : (
                <MoonIcon className="w-5 h-5 text-gray-700" />
              )}
            </button>
          </div>
        </div>
      </header>
      
      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 탭 메뉴 */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
          {['dashboard', 'search', 'prompt', 'preview', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 px-4 py-2 rounded-md transition-all ${
                activeTab === tab
                  ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab === 'dashboard' && '🏠 대시보드'}
              {tab === 'search' && '🔍 가사 검색'}
              {tab === 'prompt' && '✏️ 프롬프트'}
              {tab === 'preview' && '👁️ 미리보기'}
              {tab === 'settings' && '⚙️ OBS 설정'}
            </button>
          ))}
        </div>
        
        {/* 대시보드 탭 */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 자주 부르는 노래 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                🔥 자주 부르는 노래
              </h2>
              {favoriteSongs.length > 0 ? (
                <div className="space-y-3">
                  {favoriteSongs.map((song, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <p className="font-medium">{song.artist} - {song.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          재생 {song.playCount || 0}회 | 마지막: {song.lastPlayed ? new Date(song.lastPlayed).toLocaleDateString() : '없음'}
                        </p>
                      </div>
                      <button
                        onClick={() => quickStart(song)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
                      >
                        ▶ 바로시작
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">아직 자주 부른 노래가 없습니다.</p>
              )}
            </div>
            
            {/* 최근 노래 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                ⏰ 최근 노래
              </h2>
              {recentSongs.length > 0 ? (
                <div className="space-y-3">
                  {recentSongs.map((song, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <p className="font-medium">{song.artist} - {song.title}</p>
                      </div>
                      <button
                        onClick={() => quickStart(song)}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
                      >
                        시작
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">최근 부른 노래가 없습니다.</p>
              )}
            </div>
          </div>
        )}
        
        {/* 검색 탭 */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            {/* 검색 바 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="space-y-4">
                {/* 가사 검색 */}
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="아티스트 제목 (예: 아이유 좋은날)"
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                  <button
                    onClick={() => handleSearch()}
                    disabled={isSearching}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSearching ? (
                      <>
                        <LoaderIcon className="w-5 h-5 animate-spin" />
                        검색 중...
                      </>
                    ) : (
                      <>
                        <SearchIcon className="w-5 h-5" />
                        검색
                      </>
                    )}
                  </button>
                </div>
                
                {/* YouTube URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    YouTube MR URL (선택사항)
                  </label>
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => {
                      setYoutubeUrl(e.target.value);
                      setYoutubeId(extractYoutubeId(e.target.value));
                    }}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                
                {/* 번역 언어 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    번역 언어 선택
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <label key={lang.value} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={targetLanguages.includes(lang.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTargetLanguages([...targetLanguages, lang.value]);
                            } else {
                              setTargetLanguages(targetLanguages.filter(l => l !== lang.value));
                            }
                          }}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{lang.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* 인기/최근 검색어 */}
              <div className="mt-6 flex gap-6">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">인기 검색어</p>
                  <div className="flex flex-wrap gap-2">
                    {popularSearches.map((search, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSearchQuery(search)}
                        className="px-3 py-1 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                      >
                        {search}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 프롬프트 탭 */}
        {activeTab === 'prompt' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                검색 프롬프트 커스터마이징
              </h2>
              <button
                onClick={() => {
                  setCustomPrompt(DEFAULT_SEARCH_PROMPT);
                  toast.success('프롬프트가 초기화되었습니다.');
                }}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                초기화
              </button>
            </div>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full h-96 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
              placeholder="프롬프트를 입력하세요..."
            />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              💡 팁: {'{artist}'}, {'{title}'} 변수를 사용할 수 있습니다.
            </p>
          </div>
        )}
        
        {/* 미리보기 탭 */}
        {activeTab === 'preview' && (
          <div className="space-y-6">
            {/* 가사 미리보기 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  가사 미리보기 및 편집
                </h2>
                <div className="flex gap-2">
                  {currentSongId && targetLanguages.length > 0 && (
                    <button
                      onClick={translateLyrics}
                      disabled={isTranslating}
                      className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isTranslating ? '번역 중...' : '번역하기'}
                    </button>
                  )}
                  <button
                    onClick={() => setIsEditingLyrics(!isEditingLyrics)}
                    className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    {isEditingLyrics ? '편집 완료' : '편집'}
                  </button>
                  <button
                    onClick={() => handleSearch(true)}
                    className="px-4 py-2 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 rounded-lg transition-colors"
                  >
                    재검색
                  </button>
                </div>
              </div>
              
              {lyricsPreview ? (
                <>
                  {/* 현재 라인 표시 */}
                  {confirmedLyrics && (
                    <div className="mb-4 p-4 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        현재: {currentLineIndex + 1} / {lyricsLines.length}
                      </p>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {lyricsLines[currentLineIndex]}
                      </h3>
                      {Object.entries(translations).map(([lang, lines]) => (
                        <p key={lang} className="text-lg text-gray-600 dark:text-gray-300 mt-2">
                          {LANGUAGE_OPTIONS.find(l => l.value === lang)?.label}: {lines[currentLineIndex]}
                        </p>
                      ))}
                      {currentLineIndex < lyricsLines.length - 1 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                          다음: {lyricsLines[currentLineIndex + 1]}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* 전체 가사 */}
                  <textarea
                    value={lyricsPreview}
                    onChange={(e) => {
                      setLyricsPreview(e.target.value);
                      setLyricsLines(e.target.value.split('\n').filter(line => line.trim()));
                    }}
                    readOnly={!isEditingLyrics}
                    className={`w-full h-64 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none ${
                      !isEditingLyrics ? 'cursor-default' : ''
                    }`}
                  />
                  
                  {/* 컨트롤 버튼 */}
                  <div className="mt-4 flex flex-col gap-4">
                    {/* 진행 컨트롤 */}
                    {confirmedLyrics && (
                      <div className="flex justify-center gap-4">
                        <button
                          onClick={prevLine}
                          disabled={currentLineIndex === 0}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
                        >
                          ◀ 이전
                        </button>
                        <button
                          onClick={nextLine}
                          disabled={currentLineIndex >= lyricsLines.length - 1}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
                        >
                          다음 ▶
                        </button>
                        <button
                          onClick={toggleTimingRecording}
                          className={`px-4 py-2 ${isRecordingTimings ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg transition-colors`}
                        >
                          {isRecordingTimings ? '⏺ 기록 중지' : '⏺ 타이밍 기록'}
                        </button>
                      </div>
                    )}
                    
                    {/* OBS 전송 버튼 */}
                    <div className="flex justify-center">
                      <button
                        onClick={confirmAndSendToOBS}
                        className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        ✅ 가사 확인 및 OBS 전송
                      </button>
                    </div>
                  </div>
                  
                  {/* 키보드 단축키 안내 */}
                  {confirmedLyrics && (
                    <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        키보드 단축키: Space(다음) | ←(이전) | →(다음) | R(처음부터)
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  검색된 가사가 없습니다. 먼저 가사를 검색해주세요.
                </div>
              )}
            </div>
            
            {/* YouTube 플레이어 */}
            {youtubeId && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  YouTube MR
                </h2>
                <div className="aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    className="w-full h-full rounded-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
            
            {/* 재생 컨트롤 */}
            {confirmedLyrics && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  재생 컨트롤
                </h2>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={handlePlay}
                    disabled={isPlaying}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <PlayIcon className="w-5 h-5" />
                    재생
                  </button>
                  <button
                    onClick={handlePause}
                    disabled={!isPlaying}
                    className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <PauseIcon className="w-5 h-5" />
                    일시정지
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <ResetIcon className="w-5 h-5" />
                    리셋
                  </button>
                </div>
                <p className="text-center mt-4 text-sm text-gray-600 dark:text-gray-400">
                  {isPlaying ? '재생 중...' : '대기 중'}
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* OBS 설정 탭 */}
        {activeTab === 'settings' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              OBS 오버레이 설정
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  글자 크기
                </label>
                <input
                  type="range"
                  min="30"
                  max="100"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">{fontSize}px</span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  텍스트 색상
                </label>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-full h-10 rounded cursor-pointer"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  하이라이트 색상
                </label>
                <input
                  type="color"
                  value={highlightColor}
                  onChange={(e) => setHighlightColor(e.target.value)}
                  className="w-full h-10 rounded cursor-pointer"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  크로마키 색상
                </label>
                <input
                  type="color"
                  value={chromaColor}
                  onChange={(e) => setChromaColor(e.target.value)}
                  className="w-full h-10 rounded cursor-pointer"
                />
              </div>
              
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  OBS 브라우저 소스 URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={obsUrl || `${window.location.origin}/obs`}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 cursor-default"
                  />
                  <button
                    onClick={() => {
                      const url = generateObsUrl();
                      navigator.clipboard.writeText(url);
                      toast.success('OBS URL이 복사되었습니다!');
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                  >
                    URL 복사
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  이 URL을 OBS 브라우저 소스에 추가하세요. 크로마키 필터를 적용하면 배경이 제거됩니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}