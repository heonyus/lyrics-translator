'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Copy, Monitor, Smartphone, Music, Settings, Play, Pause, RotateCcw, ChevronRight, ChevronLeft, ExternalLink, Edit, RefreshCw, FileText, Eye, Globe, Loader } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import LyricsResultSelector from '@/components/LyricsResultSelector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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
    selectedLanguages: ['en', 'ja']
  });

  // Translations
  const [translations, setTranslations] = useState<any>({});
  const [pronunciations, setPronunciations] = useState<string[] | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  // Search session control (to cancel/ignore late results)
  const searchSessionRef = useRef(0);
  const cancelSearchRef = useRef<(() => void) | null>(null);
  
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

  // Run multiple providers concurrently and append results as soon as they arrive
  const parallelSearch = async (artist: string, title: string, query: string, forceRefresh = false) => {
    // new session id
    const mySession = ++searchSessionRef.current;
    const controllers: AbortController[] = [];
    const addController = () => { const c = new AbortController(); controllers.push(c); return c; };
    // expose canceler for outer handlers
    cancelSearchRef.current = () => controllers.forEach(c => { try { c.abort(); } catch {} });
    const enqueue = (arr: any[]) => {
      // ignore late results from older sessions
      if (mySession !== searchSessionRef.current) return;
      if (arr && arr.length > 0) {
        setSearchResults(prev => {
          if (mySession !== searchSessionRef.current) return prev;
          // dedupe by lyrics+source key
          const seen = new Set(prev.map((r: any) => `${r.source}|${(r.lyrics||'').slice(0,50)}`));
          const merged = [...prev];
          for (const r of arr) {
            const key = `${r.source||'unknown'}|${String(r.lyrics||'').slice(0,50)}`;
            if (!seen.has(key)) merged.push(r);
          }
          return merged;
        });
      }
    };

    const tasks: Array<Promise<void>> = [];
    // Always run multiple providers in parallel (fastest wins): MCP + Korean scrapers + consolidate optional
    {
      const c = addController();
      (async () => {
        try {
          const res = await fetch('/api/lyrics/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artist, title, query }), signal: c.signal });
          const json = await res.json().catch(()=>null);
          enqueue(adaptResults('mcp', json));
          if (json?.result?.albumInfo) {
            setCurrentSong(prev => ({ ...prev, album: json.result.albumInfo.album || prev.album, coverUrl: json.result.albumInfo.coverUrl || prev.coverUrl }));
          }
        } catch {}
      })();
    }
    {
      const c = addController();
      (async () => {
        try {
          const res = await fetch('/api/lyrics/korean-scrapers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artist, title }), signal: c.signal });
          const json = await res.json().catch(()=>null);
          enqueue(adaptResults('kr', json));
        } catch {}
      })();
    }
    {
      const c = addController();
      (async () => {
        try {
          // consolidate는 기존 결과 묶음에 쓰이므로, 일단 페이지에서는 사용 안 하지만 placeholder
          const res = await fetch('/api/lyrics/consolidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ results: [], artist, title }), signal: c.signal });
          const json = await res.json().catch(()=>null);
          enqueue(adaptResults('consolidate', json));
        } catch {}
      })();
    }

    // smart-scraper-v3 (기존 유지)
    tasks.push((async () => {
      const c = addController();
      try {
        const res = await fetch('/api/lyrics/smart-scraper-v3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, forceRefresh }), signal: c.signal });
        const json = await res.json().catch(()=>null);
        enqueue(adaptResults('v3', json));
      } catch {}
    })());
    // llm-search (기존 유지)
    tasks.push((async () => {
      const c = addController();
      try {
        const res = await fetch('/api/lyrics/llm-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artist, title }), signal: c.signal });
        const json = await res.json().catch(()=>null);
        enqueue(adaptResults('llm', json));
      } catch {}
    })());
    // gemini-search
    tasks.push((async () => {
      const c = addController();
      try {
        const res = await fetch('/api/lyrics/gemini-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artist, title }), signal: c.signal });
        const json = await res.json().catch(()=>null);
        enqueue(adaptResults('gemini', json));
      } catch {}
    })());
    // search-engine
    tasks.push((async () => {
      const c = addController();
      try {
        const res = await fetch('/api/lyrics/search-engine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artist, title, engine: 'auto' }), signal: c.signal });
        const json = await res.json().catch(()=>null);
        enqueue(adaptResults('engine', json));
      } catch {}
    })());

    // Wait until at least one result arrives or all tasks settle
    const timeout = new Promise<void>(r => setTimeout(r, 8000));
    await Promise.race([
      (async () => {
        while (true) {
          await new Promise(r => setTimeout(r, 200));
          if (mySession !== searchSessionRef.current) break; // canceled/invalidated
          if ((searchResults as any[]).length > 0) break;
        }
      })(),
      timeout
    ]);
    // Allow remaining tasks to finish in background (no blocking)
    Promise.allSettled(tasks).then(()=>{});
    return () => controllers.forEach(c => c.abort());
  };

  // Quick search
  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    
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
            artist = data.albumInfo.artistDisplay.replace(/\([^)]*\)$/, '').trim();
            title = data.albumInfo.titleDisplay.replace(/\([^)]*\)$/, '').trim();
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
      
      // Fire providers in parallel and append as they arrive
      await parallelSearch(artist, title, searchQuery, false);
      if ((searchResults as any[]).length > 0) {
        toast.success('첫 결과를 가져왔습니다');
      }
    } catch (error) {
      toast.error('검색 실패');
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
        const response = await fetch('/api/translate/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lines,
            targetLanguage: lang,  // targetLanguages가 아닌 targetLanguage 사용
            context: {
              title: currentSong.title,
              artist: currentSong.artist
            },
            task: 'translate'
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

  // Get OBS URL
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
    navigator.clipboard.writeText(getOverlayUrl(true));
    toast.success('OBS URL 복사됨!');
  };

  // Open OBS window
  const openOBSWindow = () => {
    // Save current state to localStorage
    localStorage.setItem('show_original', 'true');
    
    if (overlayMode === 'mobile') {
      // TikTok Live용 540x960 창 (1080x1920 컨텐츠를 0.5 스케일로 표시)
      const screenHeight = window.screen.availHeight;
      const targetHeight = Math.min(960, screenHeight - 100);
      const targetWidth = Math.round(targetHeight * 9 / 16); // 9:16 비율 유지
      const windowFeatures = `width=${targetWidth},height=${targetHeight},left=100,top=50,resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no,location=no`;
      const obsWindow = window.open(getOverlayUrl(true), 'TikTokLiveOverlay', windowFeatures);
      
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
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {currentSong.title || '노래를 검색하세요'}
                  </h2>
                  <p className="text-gray-300 mb-1">{currentSong.artist}</p>
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