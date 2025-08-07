'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import AlbumCard from '@/components/mobile-live/AlbumCard';
import LyricsDisplay from '@/components/mobile-live/LyricsDisplay';
import Script from 'next/script';
import Head from 'next/head';
import './mobile-live.css';
import '../obs.css';



interface AlbumInfo {
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
}

export default function MobileLiveOverlay() {
  const searchParams = useSearchParams();
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  
  // Lyrics states
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [lyricsLines, setLyricsLines] = useState<string[]>([]);
  const [translations, setTranslations] = useState<any>({});
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  
  // Album info
  const [albumInfo, setAlbumInfo] = useState<AlbumInfo>({
    title: '',
    artist: '',
    album: '',
    coverUrl: ''
  });
  
  // Display settings
  const [showAlbumInfo, setShowAlbumInfo] = useState(true);
  const [showNextLine, setShowNextLine] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  
  // OBS Settings - Mobile optimized
  const [fontSize, setFontSize] = useState(48);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [chromaKey, setChromaKey] = useState('#00FF00'); // Standard green screen color
  const [isViewer, setIsViewer] = useState(false); // 시청자 화면인지 확인

  // Calculate scale based on actual window size
  const [scale, setScale] = useState(0.5); // 기본 스케일 0.5 (540x960)

  // Force window resize on mount - 540x960 크기로 설정
  useEffect(() => {
    const targetViewWidth = 540;
    const targetViewHeight = 960;
    
    // 초기 창 크기 설정
    if (typeof window !== 'undefined') {
      const resizeWindow = () => {
        // 현재 창 크기와 목표 크기 비교
        const currentWidth = window.outerWidth;
        const currentHeight = window.outerHeight;
        
        // 브라우저 UI 크기 계산
        const chromeWidth = currentWidth - window.innerWidth;
        const chromeHeight = currentHeight - window.innerHeight;
        
        // 목표 크기로 리사이즈
        window.resizeTo(
          targetViewWidth + chromeWidth,
          targetViewHeight + chromeHeight
        );
      };
      
      // 즉시 실행
      resizeWindow();
      
      // 지연 실행으로 확실하게 적용
      [100, 300, 500, 1000].forEach(delay => {
        setTimeout(resizeWindow, delay);
      });
      
      // 스케일 고정 (1080x1920을 540x960으로)
      setScale(0.5);
    }
  }, []);

  useEffect(() => {
    const calculateScale = () => {
      const targetWidth = 1080;
      const targetHeight = 1920;
      const actualWidth = window.innerWidth;
      const actualHeight = window.innerHeight;
      
      // Calculate scale to fit the content in the window
      const scaleX = actualWidth / targetWidth;
      const scaleY = actualHeight / targetHeight;
      
      // Use the smaller scale to ensure content fits
      const newScale = Math.min(scaleX, scaleY, 1);
      setScale(newScale);
      
      setWindowSize({ width: actualWidth, height: actualHeight });
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    
    return () => {
      window.removeEventListener('resize', calculateScale);
    };
  }, []);

  // Fullscreen functions
  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if ((elem as any).webkitRequestFullscreen) {
      (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).msRequestFullscreen) {
      (elem as any).msRequestFullscreen();
    }
    setIsFullscreen(true);
  };

  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }
    setIsFullscreen(false);
  };

  // Check fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    // Keyboard shortcut for fullscreen
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        if (isFullscreen) {
          exitFullscreen();
        } else {
          enterFullscreen();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isFullscreen]);

  useEffect(() => {
    // Parse URL params
    const size = parseInt(searchParams.get('fontSize') || '48');
    const text = searchParams.get('textColor') || '#FFFFFF';
    const chroma = searchParams.get('chromaKey') || '#00FF00';
    const showAlbum = searchParams.get('showAlbum') !== 'false';
    const showNext = searchParams.get('showNext') !== 'false';
    const viewer = searchParams.get('viewer') === 'true';  // 시청자 화면인지 확인
    const showTrans = searchParams.get('showTranslation') !== 'false';
    
    setFontSize(size);
    setTextColor(text);
    setChromaKey(chroma);
    setShowAlbumInfo(showAlbum);
    setShowNextLine(showNext);
    setShowTranslation(showTrans);
    setIsViewer(viewer);
  }, [searchParams]);

  useEffect(() => {
    // Load data from localStorage
    const loadData = () => {
      const lyrics = localStorage.getItem('current_lrc') || '';
      const translationsData = localStorage.getItem('current_translations');
      const languages = localStorage.getItem('selected_languages');
      const title = localStorage.getItem('current_title') || '';
      const artist = localStorage.getItem('current_artist') || '';
      const album = localStorage.getItem('current_album') || '';
      const coverUrl = localStorage.getItem('current_cover_url') || '';
      
      // Load mobile settings
      const mobileSettings = localStorage.getItem('mobile_overlay_settings');
      if (mobileSettings) {
        const settings = JSON.parse(mobileSettings);
        setShowAlbumInfo(settings.showAlbumInfo ?? true);
        setShowNextLine(settings.showNextLine ?? true);
        setShowTranslation(settings.showTranslation ?? true);
      }
      
      if (lyrics) {
        setLyricsLines(lyrics.split('\n').filter(line => line.trim()));
      }
      
      if (translationsData) {
        setTranslations(JSON.parse(translationsData));
      }
      
      if (languages) {
        setSelectedLanguages(JSON.parse(languages));
      }
      
      setAlbumInfo({
        title,
        artist,
        album,
        coverUrl
      });
    };
    
    loadData();
    
    // Listen for updates
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'current_line_index') {
        setCurrentLineIndex(parseInt(e.newValue || '0'));
      } else if (e.key === 'mobile_overlay_settings') {
        const settings = JSON.parse(e.newValue || '{}');
        setShowAlbumInfo(settings.showAlbumInfo ?? true);
        setShowNextLine(settings.showNextLine ?? true);
        setShowTranslation(settings.showTranslation ?? true);
      } else {
        loadData();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const nextLineIndex = currentLineIndex + 1;
  const hasNextLine = nextLineIndex < lyricsLines.length;

  return (
    <>
      <Head>
        <meta name="viewport" content="width=1080, height=1920, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="format-detection" content="telephone=no" />
      </Head>
      
      <div 
        className="mobile-live-container"
        style={{ 
          backgroundColor: chromaKey,
          width: '1080px',
          height: '1920px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'hidden'
        }}
      >
      {/* Top Section - Album Info (if enabled) */}
      {showAlbumInfo && albumInfo.title && (
        <div className="absolute top-[20%] left-44 z-10">
          <AlbumCard
            title={albumInfo.title}
            artist={albumInfo.artist}
            album={albumInfo.album}
            coverUrl={albumInfo.coverUrl}
            textColor={textColor}
            compact={false}
          />
        </div>
      )}

      {/* Bottom Section - Lyrics Display */}
      <div className="absolute top-[45%] right-[15%] w-[45%] max-w-[450px]">
        <LyricsDisplay
          currentLine={lyricsLines[currentLineIndex] || ''}
          nextLine={hasNextLine ? lyricsLines[nextLineIndex] : undefined}
          translations={
            selectedLanguages.reduce((acc, lang) => {
              if (translations[lang]?.[currentLineIndex]) {
                acc[lang] = translations[lang][currentLineIndex];
              }
              return acc;
            }, {} as { [lang: string]: string })
          }
          fontSize={fontSize}
          textColor={textColor}
          showNext={!isViewer && showNextLine}
          showTranslation={showTranslation}
        />
      </div>
    </div>
    </>
  );
}