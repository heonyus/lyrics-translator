'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Copy, Monitor, Smartphone, Music, Settings, Play, Pause, RotateCcw, ChevronRight, ChevronLeft, ExternalLink, Edit, RefreshCw, FileText, Eye, EyeOff, Globe, Loader, Palette } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast, Toaster } from 'sonner';
import LyricsResultSelector from '@/components/LyricsResultSelector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// Dynamic import for TextCustomizer to avoid SSR issues
const TextCustomizer = dynamic(() => import('@/components/TextCustomizer'), { ssr: false });

export default function MobileDashboard() {
  // Search & Song
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [currentSong, setCurrentSong] = useState({
    title: '',
    artist: '',
    album: '',
    coverUrl: '',
    lyrics: '',
    lyricsLines: [] as string[]
  });
  
  // Playback
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Overlay settings
  const [overlayMode, setOverlayMode] = useState<'mobile' | 'desktop'>('mobile');
  const [settings, setSettings] = useState({
    showAlbumInfo: true,
    showNextLine: true,
    showTranslation: true,
    fontSize: 48,
    textColor: '#FFFFFF',
    chromaKey: '#00FF00',
    selectedLanguages: ['en', 'ja'],
    lyricsPosition: { x: 50, y: 50 },
    titlePosition: { x: 50, y: 10 },
    textSizes: { originalSize: 200, translationSize: 160 }
  });

  // Translations
  const [translations, setTranslations] = useState<any>({});
  const [pronunciations, setPronunciations] = useState<string[] | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  // Search session control (to cancel/ignore late results)
  const searchSessionRef = useRef(0);
  const cancelSearchRef = useRef<(() => void) | null>(null);
  
  // Text customization
  const [showTextCustomizer, setShowTextCustomizer] = useState(false);
  
  // Lyrics visibility
  const [lyricsHidden, setLyricsHidden] = useState(false);
  
  // Inline editing states
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingArtist, setEditingArtist] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [tempArtist, setTempArtist] = useState('');
  
  // Editor states
  const [showLyricsEditor, setShowLyricsEditor] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState('');
  const [searchPrompt, setSearchPrompt] = useState('정확한 한국어 가사를 찾아주세요. 전체 가사를 포함해야 합니다.');

  // Load saved data
  useEffect(() => {
    const title = localStorage.getItem('current_title') || '';
    const artist = localStorage.getItem('current_artist') || '';
    const album = localStorage.getItem('current_album') || '';
    const coverUrl = localStorage.getItem('current_cover_url') || '';
    const lyrics = localStorage.getItem('current_lrc') || '';
    const savedTranslations = localStorage.getItem('current_translations');
    const savedSettings = localStorage.getItem('mobile_overlay_settings');
    const savedLanguages = localStorage.getItem('selected_languages');
    const translationEnabled = localStorage.getItem('translation_enabled') === 'true';
    const savedLyricsHidden = localStorage.getItem('lyrics_hidden') === 'true';
    
    const lines = lyrics.split('\n').filter(l => l.trim());
    
    setCurrentSong({
      title,
      artist,
      album,
      coverUrl,
      lyrics,
      lyricsLines: lines
    });
    
    if (savedTranslations) {
      setTranslations(JSON.parse(savedTranslations));
    }
    
    // 저장된 언어 설정 복원
    if (savedLanguages) {
      const languages = JSON.parse(savedLanguages);
      setSettings(prev => ({ ...prev, selectedLanguages: languages }));
    }
    
    if (savedSettings) {
      setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
    }
    
    // Restore lyrics hidden state
    setLyricsHidden(savedLyricsHidden);
    
    // 번역이 활성화되어 있고 가사가 있으면서 번역이 없으면 자동 번역
    if (translationEnabled && lines.length > 0 && !savedTranslations) {
      const langs = savedLanguages ? JSON.parse(savedLanguages) : [];
      if (langs.length > 0) {
        // 비동기로 번역 실행
        setTimeout(() => {
          translateLyrics(lines, true);
        }, 500);
      }
    }
  }, []);

  // Normalize various API response shapes into a common result array
  const adaptResults = (name: string, data: any): any[] => {
    try {
      if (!data) return [];
      if (Array.isArray(data.results) && data.results.length > 0) return data.results;
      if (data.bestResult && data.bestResult.lyrics) return [data.bestResult];
      if (data.result && data.result.lyrics) return [data.result];
      if (data.lyrics) return [data];
      return [];
    } catch { return []; }
  };

  // Use Ultimate Search API for comprehensive parallel search
  const parallelSearch = async (artist: string, title: string, query: string, forceRefresh = false) => {
    // new session id
    const mySession = ++searchSessionRef.current;
    const controller = new AbortController();
    
    // expose canceler for outer handlers
    cancelSearchRef.current = () => { try { controller.abort(); } catch {} };
    
    try {
      console.log(`🔍 Ultimate Search: ${artist} - ${title}`);
      
      // Add timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        controller.abort();
        toast.error('검색 시간 초과 (30초)');
      }, 30000);
      
      // Call Ultimate Search API which handles all providers in parallel
      const res = await fetch('/api/lyrics/ultimate-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title }),
        signal: controller.signal
      }).catch(err => {
        clearTimeout(timeoutId);
        throw err;
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        console.error('Ultimate search failed:', res.status, res.statusText);
        if (res.status === 404) {
          // Try to handle main-app.js 404 gracefully
          console.warn('Possible webpack chunk error, reloading may help');
          toast.error('검색 실패 - 페이지를 새로고침 해주세요');
        } else if (res.status === 500) {
          toast.error('서버 오류가 발생했습니다');
        } else {
          toast.error(`검색 오류 (${res.status})`);
        }
        return;
      }
      
      const data = await res.json();
      
      // Check if this is still the current search session
      if (mySession !== searchSessionRef.current) return;
      
      // Process main result
      if (data.lyrics) {
        const mainResult = {
          source: data.source,
          lyrics: data.lyrics,
          confidence: data.confidence,
          hasTimestamps: data.hasTimestamps,
          metadata: data.metadata
        };
        
        // Set main result
        setSearchResults([mainResult]);
        
        // Add alternatives if available
        if (data.alternatives && Array.isArray(data.alternatives)) {
          const alternativeResults = data.alternatives.map((alt: any) => ({
            source: alt.source,
            lyrics: alt.preview ? alt.preview.replace('...', '') + '...' : '',
            confidence: alt.confidence,
            hasTimestamps: alt.hasTimestamps,
            isPreview: true
          }));
          
          setSearchResults(prev => {
            if (mySession !== searchSessionRef.current) return prev;
            return [...prev, ...alternativeResults];
          });
        }
        
        // Update album info if available
        if (data.metadata?.album || data.metadata?.coverUrl) {
          setCurrentSong(prev => ({
            ...prev,
            album: data.metadata.album || prev.album,
            coverUrl: data.metadata.coverUrl || prev.coverUrl
          }));
        }
        
        console.log(`✅ Ultimate Search found ${data.totalResults} results`);
        toast.success(`${data.totalResults}개 소스에서 가사를 찾았습니다`);
      } else {
        console.warn('No lyrics found from Ultimate Search');
        toast.error('가사를 찾을 수 없습니다');
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('Search aborted or timed out');
          // Don't show error if user cancelled
          if (mySession === searchSessionRef.current) {
            toast.info('검색이 취소되었습니다');
          }
        } else if (error.message.includes('Failed to fetch')) {
          console.error('Network error:', error);
          toast.error('네트워크 오류 - 인터넷 연결을 확인해주세요');
        } else {
          console.error('Ultimate search error:', error);
          toast.error(`검색 오류: ${error.message}`);
        }
      } else {
        console.error('Unknown error:', error);
        toast.error('알 수 없는 오류가 발생했습니다');
      }
    } finally {
      // Cleanup
      if (mySession === searchSessionRef.current) {
        cancelSearchRef.current = null;
      }
    }
    
    return () => controller.abort();
  };

  // Quick search
  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Prevent search if already searching
    if (isSearching) {
      toast.info('이미 검색 중입니다');
      return;
    }
    
    if (!searchQuery.trim()) {
      toast.error('검색어를 입력해주세요');
      return;
    }
    
    // cancel previous search session
    cancelSearchRef.current?.();
    // invalidate prior sessions so late results are ignored
    searchSessionRef.current++;

    setIsSearching(true);
    setSearchResults([]);
    
    try {
      // Parse search query properly using LLM-backed album fetch labeler
      let artist = '';
      let title = '';
      try {
        const resp = await fetch('/api/album/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artist: searchQuery.trim(), title: searchQuery.trim() })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.success && data.albumInfo?.artistDisplay && data.albumInfo?.titleDisplay) {
            // 괄호 안 영문은 소문자로 저장되므로, 내부 영문만 () 제거 후 소문자 유지
            artist = data.albumInfo.artistDisplay.replace(/\(([^)]*)\)$/, (_m: any, p1: string) => `(${p1.toLowerCase()})`).replace(/\([^)]*\)$/, '').trim();
            title = data.albumInfo.titleDisplay.replace(/\(([^)]*)\)$/, (_m: any, p1: string) => `(${p1.toLowerCase()})`).replace(/\([^)]*\)$/, '').trim();
          }
        }
      } catch {}
      if (!artist || !title) {
        // fallback heuristic
        if (searchQuery.includes(' - ')) {
          const parts = searchQuery.split(' - ');
          artist = parts[0].trim();
          title = parts[1]?.trim() || parts[0].trim();
        } else {
          const words = searchQuery.trim().split(' ');
          if (words.length >= 2) {
            artist = words[0];
            title = words.slice(1).join(' ');
          } else {
            artist = searchQuery.trim();
            title = searchQuery.trim();
          }
        }
      }
      
      console.log(`Searching for: ${artist} - ${title}`);
      
      // Set title and artist immediately so they show even if search fails
      setCurrentSong(prev => ({
        ...prev,
        title: title,
        artist: artist,
        lyrics: '',  // Clear previous lyrics
        lyricsLines: []
      }));
      
      // Update localStorage so OBS overlay shows it
      localStorage.setItem('current_title', title);
      localStorage.setItem('current_artist', artist);
      
      // Fire providers in parallel and append as they arrive
      await parallelSearch(artist, title, searchQuery, false);
      
      // Check if we got any results
      setTimeout(() => {
        if (searchResults.length === 0 && !isSearching) {
          toast.info('검색 결과가 없습니다. 다른 검색어를 시도해보세요.');
        }
      }, 1000);
    } catch (error) {
      console.error('Search error:', error);
      if (error instanceof Error) {
        toast.error(`검색 실패: ${error.message}`);
      } else {
        toast.error('검색 중 오류가 발생했습니다');
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Generate Korean Hangul pronunciations for foreign lyrics (dashboard-only)
  const buildPronunciations = async (lines: string[]) => {
    if (!lines.length) return;
    try {
      const response = await fetch('/api/translate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines,
          targetLanguage: 'ko',
          context: { title: currentSong.title, artist: currentSong.artist },
          task: 'pronounce'
        })
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.success && Array.isArray(data.translations)) {
        setPronunciations(data.translations);
        localStorage.setItem('current_pronunciations', JSON.stringify(data.translations));
      }
    } catch {}
  };

  // Re-search with different query or force refresh
  const handleReSearch = async () => {
    if (!currentSong.title && !searchQuery.trim()) return;
    
    const query = currentSong.title ? `${currentSong.artist} - ${currentSong.title}` : searchQuery;
    
    cancelSearchRef.current?.();
    searchSessionRef.current++;
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      await parallelSearch(currentSong.artist || searchQuery.split(' - ')[0] || '', currentSong.title || searchQuery.split(' - ')[1] || '', query, true);
      if ((searchResults as any[]).length > 0) toast.success('재검색: 첫 결과 도착');
    } catch (error) {
      toast.error('재검색 실패');
    } finally {
      setIsSearching(false);
    }
  };
  
  // Select result
  const handleSelectResult = async (result: any) => {
    // stop accepting/processing any in-flight search results
    cancelSearchRef.current?.();
    searchSessionRef.current++;
    setIsSearching(false);
    const song = {
      title: result.title || searchQuery.split(' - ')[1] || '',
      artist: result.artist || searchQuery.split(' - ')[0] || '',
      album: '',
      coverUrl: '',
      lyrics: result.lyrics || result.syncedLyrics || '',
      lyricsLines: (result.lyrics || result.syncedLyrics || '').split('\n').filter((l: string) => l.trim())
    };
    
    setCurrentSong(song);
    setEditedLyrics(song.lyrics); // Initialize edited lyrics
    setSearchResults([]);
    
    // Save to localStorage
    localStorage.setItem('current_title', song.title);
    localStorage.setItem('current_artist', song.artist);
    localStorage.setItem('current_lrc', song.lyrics);
    localStorage.setItem('current_line_index', '0');
    localStorage.removeItem('current_pronunciations');
    setPronunciations(null);
    
    toast.success(`🎵 ${result.source || 'Smart Scraper'}에서 가사를 찾았습니다! 이후 도착하는 결과는 무시됩니다.`);
    
    // Auto fetch album info
    fetchAlbumInfo(song.artist, song.title);
    
    // Auto translate if translation is enabled
    const translationEnabled = localStorage.getItem('translation_enabled') === 'true';
    if (song.lyricsLines.length > 0 && settings.selectedLanguages.length > 0 && translationEnabled) {
      translateLyrics(song.lyricsLines);
    }
    // Build pronunciations for non-Korean lyrics for dashboard only
    const isNonKorean = song.lyrics && !(/[\uAC00-\uD7AF]/.test(song.lyrics));
    if (song.lyricsLines.length > 0 && isNonKorean) {
      buildPronunciations(song.lyricsLines);
    }
  };

  // Fetch album info
  const fetchAlbumInfo = async (artist: string, title: string) => {
    try {
      const response = await fetch('/api/album/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.albumInfo) {
          const info = data.albumInfo;
          setCurrentSong(prev => ({
            ...prev,
            title: info.titleDisplay || prev.title,
            artist: info.artistDisplay || prev.artist,
            album: info.album || '',
            coverUrl: info.coverUrl || ''
          }));

          if (info.titleDisplay) localStorage.setItem('current_title', info.titleDisplay);
          if (info.artistDisplay) localStorage.setItem('current_artist', info.artistDisplay);
          localStorage.setItem('current_album', info.album || '');
          localStorage.setItem('current_cover_url', info.coverUrl || '');

          toast.success('🎨 앨범 정보를 가져왔습니다');
        }
      }
    } catch (error) {
      console.error('Album fetch error:', error);
    }
  };

  // Toggle lyrics visibility
  const toggleLyricsVisibility = () => {
    const newState = !lyricsHidden;
    setLyricsHidden(newState);
    localStorage.setItem('lyrics_hidden', newState.toString());
    toast.success(newState ? '가사를 숨겼습니다' : '가사를 표시합니다');
  };

  // Title/Artist editing functions
  const startEditingTitle = () => {
    setTempTitle(currentSong.title);
    setEditingTitle(true);
  };

  const startEditingArtist = () => {
    setTempArtist(currentSong.artist);
    setEditingArtist(true);
  };

  const saveTitle = () => {
    if (tempTitle.trim()) {
      setCurrentSong(prev => ({ ...prev, title: tempTitle.trim() }));
      localStorage.setItem('current_title', tempTitle.trim());
      toast.success('제목을 수정했습니다');
    }
    setEditingTitle(false);
  };

  const saveArtist = () => {
    if (tempArtist.trim()) {
      setCurrentSong(prev => ({ ...prev, artist: tempArtist.trim() }));
      localStorage.setItem('current_artist', tempArtist.trim());
      toast.success('가수명을 수정했습니다');
    }
    setEditingArtist(false);
  };

  // Translate lyrics
  const translateLyrics = async (lines: string[], forceTranslate = false, langsOverride?: string[]) => {
    if (!lines.length) return;
    
    const targetLangs = langsOverride && langsOverride.length ? langsOverride : settings.selectedLanguages;

    // 언어가 선택되지 않았으면 번역하지 않음
    if (targetLangs.length === 0 && !forceTranslate) {
      toast.error('번역할 언어를 선택해주세요');
      return;
    }
    
    setIsTranslating(true);
    
    try {
      // 각 언어별로 병렬로 번역 요청
      const translationPromises = targetLangs.map(async (lang) => {
        // Use GPT-5 for better quality translations
        const response = await fetch('/api/translate/gpt5', {
          method: 'PUT',  // PUT for batch translation
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lines,
            targetLanguage: lang,  // targetLanguages가 아닌 targetLanguage 사용
            context: {
              title: currentSong.title,
              artist: currentSong.artist
            },
            // Removed task field for GPT-5 API
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.translations) {
            return { lang, translations: data.translations };
          }
        }
        return null;
      });
      
      const results = await Promise.all(translationPromises);
      
      // 결과를 객체 형태로 변환
      const translationsObj: any = {};
      results.forEach(result => {
        if (result) {
          translationsObj[result.lang] = result.translations;
        }
      });
      
      if (Object.keys(translationsObj).length > 0) {
        setTranslations(translationsObj);
        localStorage.setItem('current_translations', JSON.stringify(translationsObj));
        localStorage.setItem('selected_languages', JSON.stringify(targetLangs));
        localStorage.setItem('translation_enabled', 'true');
        toast.success('번역 완료!');
      } else {
        toast.error('번역 실패');
      }
    } catch (error) {
      toast.error('번역 실패');
    } finally {
      setIsTranslating(false);
    }
  };

  // Playback controls
  const goToLine = (index: number) => {
    if (index >= 0 && index < currentSong.lyricsLines.length) {
      setCurrentLineIndex(index);
      localStorage.setItem('current_line_index', index.toString());
    }
  };

  const nextLine = () => goToLine(currentLineIndex + 1);
  const prevLine = () => goToLine(currentLineIndex - 1);
  const resetPlayback = () => goToLine(0);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      // Don't trigger when typing in input
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
        case 'o':
        case 'O':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            openOBSWindow();
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [currentLineIndex, currentSong.lyricsLines]);

  // Update settings
  const updateSettings = (newSettings: typeof settings) => {
    setSettings(newSettings);
    localStorage.setItem('mobile_overlay_settings', JSON.stringify(newSettings));
    localStorage.setItem('selected_languages', JSON.stringify(newSettings.selectedLanguages));
  };

  // Get OBS URL - Using mobile-live for TikTok
  const getEnhancedOBSUrl = () => {
    const baseUrl = window.location.origin + '/obs/mobile-live';
    const params = new URLSearchParams({
      chromaKey: settings.chromaKey,
      lang: settings.selectedLanguages[0] || 'en'
    });
    return `${baseUrl}?${params.toString()}`;
  };

  // Get OBS URL (legacy)
  const getOverlayUrl = (isForViewer = false) => {
    const params = new URLSearchParams({
      fontSize: settings.fontSize.toString(),
      textColor: encodeURIComponent(settings.textColor),
      chromaKey: encodeURIComponent(settings.chromaKey),
      showAlbum: settings.showAlbumInfo.toString(),
      showNext: settings.showNextLine.toString(),
      showTranslation: settings.showTranslation.toString(),
      viewer: isForViewer ? 'true' : 'false'
    });
    
    const path = overlayMode === 'mobile' ? '/obs/mobile-live' : '/obs/combined';
    return `${window.location.origin}${path}?${params.toString()}`;
  };

  const copyOverlayUrl = () => {
    navigator.clipboard.writeText(getEnhancedOBSUrl());
    toast.success('Enhanced OBS URL 복사됨!');
  };

  // Open OBS window - Using enhanced overlay
  const openOBSWindow = () => {
    // Save current state to localStorage
    localStorage.setItem('show_original', 'true');
    localStorage.setItem('obs_show_translation', 'true');
    localStorage.setItem('obs_translation_lang', settings.selectedLanguages[0] || 'en');
    
    if (overlayMode === 'mobile') {
      // TikTok Live용 540x960 창 (1080x1920 컨텐츠를 0.5 스케일로 표시)
      const screenHeight = window.screen.availHeight;
      const targetHeight = Math.min(960, screenHeight - 100);
      const targetWidth = Math.round(targetHeight * 9 / 16); // 9:16 비율 유지
      const windowFeatures = `width=${targetWidth},height=${targetHeight},left=100,top=50,resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no,location=no`;
      const obsWindow = window.open(getEnhancedOBSUrl(), 'TikTokLiveOverlay', windowFeatures);
      
      if (obsWindow) {
        // 강제 리사이즈 여러 번 시도
        [0, 100, 200, 500, 1000].forEach(delay => {
          setTimeout(() => {
            if (obsWindow && !obsWindow.closed) {
              obsWindow.resizeTo(1080, 1920);
              obsWindow.moveTo(0, 0);
            }
          }, delay);
        });
        
        toast.success('틱톡 라이브 오버레이 (1080x1920) 창이 열렸습니다!');
        
        // Chrome 앱 모드 명령 안내
        toast.info('💡 팁: Chrome에서 --app 모드로 실행하면 정확한 크기가 보장됩니다', {
          duration: 8000,
          description: 'chrome --app=http://localhost:3000/obs/mobile-live --window-size=1080,1920'
        });
      } else {
        toast.error('팝업이 차단되었습니다. 팝업을 허용해주세요.');
      }
    } else {
      // Desktop mode
      const windowFeatures = 'width=1920,height=1080,left=0,top=0,resizable=no,scrollbars=no,status=no,toolbar=no,menubar=no,location=no';
      const obsWindow = window.open(getOverlayUrl(true), 'DesktopOverlay', windowFeatures);
      
      if (obsWindow) {
        [0, 100, 200, 500, 1000].forEach(delay => {
          setTimeout(() => {
            if (obsWindow && !obsWindow.closed) {
              obsWindow.resizeTo(1920, 1080);
              obsWindow.moveTo(0, 0);
            }
          }, delay);
        });
        
        toast.success('데스크톱 오버레이 (1920x1080) 창이 열렸습니다!');
      } else {
        toast.error('팝업이 차단되었습니다. 팝업을 허용해주세요.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-black">
      <Toaster position="top-center" theme="dark" />
      
      {/* Search Results Modal */}
      {searchResults.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <LyricsResultSelector
            results={searchResults}
            onSelect={handleSelectResult}
            onCancel={() => setSearchResults([])}
          />
        </div>
      )}
      
      {/* Lyrics Editor Modal - Full Screen */}
      {showLyricsEditor && (
        <div className="fixed inset-0 bg-black/95 z-50">
          <div className="h-full w-full bg-gray-900 flex flex-col">
            <div className="flex justify-between items-center px-8 py-6 border-b border-gray-800">
              <h2 className="text-2xl font-bold text-white">가사 편집기 (전체보기)</h2>
              <button
                onClick={() => setShowLyricsEditor(false)}
                className="text-gray-400 hover:text-white text-3xl p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <textarea
              value={editedLyrics}
              onChange={(e) => setEditedLyrics(e.target.value)}
              className="flex-1 bg-black/30 text-white px-8 py-6 font-mono text-base resize-none border-0 focus:outline-none"
              placeholder="가사를 편집하세요..."
            />
            <div className="flex gap-3 px-8 py-6 border-t border-gray-800 bg-gray-900">
              <button
                onClick={() => {
                  const lines = editedLyrics.split('\n').filter(l => l.trim());
                  setCurrentSong(prev => ({ ...prev, lyrics: editedLyrics, lyricsLines: lines }));
                  localStorage.setItem('current_lrc', editedLyrics);
                  setShowLyricsEditor(false);
                  toast.success('가사가 적용되었습니다');
                }}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-lg transition-colors"
              >
                적용
              </button>
              <button
                onClick={() => setShowLyricsEditor(false)}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium text-lg transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Prompt Editor Modal */}
      {showPromptEditor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">검색 프롬프트 편집</h2>
              <button
                onClick={() => setShowPromptEditor(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            <textarea
              value={searchPrompt}
              onChange={(e) => setSearchPrompt(e.target.value)}
              className="w-full h-32 bg-black/50 text-white p-4 rounded-lg resize-none border border-white/10"
              placeholder="AI 검색에 사용할 프롬프트를 입력하세요..."
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setShowPromptEditor(false);
                  toast.success('프롬프트가 저장되었습니다');
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setSearchPrompt('정확한 한국어 가사를 찾아주세요. 전체 가사를 포함해야 합니다.');
                  toast.success('기본 프롬프트로 초기화되었습니다');
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-black/30 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            🎤 Live Karaoke
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setOverlayMode(overlayMode === 'mobile' ? 'desktop' : 'mobile')} title={`현재: ${overlayMode === 'mobile' ? '모바일' : '데스크톱'} 모드`}>
              {overlayMode === 'mobile' ? <Smartphone className="w-5 h-5 text-white" /> : <Monitor className="w-5 h-5 text-white" />}
            </Button>
            <Button onClick={() => setShowTextCustomizer(!showTextCustomizer)} className="bg-blue-600 hover:bg-blue-700" title="텍스트 커스터마이징">
              <Palette className="w-4 h-4" />
              텍스트 설정
            </Button>
            <Button onClick={openOBSWindow} className="bg-green-600 hover:bg-green-700">
              <ExternalLink className="w-4 h-4" />
              OBS 창 열기
            </Button>
            <Button onClick={copyOverlayUrl} className="bg-purple-600 hover:bg-purple-700">
              <Copy className="w-4 h-4" />
              URL 복사
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {/* Text Customizer Modal */}
        {showTextCustomizer && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-900 p-4 border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">텍스트 커스터마이징</h2>
                <Button onClick={() => setShowTextCustomizer(false)} variant="ghost">
                  ✕
                </Button>
              </div>
              <div className="p-4">
                <TextCustomizer />
              </div>
            </div>
          </div>
        )}
        
        {/* Quick Search */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="아티스트, 제목, 또는 자연어로 검색..."
              className="w-full pl-12 pr-32 py-6 text-base"
            />
            <Button type="submit" disabled={isSearching} className="absolute right-2 top-1/2 -translate-y-1/2">
              {isSearching ? '검색중...' : '검색'}
            </Button>
          </div>
        </form>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Current Song & Player */}
          <div className="lg:col-span-2 space-y-4">
            {/* Now Playing Card */}
            <Card className="bg-white/5 border-white/10 p-6">
              <div className="flex gap-6">
                {/* Album Cover */}
                <div className="flex-shrink-0">
                  {currentSong.coverUrl ? (
                    <img 
                      src={currentSong.coverUrl} 
                      alt="Album"
                      className="w-32 h-32 rounded-xl shadow-2xl"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                      <Music className="w-12 h-12 text-white/50" />
                    </div>
                  )}
                </div>
                
                {/* Song Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {editingTitle ? (
                      <Input
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                        onBlur={saveTitle}
                        className="text-2xl font-bold"
                        autoFocus
                      />
                    ) : (
                      <>
                        <h2 className="text-2xl font-bold text-white">
                          {currentSong.title || '제목을 입력하세요'}
                        </h2>
                        <button onClick={startEditingTitle} className="text-gray-400 hover:text-white">
                          <Edit className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    {editingArtist ? (
                      <Input
                        value={tempArtist}
                        onChange={(e) => setTempArtist(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveArtist()}
                        onBlur={saveArtist}
                        className="text-gray-300"
                        autoFocus
                      />
                    ) : (
                      <>
                        <p className="text-gray-300">{currentSong.artist || '가수를 입력하세요'}</p>
                        <button onClick={startEditingArtist} className="text-gray-400 hover:text-white">
                          <Edit className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mb-4">{currentSong.album}</p>
                  
                  {currentSong.title && (
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="secondary" onClick={handleReSearch} disabled={isSearching}>
                        <RefreshCw className="w-3 h-3" /> 재검색
                      </Button>
                      <Button variant="secondary" onClick={() => setShowLyricsEditor(true)}>
                        <Edit className="w-3 h-3" /> 가사 편집
                      </Button>
                      <Button variant="ghost" onClick={() => fetchAlbumInfo(currentSong.artist, currentSong.title)}>앨범 정보</Button>
                      <Button onClick={() => translateLyrics(currentSong.lyricsLines)} disabled={isTranslating}>
                        {isTranslating ? '번역중...' : '번역'}
                      </Button>
                      <Button 
                        variant="secondary" 
                        onClick={toggleLyricsVisibility}
                        title={lyricsHidden ? '가사 표시' : '가사 숨기기'}
                      >
                        {lyricsHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {lyricsHidden ? '가사 표시' : '가사 숨기기'}
                      </Button>
                      <Button className="bg-green-600 hover:bg-green-700" onClick={openOBSWindow}>
                        <ExternalLink className="w-3 h-3" /> OBS 시작
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Lyrics Display */}
            {currentSong.lyricsLines.length > 0 && (
              <Card className="bg-white/5 border-white/10 p-8">
                {/* Action Buttons */}
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={() => setShowLyricsEditor(true)}
                    className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    전체 가사 보기/편집
                  </button>
                  <button
                    onClick={() => setShowPromptEditor(true)}
                    className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    <FileText className="w-4 h-4" />
                    프롬프트 편집
                  </button>
                </div>
                {/* Current Line */}
                <div className="text-center mb-6">
                  <p className="text-3xl font-bold text-white mb-2">
                    {currentSong.lyricsLines[currentLineIndex] || '...'}
                  </p>
                  
                  {/* Next Line Preview */}
                  {settings.showNextLine && currentLineIndex < currentSong.lyricsLines.length - 1 && (
                    <p className="text-xl text-white/40 mt-4">
                      {currentSong.lyricsLines[currentLineIndex + 1]}
                    </p>
                  )}
                  
                  {/* Translations */}
                  {settings.showTranslation && settings.selectedLanguages.map(lang => (
                    translations[lang]?.[currentLineIndex] && (
                      <p key={lang} className="text-lg text-gray-300 mt-2">
                        <span className="text-xs opacity-60">[{lang.toUpperCase()}]</span> {translations[lang][currentLineIndex]}
                      </p>
                    )
                  ))}
                  {/* Pronunciations (dashboard only, not in OBS overlay) */}
                  {typeof window !== 'undefined' && window.location.pathname.startsWith('/obs') === false && pronunciations && pronunciations[currentLineIndex] && (
                    <p className="text-lg text-green-300/80 mt-2">{pronunciations[currentLineIndex]}</p>
                  )}
                </div>
                
                {/* Translation Button */}
                {currentSong.lyricsLines.length > 0 && (
                  <div className="flex justify-center gap-2 mb-4">
                    <button
                      onClick={() => {
                        if (settings.selectedLanguages.length === 0) {
                          toast.error('번역할 언어를 선택해주세요');
                          return;
                        }
                        // 초기화 후 번역
                        setTranslations({});
                        localStorage.removeItem('current_translations');
                        translateLyrics(currentSong.lyricsLines, true);
                      }}
                      disabled={isTranslating}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium flex items-center gap-2"
                    >
                      {isTranslating ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          번역 중...
                        </>
                      ) : (
                        <>
                          <Globe className="w-4 h-4" />
                          번역하기
                        </>
                      )}
                    </button>
                    {Object.keys(translations).length > 0 && (
                      <button
                        onClick={() => {
                          setTranslations({});
                          localStorage.removeItem('current_translations');
                          localStorage.setItem('translation_enabled', 'false');
                          toast.success('번역이 초기화되었습니다');
                        }}
                        className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
                      >
                        번역 초기화
                      </button>
                    )}
                  </div>
                )}
                
                {/* Progress */}
                <div className="text-center mb-4">
                  <span className="text-sm text-gray-400">
                    {currentLineIndex + 1} / {currentSong.lyricsLines.length}
                  </span>
                </div>
                
                {/* Playback Controls */}
                <div className="flex justify-center gap-2">
                  <Button variant="ghost" onClick={prevLine}><ChevronLeft className="w-5 h-5" /></Button>
                  <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => setIsPlaying(!isPlaying)}>
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                  <Button variant="ghost" onClick={nextLine}><ChevronRight className="w-5 h-5" /></Button>
                  <Button variant="ghost" onClick={resetPlayback}><RotateCcw className="w-5 h-5" /></Button>
                </div>
              </Card>
            )}
          </div>

          {/* Right: Settings */}
          <div className="space-y-4">
            {/* Overlay Settings */}
            <Card className="bg-white/5 border-white/10 p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                오버레이 설정
              </h3>
              
              {/* Mode Selection */}
              <div className="mb-4 p-3 bg-white/5 rounded-lg">
                <p className="text-sm text-gray-400 mb-2">모드</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOverlayMode('mobile')}
                    className={`flex-1 py-2 rounded-lg transition-colors ${
                      overlayMode === 'mobile' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    모바일 (9:16)
                  </button>
                  <button
                    onClick={() => setOverlayMode('desktop')}
                    className={`flex-1 py-2 rounded-lg transition-colors ${
                      overlayMode === 'desktop' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    데스크톱 (16:9)
                  </button>
                </div>
              </div>
              
              {/* Quick Toggles */}
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-white">앨범 정보</span>
                  <input
                    type="checkbox"
                    checked={settings.showAlbumInfo}
                    onChange={(e) => updateSettings({ ...settings, showAlbumInfo: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                </label>
                
                <label className="flex items-center justify-between">
                  <span className="text-white">다음 가사</span>
                  <input
                    type="checkbox"
                    checked={settings.showNextLine}
                    onChange={(e) => updateSettings({ ...settings, showNextLine: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                </label>
                
                <label className="flex items-center justify-between">
                  <span className="text-white">번역</span>
                  <input
                    type="checkbox"
                    checked={settings.showTranslation}
                    onChange={(e) => updateSettings({ ...settings, showTranslation: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                </label>
              </div>
              
              {/* Font Size */}
              <div className="mt-4">
                <label className="text-white text-sm">글자 크기: {settings.fontSize}px</label>
                <input
                  type="range"
                  min="24"
                  max="72"
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ ...settings, fontSize: parseInt(e.target.value) })}
                  className="w-full mt-2"
                />
              </div>
              
              {/* Colors */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-white text-sm">텍스트</label>
                  <input
                    type="color"
                    value={settings.textColor}
                    onChange={(e) => updateSettings({ ...settings, textColor: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer mt-1"
                  />
                </div>
                <div>
                  <label className="text-white text-sm">크로마키</label>
                  <input
                    type="color"
                    value={settings.chromaKey}
                    onChange={(e) => updateSettings({ ...settings, chromaKey: e.target.value })}
                    className="w-full h-8 rounded cursor-pointer mt-1"
                  />
                </div>
              </div>
              
              {/* Translation Languages */}
              <div className="mt-4">
                <label className="text-white text-sm mb-2 block">번역 언어 (최대 3개)</label>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-3 bg-black/20 rounded-lg border border-white/10">
                  {[
                    { code: 'en', name: 'English' },
                    { code: 'ko', name: '한국어' },
                    { code: 'ja', name: '日本語' },
                    { code: 'zh', name: '中文' },
                    { code: 'es', name: 'Español' },
                    { code: 'id', name: 'Indonesia' },
                    { code: 'th', name: 'ไทย' },
                    { code: 'pt', name: 'Português' },
                    { code: 'ar', name: 'العربية' },
                    { code: 'hi', name: 'हिन्दी' },
                    { code: 'vi', name: 'Tiếng Việt' },
                    { code: 'fr', name: 'Français' },
                    { code: 'de', name: 'Deutsch' },
                    { code: 'ru', name: 'Русский' },
                    { code: 'it', name: 'Italiano' },
                    { code: 'tr', name: 'Türkçe' },
                    { code: 'pl', name: 'Polski' },
                    { code: 'nl', name: 'Nederlands' },
                    { code: 'ms', name: 'Melayu' },
                    { code: 'tl', name: 'Tagalog' }
                  ].map(lang => (
                    <label
                      key={lang.code}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                        settings.selectedLanguages.includes(lang.code)
                          ? 'bg-purple-600/30 border border-purple-500'
                          : 'bg-white/5 hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={settings.selectedLanguages.includes(lang.code)}
                        onChange={(e) => {
                          let newLangs;
                          if (e.target.checked) {
                            // 최대 3개까지만 선택 가능
                            if (settings.selectedLanguages.length >= 3) {
                              toast.error('최대 3개 언어까지 선택 가능합니다');
                              return;
                            }
                            newLangs = [...settings.selectedLanguages, lang.code];
                          } else {
                            newLangs = settings.selectedLanguages.filter(l => l !== lang.code);
                          }
                          updateSettings({ ...settings, selectedLanguages: newLangs });
                          // Auto translate with new languages (실시간 번역)
                          if (currentSong.lyricsLines.length > 0 && newLangs.length > 0) {
                            // 번역 상태 저장
                            localStorage.setItem('translation_enabled', 'true');
                            // 즉시 번역 실행
                            translateLyrics(currentSong.lyricsLines, true, newLangs);
                          }
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-white text-sm">{lang.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </Card>

            {/* OBS Position Controls */}
            <Card className="bg-purple-900/30 border-purple-400/30 p-4">
              <h4 className="text-white font-semibold mb-3">📍 위치 조정</h4>
              
              {/* Lyrics Position */}
              <div className="mb-4">
                <label className="text-white text-sm mb-2 block">가사 위치</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8">X:</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.lyricsPosition?.x || 50}
                      onChange={(e) => {
                        const newPos = { 
                          x: parseInt(e.target.value), 
                          y: settings.lyricsPosition?.y || 50 
                        };
                        const newSettings = { ...settings, lyricsPosition: newPos };
                        updateSettings(newSettings);
                        localStorage.setItem('obs_lyrics_position', JSON.stringify(newPos));
                      }}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-300 w-10 text-right">
                      {settings.lyricsPosition?.x || 50}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8">Y:</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.lyricsPosition?.y || 50}
                      onChange={(e) => {
                        const newPos = { 
                          x: settings.lyricsPosition?.x || 50, 
                          y: parseInt(e.target.value) 
                        };
                        const newSettings = { ...settings, lyricsPosition: newPos };
                        updateSettings(newSettings);
                        localStorage.setItem('obs_lyrics_position', JSON.stringify(newPos));
                      }}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-300 w-10 text-right">
                      {settings.lyricsPosition?.y || 50}%
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Title/Artist Position */}
              <div className="mb-4">
                <label className="text-white text-sm mb-2 block">제목/가수 위치</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8">X:</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.titlePosition?.x || 50}
                      onChange={(e) => {
                        const newPos = { 
                          x: parseInt(e.target.value), 
                          y: settings.titlePosition?.y || 10 
                        };
                        const newSettings = { ...settings, titlePosition: newPos };
                        updateSettings(newSettings);
                        localStorage.setItem('obs_title_position', JSON.stringify(newPos));
                      }}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-300 w-10 text-right">
                      {settings.titlePosition?.x || 50}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8">Y:</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.titlePosition?.y || 10}
                      onChange={(e) => {
                        const newPos = { 
                          x: settings.titlePosition?.x || 50, 
                          y: parseInt(e.target.value) 
                        };
                        const newSettings = { ...settings, titlePosition: newPos };
                        updateSettings(newSettings);
                        localStorage.setItem('obs_title_position', JSON.stringify(newPos));
                      }}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-300 w-10 text-right">
                      {settings.titlePosition?.y || 10}%
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Text Size Controls */}
              <div>
                <label className="text-white text-sm mb-2 block">텍스트 크기</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-12">가사:</span>
                    <input
                      type="range"
                      min="50"
                      max="300"
                      step="10"
                      value={settings.textSizes?.originalSize || 200}
                      onChange={(e) => {
                        const newSizes = { 
                          originalSize: parseInt(e.target.value), 
                          translationSize: settings.textSizes?.translationSize || 160 
                        };
                        const newSettings = { ...settings, textSizes: newSizes };
                        updateSettings(newSettings);
                        localStorage.setItem('obs_text_size', JSON.stringify(newSizes));
                      }}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-300 w-14 text-right">
                      {settings.textSizes?.originalSize || 200}px
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-12">번역:</span>
                    <input
                      type="range"
                      min="40"
                      max="250"
                      step="10"
                      value={settings.textSizes?.translationSize || 160}
                      onChange={(e) => {
                        const newSizes = { 
                          originalSize: settings.textSizes?.originalSize || 200, 
                          translationSize: parseInt(e.target.value) 
                        };
                        const newSettings = { ...settings, textSizes: newSizes };
                        updateSettings(newSettings);
                        localStorage.setItem('obs_text_size', JSON.stringify(newSizes));
                      }}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-300 w-14 text-right">
                      {settings.textSizes?.translationSize || 160}px
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Reset Button */}
              <button
                onClick={() => {
                  const defaultPos = { lyricsPosition: { x: 50, y: 50 }, titlePosition: { x: 50, y: 10 }, textSizes: { originalSize: 200, translationSize: 160 } };
                  updateSettings({ ...settings, ...defaultPos });
                  localStorage.setItem('obs_lyrics_position', JSON.stringify({ x: 50, y: 50 }));
                  localStorage.setItem('obs_title_position', JSON.stringify({ x: 50, y: 10 }));
                  localStorage.setItem('obs_text_size', JSON.stringify({ originalSize: 200, translationSize: 160 }));
                  toast.success('위치와 크기가 초기화되었습니다');
                }}
                className="w-full mt-3 py-2 bg-gray-600/50 hover:bg-gray-600/70 text-white rounded-lg text-sm"
              >
                초기값으로 리셋
              </button>
            </Card>

            {/* OBS Quick Actions */}
            <Card className="bg-green-900/30 border-green-400/30 p-4">
              <h4 className="text-white font-semibold mb-3">🚀 빠른 실행</h4>
              <div className="space-y-2">
                <button
                  onClick={openOBSWindow}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-5 h-5" />
                  OBS 오버레이 창 열기
                </button>
                <button
                  onClick={copyOverlayUrl}
                  className="w-full py-2 bg-blue-600/50 hover:bg-blue-600/70 text-white rounded-lg text-sm font-medium"
                >
                  URL만 복사
                </button>
              </div>
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-xs text-gray-400">
                  창 크기: {overlayMode === 'mobile' ? '1080×1920' : '1920×1080'}
                </p>
                <p className="text-xs text-gray-400">
                  크로마키: {settings.chromaKey}
                </p>
              </div>
            </Card>
            
            {/* OBS Info */}
            <Card className="bg-blue-900/30 border-blue-400/30 p-4">
              <h4 className="text-white font-semibold mb-2">📡 OBS 설정 가이드</h4>
              <div className="text-sm text-gray-300 space-y-1">
                <p>1. 브라우저 소스 추가</p>
                <p>2. URL 붙여넣기 또는 창 캡처</p>
                <p>3. 크기: {overlayMode === 'mobile' ? '1080×1920' : '1920×1080'}</p>
                <p>4. 크로마키 필터: {settings.chromaKey}</p>
              </div>
            </Card>
          </div>
        </div>
        
        {/* Keyboard Shortcuts Help */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            단축키: Space(다음) · Shift+Space(이전) · ←→(이동) · R(리셋) · Ctrl+O(OBS 창)
          </p>
        </div>
      </div>
    </div>
  );
}