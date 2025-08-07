'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import '../obs.css';

export default function CombinedOBSPage() {
  const searchParams = useSearchParams();
  
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [lyricsLines, setLyricsLines] = useState<string[]>([]);
  const [translations, setTranslations] = useState<any>({});
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [showOriginal, setShowOriginal] = useState(true);
  
  // OBS Settings - Initialize from URL params or localStorage
  const [fontSize, setFontSize] = useState(60);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [chromaKey, setChromaKey] = useState('#00FF00');

  useEffect(() => {
    // Parse URL params on mount
    const size = parseInt(searchParams.get('fontSize') || '60');
    const text = searchParams.get('textColor') || '#FFFFFF';
    const chroma = searchParams.get('chromaKey') || '#00FF00';
    
    setFontSize(size);
    setTextColor(text);
    setChromaKey(chroma);
  }, [searchParams]);

  useEffect(() => {
    // Load data from localStorage
    const loadData = () => {
      const lyrics = localStorage.getItem('current_lrc') || '';
      const translationsData = localStorage.getItem('current_translations');
      const languages = localStorage.getItem('selected_languages');
      const showOrig = localStorage.getItem('show_original');
      
      // Load OBS settings from localStorage if they exist
      const savedSettings = localStorage.getItem('obs_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setFontSize(settings.fontSize || fontSize);
        setTextColor(settings.textColor || textColor);
        setChromaKey(settings.chromaKey || chromaKey);
      }
      
      if (showOrig !== null) {
        setShowOriginal(showOrig === 'true');
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
    };
    
    loadData();
    
    // Listen for updates
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'current_line_index') {
        setCurrentLineIndex(parseInt(e.newValue || '0'));
      } else if (e.key === 'show_original') {
        setShowOriginal(e.newValue === 'true');
      } else if (e.key === 'obs_settings') {
        const settings = JSON.parse(e.newValue || '{}');
        setFontSize(settings.fontSize || fontSize);
        setTextColor(settings.textColor || textColor);
        setChromaKey(settings.chromaKey || chromaKey);
      } else if (e.key === 'current_lrc' || e.key === 'current_translations' || e.key === 'selected_languages') {
        loadData();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Calculate scale based on viewport
  const [scale, setScale] = useState(1);
  
  useEffect(() => {
    const calculateScale = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const targetWidth = 1920;
      const targetHeight = 1080;
      
      // Calculate scale to fit viewport while maintaining aspect ratio
      const scaleX = viewportWidth / targetWidth;
      const scaleY = viewportHeight / targetHeight;
      const newScale = Math.min(scaleX, scaleY);
      
      setScale(newScale);
    };
    
    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  return (
    <div 
      className="combined-overlay flex items-center justify-center"
      style={{ 
        backgroundColor: chromaKey,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden'
      }}
    >
      <div 
        style={{ 
          width: '1920px',
          height: '1080px',
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          position: 'relative'
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-10 max-w-[90%]">
          {/* Original Line - Only show if enabled */}
          {showOriginal && (
            <div 
              className="mb-6"
              style={{
                fontSize: `${fontSize}px`,
                color: textColor,
                lineHeight: 1.3,
                fontWeight: 'bold',
                textShadow: `
                  0 0 30px rgba(0,0,0,1),
                  0 0 20px rgba(0,0,0,1),
                  0 0 10px rgba(0,0,0,1),
                  3px 3px 6px rgba(0,0,0,1),
                  -1px -1px 2px rgba(0,0,0,1)
                `,
              }}
            >
              {lyricsLines[currentLineIndex] || '...'}
            </div>
          )}

          {/* Translations */}
          {selectedLanguages.map((lang, idx) => (
            translations[lang]?.[currentLineIndex] && (
              <div
                key={lang}
                style={{
                  fontSize: `${fontSize * (showOriginal ? 0.7 : 1)}px`,
                  color: textColor,
                  opacity: showOriginal ? (0.95 - (idx * 0.1)) : 1,
                  fontWeight: showOriginal ? 'normal' : 'bold',
                  marginTop: idx === 0 ? (showOriginal ? '20px' : '0') : '15px',
                  textShadow: `
                    0 0 20px rgba(0,0,0,1),
                    0 0 10px rgba(0,0,0,1),
                    2px 2px 4px rgba(0,0,0,1)
                  `,
                }}
              >
                <span className="text-xs opacity-60 mr-2">[{lang.toUpperCase()}]</span>
                {translations[lang][currentLineIndex]}
              </div>
            )
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}