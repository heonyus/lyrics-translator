'use client';

import { useState, useEffect } from 'react';
import { Search, Copy, Monitor, Smartphone, Music, Settings, Play, Pause, RotateCcw, ChevronRight, ChevronLeft, Star, ExternalLink } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import LyricsResultSelector from '@/components/LyricsResultSelector';

interface Song {
  id: string;
  artist: string;
  title: string;
  lyrics: string;
  album?: string;
  coverUrl?: string;
  metadata?: any;
}

interface Translation {
  [language: string]: string[];
}

export default function HomePage() {
  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Prompt customization
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_SEARCH_PROMPT);
  
  // Selected song state
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [lyricsLines, setLyricsLines] = useState<string[]>([]);
  const [editedLyrics, setEditedLyrics] = useState<string>('');
  const [showEnhancedSearch, setShowEnhancedSearch] = useState(false);
  const [showLyricsEditor, setShowLyricsEditor] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResultSelector, setShowResultSelector] = useState(false);
  
  // Translation state
  const [translations, setTranslations] = useState<Translation>({});
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const [showOriginalLyrics, setShowOriginalLyrics] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Playback state
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // MR/YouTube state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  
  // Timing recording state
  const [isRecordingTimings, setIsRecordingTimings] = useState(false);
  const [timingData, setTimingData] = useState<Array<{line_index: number; clicked_at: number}>>([]);
  const [sessionStartTime, setSessionStartTime] = useState(0);
  
  // Settings state
  const [fontSize, setFontSize] = useState(60);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [highlightColor, setHighlightColor] = useState('#FFD700');
  const [chromaKey, setChromaKey] = useState('#00FF00');
  
  // Playlist
  const [favorites, setFavorites] = useState<Song[]>([]);
  
  // Log viewer state
  const [showLogViewer, setShowLogViewer] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    // Load dark mode preference
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      setIsDarkMode(true);
    }
    
    // Load recent searches
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
    
    // Load favorites
    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
    
    // Load saved prompt
    const savedPrompt = localStorage.getItem('customPrompt');
    if (savedPrompt) {
      setCustomPrompt(savedPrompt);
    }
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
  };

  // Handle search input change - show suggestions
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = searchSuggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSuggestions(filtered.slice(0, 5));
      setShowSuggestions(true);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search function
  const handleSearch = async (query?: string, useCustom: boolean = true) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) {
      toast.error('검색어를 입력하세요');
      return;
    }
    
    // Add to recent searches
    const newRecent = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem('recentSearches', JSON.stringify(newRecent));
    
    setShowSuggestions(false);
    setIsSearching(true);
    
    try {
      // Use the new multi-search-v2 API
      const response = await fetch('/api/lyrics/multi-search-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchTerm,
          prompt: useCustom ? customPrompt : undefined
        })
      });
      
      const data = await response.json();
      if (data.success && data.results && data.results.length > 0) {
        // Store all results
        setSearchResults(data.results);
        
        // If only one result or from cache, use it directly
        if (data.results.length === 1 || data.fromCache) {
          const result = data.bestResult || data.results[0];
          const song: Song = {
            id: Date.now().toString(),
            artist: result.artist,
            title: result.title,
            lyrics: result.syncedLyrics || result.lyrics,
            metadata: {
              ...result.metadata,
              hasSyncedLyrics: !!result.syncedLyrics,
              source: result.source,
              confidence: result.confidence
            }
          };
          
          setSelectedSong(song);
          setEditedLyrics(song.lyrics);
          setLyricsLines(song.lyrics.split('\n').filter(line => line.trim()));
          
          if (data.fromCache) {
            toast.success('📚 DB에서 가사를 찾았습니다!');
          } else {
            toast.success(`🎵 ${result.source}에서 가사를 찾았습니다! ${result.syncedLyrics ? '(LRC 타이밍 포함)' : ''}`);
          }
        } else {
          // Show result selector for multiple results
          setShowResultSelector(true);
          toast.info(`${data.results.length}개의 결과를 찾았습니다. 최적의 결과를 선택하세요.`);
        }
      } else {
        toast.error('가사를 찾을 수 없습니다');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('검색 중 오류가 발생했습니다');
    } finally {
      setIsSearching(false);
    }
  };

  // Re-search current song
  const reSearch = () => {
    if (selectedSong) {
      const query = `${selectedSong.artist} ${selectedSong.title}`;
      setSearchQuery(query);
      handleSearch(query, true);
    }
  };

  // Manual line progression
  const goToLine = (index: number) => {
    if (index >= 0 && index < lyricsLines.length) {
      setCurrentLineIndex(index);
      localStorage.setItem('current_line_index', index.toString());
      
      if (isRecordingTimings) {
        const currentTime = (Date.now() - sessionStartTime) / 1000;
        setTimingData(prev => [...prev, {
          line_index: index,
          clicked_at: currentTime
        }]);
      }
    }
  };

  const nextLine = () => goToLine(currentLineIndex + 1);
  const prevLine = () => goToLine(currentLineIndex - 1);
  const resetPlayback = () => {
    goToLine(0);
    setIsPlaying(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (!selectedSong) return;
      
      // Don't trigger shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch(e.key) {
        case ' ':
          e.preventDefault();
          if (e.shiftKey) {
            prevLine();
          } else {
            nextLine();
          }
          break;
        case 'ArrowRight':
          nextLine();
          break;
        case 'ArrowLeft':
          prevLine();
          break;
        case 'r':
        case 'R':
          resetPlayback();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [currentLineIndex, lyricsLines, selectedSong]);

  // Translate lyrics
  const translateLyrics = async () => {
    if (!selectedSong || targetLanguages.length === 0) return;
    
    setIsTranslating(true);
    const newTranslations: Translation = {};
    
    try {
      // Translate to all selected languages
      for (const lang of targetLanguages) {
        const response = await fetch('/api/translate/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lines: lyricsLines,
            targetLanguage: lang,
            context: {
              artist: selectedSong.artist,
              title: selectedSong.title
            }
          })
        });
        
        const data = await response.json();
        if (data.translations) {
          newTranslations[lang] = data.translations;
        }
      }
      
      setTranslations(newTranslations);
      localStorage.setItem('current_translations', JSON.stringify(newTranslations));
      toast.success(`${targetLanguages.length}개 언어로 번역 완료!`);
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('번역 중 오류가 발생했습니다');
    } finally {
      setIsTranslating(false);
    }
  };

  // Send to OBS - Open combined window
  const sendToOBS = () => {
    if (!selectedSong) {
      toast.error('먼저 가사를 검색하세요');
      return;
    }
    
    // Save data to localStorage
    localStorage.setItem('current_lrc', editedLyrics);
    localStorage.setItem('current_title', selectedSong.title);
    localStorage.setItem('current_artist', selectedSong.artist);
    localStorage.setItem('current_line_index', '0');
    localStorage.setItem('current_translations', JSON.stringify(translations));
    localStorage.setItem('selected_languages', JSON.stringify(targetLanguages));
    
    // Generate URL with settings
    const params = new URLSearchParams({
      fontSize: fontSize.toString(),
      textColor: encodeURIComponent(textColor),
      highlightColor: encodeURIComponent(highlightColor),
      chromaKey: encodeURIComponent(chromaKey)
    });
    
    // Open combined OBS window
    const obsWindow = window.open(
      `/obs/combined?${params.toString()}`,
      'OBSWindow',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
    );
    
    if (obsWindow) {
      toast.success('OBS 창이 열렸습니다!');
    } else {
      toast.error('팝업이 차단되었습니다. 팝업을 허용해주세요.');
    }
    
    if (isRecordingTimings) {
      setSessionStartTime(Date.now());
      setTimingData([]);
    }
  };

  // Copy lyrics
  const copyLyrics = () => {
    if (editedLyrics) {
      navigator.clipboard.writeText(editedLyrics);
      toast.success('가사가 복사되었습니다');
    }
  };

  // Add to favorites
  const toggleFavorite = () => {
    if (!selectedSong) return;
    
    const exists = favorites.some(f => f.artist === selectedSong.artist && f.title === selectedSong.title);
    let newFavorites;
    
    if (exists) {
      newFavorites = favorites.filter(f => !(f.artist === selectedSong.artist && f.title === selectedSong.title));
      toast.success('즐겨찾기에서 제거되었습니다');
    } else {
      newFavorites = [...favorites, selectedSong];
      toast.success('즐겨찾기에 추가되었습니다');
    }
    
    setFavorites(newFavorites);
    localStorage.setItem('favorites', JSON.stringify(newFavorites));
  };

  const isFavorite = selectedSong && favorites.some(f => f.artist === selectedSong.artist && f.title === selectedSong.title);

  // Handle result selection from LyricsResultSelector
  const handleResultSelect = (result: any) => {
    const song: Song = {
      id: Date.now().toString(),
      artist: result.artist,
      title: result.title,
      lyrics: result.syncedLyrics || result.lyrics,
      metadata: {
        ...result.metadata,
        hasSyncedLyrics: !!result.syncedLyrics,
        source: result.source,
        confidence: result.confidence,
        language: result.language
      }
    };
    
    setSelectedSong(song);
    setEditedLyrics(song.lyrics);
    setLyricsLines(song.lyrics.split('\n').filter(line => line.trim()));
    setShowResultSelector(false);
    
    toast.success(`🎵 ${result.source}에서 가사를 선택했습니다! ${result.syncedLyrics ? '(LRC 타이밍 포함)' : ''}`);
  };

  return (
    <div className={`min-h-screen transition-colors ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 to-gray-800' 
        : 'bg-gradient-to-br from-slate-50 to-slate-100'
    }`}>
      <Toaster position="top-center" theme={isDarkMode ? 'dark' : 'light'} />
      
      {/* Result Selector Modal */}
      {showResultSelector && searchResults.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <LyricsResultSelector
            results={searchResults}
            onSelect={handleResultSelect}
            onCancel={() => {
              setShowResultSelector(false);
              setSearchResults([]);
            }}
          />
        </div>
      )}

      {/* Header */}
      <div className={`${
        isDarkMode 
          ? 'bg-gray-800/50 border-gray-700' 
          : 'bg-white border-slate-200'
      } backdrop-blur-sm border-b px-6 py-4 shadow-sm sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className={`text-2xl font-bold flex items-center gap-2 ${
            isDarkMode ? 'text-white' : 'text-slate-800'
          }`}>
            <Music className="w-6 h-6 text-blue-500" />
            노래방
          </h1>
          
          {/* Current Song Info in Header */}
          {selectedSong && (
            <div className="flex-1 mx-8 text-center">
              <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {selectedSong.title} - {selectedSong.artist}
              </p>
            </div>
          )}
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLogViewer(!showLogViewer)}
              className={`p-2 rounded-lg transition-colors ${
                showLogViewer
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              title="Toggle Log Viewer"
            >
              <Terminal className="w-5 h-5" />
            </button>
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={sendToOBS}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center gap-2 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              OBS 창 열기
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Search Mode Toggle */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => setShowEnhancedSearch(!showEnhancedSearch)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              showEnhancedSearch
                ? 'bg-blue-500 text-white'
                : isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-slate-100 text-slate-700'
            }`}
          >
            <Search className="w-4 h-4" />
            {showEnhancedSearch ? '향상된 검색' : '기본 검색'}
          </button>
          
          {selectedSong && (
            <button
              onClick={() => setShowLyricsEditor(!showLyricsEditor)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                showLyricsEditor
                  ? 'bg-green-500 text-white'
                  : isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Edit2 className="w-4 h-4" />
              가사 편집기
            </button>
          )}
        </div>
        
        {/* Enhanced Search Bar or Regular Search Bar */}
        {showEnhancedSearch ? (
          <EnhancedSearchBar 
            onSearchResult={handleSearchResult}
            isDarkMode={isDarkMode}
          />
        ) : (
          <div className={`${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-slate-200'
          } rounded-2xl shadow-sm border p-4 mb-6 relative`} ref={searchRef}>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${
                isDarkMode ? 'text-gray-400' : 'text-slate-400'
              }`} />
              <Music className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 ${
                isDarkMode ? 'text-gray-500' : 'text-slate-300'
              }`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                onFocus={() => searchQuery && setShowSuggestions(true)}
                placeholder="🎵 아티스트와 제목을 입력하세요"
                className={`w-full pl-12 pr-12 py-3 rounded-xl ${
                  isDarkMode 
                    ? 'bg-gray-700 text-white placeholder-gray-400' 
                    : 'bg-slate-50 text-slate-800 placeholder-slate-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={isSearching}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  검색중
                </>
              ) : (
                '검색'
              )}
            </button>
          </div>
          
          {/* Search Suggestions Dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className={`absolute left-4 right-4 top-full mt-2 rounded-xl shadow-lg border ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-slate-200'
            } overflow-hidden z-10`}>
              {filteredSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSearchQuery(suggestion);
                    handleSearch(suggestion);
                  }}
                  className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-gray-700 text-gray-200' 
                      : 'hover:bg-slate-50 text-slate-700'
                  } ${idx !== 0 ? 'border-t ' + (isDarkMode ? 'border-gray-700' : 'border-slate-100') : ''}`}
                >
                  <Search className="w-4 h-4 text-gray-400" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Prompt Customization Section */}
        <div className={`${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-slate-200'
        } rounded-2xl shadow-sm border mb-6`}>
          <button
            onClick={() => setShowPromptEditor(!showPromptEditor)}
            className={`w-full px-6 py-4 flex items-center justify-between ${
              isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-slate-50'
            } transition-colors rounded-t-2xl`}
          >
            <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              🎯 검색 프롬프트 커스터마이징
            </span>
            {showPromptEditor ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          
          {showPromptEditor && (
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className={`w-full h-64 p-4 rounded-xl text-sm font-mono ${
                  isDarkMode 
                    ? 'bg-gray-700 text-gray-100' 
                    : 'bg-slate-50 text-slate-800'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setCustomPrompt(DEFAULT_SEARCH_PROMPT)}
                  className={`px-4 py-2 rounded-lg ${
                    isDarkMode 
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  기본값 복원
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('customPrompt', customPrompt);
                    toast.success('프롬프트가 저장되었습니다');
                  }}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                >
                  저장
                </button>
                {selectedSong && (
                  <button
                    onClick={reSearch}
                    className="ml-auto px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    현재 곡 재검색
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Quick Access */}
          <div className="space-y-6">
            {/* 즐겨찾기 */}
            <div className={`${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-slate-200'
            } rounded-2xl shadow-sm border p-5`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-semibold flex items-center gap-2 ${
                  isDarkMode ? 'text-white' : 'text-slate-800'
                }`}>
                  <Star className="w-5 h-5 text-yellow-500" />
                  즐겨찾기
                </h2>
              </div>
              <div className="space-y-2">
                {favorites.length === 0 ? (
                  <p className={`text-sm text-center py-4 ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-400'
                  }`}>즐겨찾기가 비어있습니다</p>
                ) : (
                  favorites.slice(0, 5).map((song, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedSong(song);
                        setEditedLyrics(song.lyrics);
                        setLyricsLines(song.lyrics.split('\n').filter(line => line.trim()));
                      }}
                      className={`w-full p-3 rounded-xl text-left transition-colors ${
                        isDarkMode 
                          ? 'bg-gray-700 hover:bg-gray-600' 
                          : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <p className={`font-medium text-sm ${
                        isDarkMode ? 'text-gray-100' : 'text-slate-800'
                      }`}>{song.title}</p>
                      <p className={`text-xs ${
                        isDarkMode ? 'text-gray-400' : 'text-slate-500'
                      }`}>{song.artist}</p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* 최근 검색 */}
            <div className={`${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-slate-200'
            } rounded-2xl shadow-sm border p-5`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-semibold flex items-center gap-2 ${
                  isDarkMode ? 'text-white' : 'text-slate-800'
                }`}>
                  <Clock className="w-5 h-5 text-blue-500" />
                  최근 검색
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.length === 0 ? (
                  <p className={`text-sm w-full text-center py-2 ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-400'
                  }`}>검색 기록이 없습니다</p>
                ) : (
                  recentSearches.map((search, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSearchQuery(search);
                        handleSearch(search);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isDarkMode 
                          ? 'bg-blue-900/30 hover:bg-blue-900/50 text-blue-400' 
                          : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                      }`}
                    >
                      {search}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Center Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Lyrics Editor */}
            {showLyricsEditor && selectedSong && (
              <SimpleLyricsEditor
                lyrics={editedLyrics}
                artist={selectedSong.artist}
                title={selectedSong.title}
                onLyricsChange={setEditedLyrics}
                isDarkMode={isDarkMode}
              />
            )}
            
            {selectedSong ? (
              <>
                {/* Song Info & Controls */}
                <div className={`${
                  isDarkMode 
                    ? 'bg-gray-800 border-gray-700' 
                    : 'bg-white border-slate-200'
                } rounded-2xl shadow-sm border p-6`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className={`text-2xl font-bold ${
                        isDarkMode ? 'text-white' : 'text-slate-800'
                      }`}>{selectedSong.title}</h2>
                      <p className={`text-lg ${
                        isDarkMode ? 'text-gray-300' : 'text-slate-600'
                      }`}>{selectedSong.artist}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={reSearch}
                        className={`p-2 rounded-lg transition-colors ${
                          isDarkMode 
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                        title="재검색"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                      <button
                        onClick={toggleFavorite}
                        className={`p-2 rounded-lg transition-colors ${
                          isFavorite 
                            ? 'bg-yellow-100 text-yellow-600' 
                            : isDarkMode 
                              ? 'bg-gray-700 text-gray-400 hover:text-yellow-500' 
                              : 'bg-slate-100 text-slate-400 hover:text-yellow-600'
                        }`}
                      >
                        <Star className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>

                  {/* YouTube URL */}
                  <div className="mb-4">
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="YouTube MR URL (선택사항)"
                      className={`w-full px-4 py-2 rounded-lg text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 text-white placeholder-gray-400' 
                          : 'bg-slate-50 text-slate-800 placeholder-slate-400'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>

                  {/* Language Selection */}
                  <div className="mb-4">
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-slate-700'
                    }`}>
                      번역 언어 선택
                    </label>
                    <LanguageSelector
                      selectedLanguages={targetLanguages}
                      onLanguageChange={setTargetLanguages}
                      isDarkMode={isDarkMode}
                    />
                  </div>

                  {/* Quick Translation */}
                  <div className="mb-4">
                    <button
                      onClick={translateLyrics}
                      disabled={isTranslating || targetLanguages.length === 0}
                      className="w-full px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors"
                    >
                      {isTranslating 
                        ? '번역중...' 
                        : targetLanguages.length === 0 
                          ? '번역할 언어를 선택하세요'
                          : `${targetLanguages.length}개 언어로 번역`
                      }
                    </button>
                  </div>

                  {/* Current Line Display with Multiple Translations */}
                  <div className={`rounded-xl p-6 mb-4 ${
                    isDarkMode 
                      ? 'bg-gradient-to-br from-blue-900/30 to-purple-900/30' 
                      : 'bg-gradient-to-br from-blue-50 to-purple-50'
                  }`}>
                    <p className={`text-2xl font-bold text-center mb-4 ${
                      isDarkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      {lyricsLines[currentLineIndex] || '...'}
                    </p>
                    
                    {/* Display all translations */}
                    {targetLanguages.map((lang) => (
                      translations[lang]?.[currentLineIndex] && (
                        <div key={lang} className={`text-center mb-2 ${
                          isDarkMode ? 'text-gray-300' : 'text-slate-600'
                        }`}>
                          <span className="text-xs opacity-60 mr-2">[{lang.toUpperCase()}]</span>
                          <span className="text-lg">{translations[lang][currentLineIndex]}</span>
                        </div>
                      )
                    ))}
                    
                    <p className={`text-sm text-center mt-3 ${
                      isDarkMode ? 'text-gray-400' : 'text-slate-500'
                    }`}>
                      {currentLineIndex + 1} / {lyricsLines.length}
                    </p>
                  </div>

                  {/* Playback Controls */}
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={prevLine}
                      className={`p-3 rounded-xl transition-colors ${
                        isDarkMode 
                          ? 'bg-gray-700 hover:bg-gray-600' 
                          : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={nextLine}
                      className={`p-3 rounded-xl transition-colors ${
                        isDarkMode 
                          ? 'bg-gray-700 hover:bg-gray-600' 
                          : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <button
                      onClick={resetPlayback}
                      className={`p-3 rounded-xl transition-colors ${
                        isDarkMode 
                          ? 'bg-gray-700 hover:bg-gray-600' 
                          : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Timing Recording */}
                  <div className="flex items-center justify-center mt-4 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRecordingTimings}
                        onChange={(e) => setIsRecordingTimings(e.target.checked)}
                        className="rounded text-blue-500"
                      />
                      <span className={`text-sm ${
                        isDarkMode ? 'text-gray-300' : 'text-slate-600'
                      }`}>타이밍 기록</span>
                    </label>
                    {timingData.length > 0 && (
                      <span className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-slate-500'
                      }`}>
                        ({timingData.length}개 기록됨)
                      </span>
                    )}
                  </div>

                  {/* Lyrics Editor Toggle */}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div
                      className={`w-full px-4 py-2 rounded-lg flex items-center justify-between ${
                        isDarkMode 
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      } cursor-pointer`}
                    >
                      <button
                        onClick={() => setShowLyricsEditor(!showLyricsEditor)}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        <Edit2 className="w-4 h-4" />
                        가사 편집
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyLyrics();
                          }}
                          className={`p-1 rounded ${
                            isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-slate-300'
                          }`}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowLyricsEditor(!showLyricsEditor)}
                          className="p-1"
                        >
                          {showLyricsEditor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    
                    {showLyricsEditor && (
                      <div className="mt-4">
                        <textarea
                          value={editedLyrics}
                          onChange={(e) => setEditedLyrics(e.target.value)}
                          className={`w-full h-64 p-4 rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            isDarkMode 
                              ? 'bg-gray-700 text-gray-100' 
                              : 'bg-slate-50 text-slate-800'
                          }`}
                        />
                        <button
                          onClick={() => {
                            setLyricsLines(editedLyrics.split('\n').filter(line => line.trim()));
                            toast.success('가사가 적용되었습니다');
                          }}
                          className="mt-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm"
                        >
                          적용
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className={`${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-slate-200'
              } rounded-2xl shadow-sm border p-12`}>
                <div className="text-center">
                  <Mic className={`w-16 h-16 mx-auto mb-4 ${
                    isDarkMode ? 'text-gray-600' : 'text-slate-300'
                  }`} />
                  <p className={`text-lg mb-2 ${
                    isDarkMode ? 'text-gray-200' : 'text-slate-600'
                  }`}>노래를 검색해주세요</p>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-400'
                  }`}>아티스트와 제목을 입력하면 가사를 찾을 수 있습니다</p>
                </div>
              </div>
            )}

            {/* Settings */}
            <div className={`${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-slate-200'
            } rounded-2xl shadow-sm border p-6`}>
              <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
                isDarkMode ? 'text-white' : 'text-slate-800'
              }`}>
                <Settings className={`w-5 h-5 ${
                  isDarkMode ? 'text-gray-400' : 'text-slate-600'
                }`} />
                OBS 설정
              </h3>
              <div className="space-y-4">
                {/* Show Original Toggle */}
                <div className="flex items-center justify-between">
                  <label className={`text-sm font-medium ${
                    isDarkMode ? 'text-gray-300' : 'text-slate-700'
                  }`}>원문 가사 표시</label>
                  <button
                    onClick={() => {
                      const newValue = !showOriginalLyrics;
                      setShowOriginalLyrics(newValue);
                      localStorage.setItem('show_original', newValue.toString());
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showOriginalLyrics 
                        ? 'bg-blue-500' 
                        : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showOriginalLyrics ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Font Size */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-slate-700'
                  }`}>글자 크기: {fontSize}px</label>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    value={fontSize}
                    onChange={(e) => {
                      const size = Number(e.target.value);
                      setFontSize(size);
                      localStorage.setItem('obs_settings', JSON.stringify({
                        fontSize: size,
                        textColor,
                        highlightColor,
                        chromaKey
                      }));
                    }}
                    className="w-full"
                  />
                </div>

                {/* Colors */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-slate-700'
                  }`}>색상 설정</label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs block mb-1">텍스트</label>
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => {
                          setTextColor(e.target.value);
                          localStorage.setItem('obs_settings', JSON.stringify({
                            fontSize,
                            textColor: e.target.value,
                            highlightColor,
                            chromaKey
                          }));
                        }}
                        className="w-full h-8 rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs block mb-1">크로마키</label>
                      <input
                        type="color"
                        value={chromaKey}
                        onChange={(e) => {
                          setChromaKey(e.target.value);
                          localStorage.setItem('obs_settings', JSON.stringify({
                            fontSize,
                            textColor,
                            highlightColor,
                            chromaKey: e.target.value
                          }));
                        }}
                        className="w-full h-8 rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-xs block mb-1">하이라이트</label>
                      <input
                        type="color"
                        value={highlightColor}
                        onChange={(e) => {
                          setHighlightColor(e.target.value);
                          localStorage.setItem('obs_settings', JSON.stringify({
                            fontSize,
                            textColor,
                            highlightColor: e.target.value,
                            chromaKey
                          }));
                        }}
                        className="w-full h-8 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        <div className={`mt-6 text-center text-xs ${
          isDarkMode ? 'text-gray-500' : 'text-slate-500'
        }`}>
          단축키: Space(다음) • Shift+Space(이전) • ←→(이동) • R(리셋)
        </div>
        
        {/* Log Viewer */}
        {showLogViewer && (
          <div className="mt-6">
            <LogViewer 
              className="animate-in fade-in slide-in-from-bottom-2"
              maxEntries={200}
              autoScroll={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
