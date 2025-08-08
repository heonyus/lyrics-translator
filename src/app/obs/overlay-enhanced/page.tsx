'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LyricsLine {
  time: number;
  text: string;
  translation?: string;
}

interface TextSettings {
  originalSize: number;
  translationSize: number;
  lineSpacing: number;
  fontFamily: string;
  shadowIntensity: number;
  originalColor: string;
  translationColor: string;
  alignment: 'left' | 'center' | 'right';
}

export default function EnhancedOBSOverlay() {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [lyrics, setLyrics] = useState<LyricsLine[]>([]);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [artistDisplay, setArtistDisplay] = useState('');
  const [titleDisplay, setTitleDisplay] = useState('');
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [isPlaying, setIsPlaying] = useState(false);
  const [lyricsHidden, setLyricsHidden] = useState(false);
  
  // Position settings for customization
  const [lyricsPosition, setLyricsPosition] = useState({ x: 50, y: 50 }); // Center by default
  const [titlePosition, setTitlePosition] = useState({ x: 50, y: 10 }); // Top center by default
  
  // Enhanced text settings with defaults - MASSIVELY INCREASED FOR HD
  const [textSettings, setTextSettings] = useState<TextSettings>({
    originalSize: 200, // Huge size for HD quality
    translationSize: 160, // Large translation text
    lineSpacing: 40, // More spacing for readability
    fontFamily: 'Pretendard, Noto Sans KR, Arial, sans-serif',
    shadowIntensity: 12, // Strong shadow for visibility
    originalColor: '#FFFFFF',
    translationColor: '#FFD700',
    alignment: 'center',
  });
  
  // High-quality canvas rendering
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  
  // Parse LRC format
  function parseLRC(lrcContent: string): LyricsLine[] {
    const lines = lrcContent.split('\n');
    const parsed: LyricsLine[] = [];
    
    lines.forEach(line => {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = parseInt(match[3]) * 10;
        const time = minutes * 60 + seconds + milliseconds / 1000;
        const text = match[4].trim();
        if (text) {
          parsed.push({ time, text });
        }
      }
    });
    
    return parsed.sort((a, b) => a.time - b.time);
  }
  
  // Get multilingual display format
  async function updateMultilingualDisplay(artist: string, title: string) {
    try {
      const response = await fetch('/api/album/multilingual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setArtistDisplay(data.artistDisplay);
        setTitleDisplay(data.titleDisplay);
      } else {
        // Fallback
        setArtistDisplay(artist);
        setTitleDisplay(title);
      }
    } catch (error) {
      console.error('Multilingual display error:', error);
      setArtistDisplay(artist);
      setTitleDisplay(title);
    }
  }
  
  // Get GPT-5 translation
  async function getTranslation(text: string, targetLang: string): Promise<string> {
    try {
      const cached = translations.get(text);
      if (cached) return cached;
      
      const response = await fetch('/api/translate/gpt5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          targetLanguage: targetLang,
          context: { artist: artistDisplay, title: titleDisplay },
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        translations.set(text, data.translation);
        return data.translation;
      }
    } catch (error) {
      console.error('Translation error:', error);
    }
    return text; // Fallback to original
  }
  
  // Load settings from localStorage
  useEffect(() => {
    const loadSettings = () => {
      const savedSettings = localStorage.getItem('obs_text_settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setTextSettings(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error('Failed to parse settings:', e);
        }
      }
    };
    
    loadSettings();
    
    // Listen for settings changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'obs_text_settings') {
        loadSettings();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  // Main update loop
  useEffect(() => {
    const interval = setInterval(() => {
      // Current line index
      const lineIndex = localStorage.getItem('current_line_index');
      if (lineIndex) {
        setCurrentLineIndex(parseInt(lineIndex));
      }
      
      // Song info
      const songTitle = localStorage.getItem('current_song_title');
      const songArtist = localStorage.getItem('current_song_artist');
      
      if (songTitle && songTitle !== title) {
        setTitle(songTitle);
      }
      if (songArtist && songArtist !== artist) {
        setArtist(songArtist);
      }
      
      // Load lyrics
      const lrcContent = localStorage.getItem('current_lrc');
      const fullLyrics = localStorage.getItem('current_lyrics_full');
      
      if (lrcContent) {
        const parsed = parseLRC(lrcContent);
        setLyrics(parsed);
      } else if (fullLyrics) {
        const lines = fullLyrics.split('\n').filter(line => line.trim());
        const parsed = lines.map((line, index) => ({
          time: index * 3,
          text: line.trim(),
        }));
        setLyrics(parsed);
      }
      
      // Play state
      const playState = localStorage.getItem('karaoke_control');
      setIsPlaying(playState === 'play');
      
      // Lyrics visibility
      const hidden = localStorage.getItem('lyrics_hidden') === 'true';
      setLyricsHidden(hidden);
      
      // Position settings
      const lyricsPos = localStorage.getItem('obs_lyrics_position');
      if (lyricsPos) {
        try {
          setLyricsPosition(JSON.parse(lyricsPos));
        } catch {}
      }
      
      const titlePos = localStorage.getItem('obs_title_position');
      if (titlePos) {
        try {
          setTitlePosition(JSON.parse(titlePos));
        } catch {}
      }
      
      // Text size settings
      const textSize = localStorage.getItem('obs_text_size');
      if (textSize) {
        try {
          const sizes = JSON.parse(textSize);
          setTextSettings(prev => ({
            ...prev,
            originalSize: sizes.originalSize || prev.originalSize,
            translationSize: sizes.translationSize || prev.translationSize,
          }));
        } catch {}
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [title, artist]);
  
  // Update multilingual display when artist/title changes
  useEffect(() => {
    if (artist && title) {
      updateMultilingualDisplay(artist, title);
    }
  }, [artist, title]);
  
  // Get translations for current and next lines
  useEffect(() => {
    const translateLines = async () => {
      const targetLang = localStorage.getItem('obs_translation_lang') || 'en';
      const showTranslation = localStorage.getItem('obs_show_translation') !== 'false';
      
      if (!showTranslation || !lyrics.length) return;
      
      // Translate current and next 2 lines
      for (let i = currentLineIndex; i < Math.min(currentLineIndex + 3, lyrics.length); i++) {
        if (lyrics[i] && !translations.has(lyrics[i].text)) {
          const translation = await getTranslation(lyrics[i].text, targetLang);
          setTranslations(prev => new Map(prev).set(lyrics[i].text, translation));
        }
      }
    };
    
    translateLines();
  }, [currentLineIndex, lyrics]);
  
  // Generate text shadow based on intensity
  const generateShadow = (intensity: number): string => {
    const shadows = [];
    const baseOpacity = 0.9;
    
    for (let i = 1; i <= intensity; i++) {
      const opacity = baseOpacity - (i * 0.1);
      shadows.push(`0 0 ${i * 5}px rgba(0,0,0,${opacity})`);
    }
    
    // Add hard shadow for better readability
    shadows.push('2px 2px 4px rgba(0,0,0,1)');
    shadows.push('-2px -2px 4px rgba(0,0,0,0.8)');
    
    return shadows.join(', ');
  };
  
  const currentLine = lyrics[currentLineIndex];
  const nextLine = lyrics[currentLineIndex + 1];
  const currentTranslation = currentLine ? translations.get(currentLine.text) : '';
  const showTranslation = localStorage.getItem('obs_show_translation') !== 'false';
  
  return (
    <div 
      className="obs-overlay"
      style={{
        width: '100vw',
        height: '100vh',
        background: '#00FF00', // Chroma key
        position: 'relative',
        fontFamily: textSettings.fontFamily,
        overflow: 'hidden',
      }}
    >
      {/* Song Info */}
      <AnimatePresence>
        {artistDisplay && titleDisplay && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'absolute',
              top: `${titlePosition.y}%`,
              left: `${titlePosition.x}%`,
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: textSettings.originalColor,
              textShadow: generateShadow(textSettings.shadowIntensity),
            }}
          >
            <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '10px' }}>
              {artistDisplay}
            </div>
            <div style={{ fontSize: '28px', opacity: 0.9 }}>
              {titleDisplay}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main Lyrics Display - Hidden when lyricsHidden is true */}
      {!lyricsHidden && (
        <div
          style={{
            position: 'absolute',
            top: `${lyricsPosition.y}%`,
            left: `${lyricsPosition.x}%`,
            transform: 'translate(-50%, -50%)',
            width: '90%',
            textAlign: textSettings.alignment,
          }}
        >
          {/* Current Line */}
          <AnimatePresence mode="wait">
          {currentLine && (
            <motion.div
              key={currentLineIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              style={{
                fontSize: `${textSettings.originalSize}px`,
                fontWeight: 900,
                color: textSettings.originalColor,
                textShadow: generateShadow(textSettings.shadowIntensity),
                lineHeight: 1.2,
                marginBottom: `${textSettings.lineSpacing}px`,
                letterSpacing: '0.02em',
              }}
            >
              {currentLine.text}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Translation */}
        <AnimatePresence mode="wait">
          {showTranslation && currentTranslation && (
            <motion.div
              key={`trans-${currentLineIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              style={{
                fontSize: `${textSettings.translationSize}px`,
                fontWeight: 700,
                color: textSettings.translationColor,
                textShadow: generateShadow(textSettings.shadowIntensity - 2),
                lineHeight: 1.2,
                marginBottom: `${textSettings.lineSpacing * 2}px`,
              }}
            >
              {currentTranslation}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Next Line Preview */}
        <AnimatePresence>
          {nextLine && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              style={{
                fontSize: `${textSettings.originalSize * 0.6}px`,
                fontWeight: 500,
                color: textSettings.originalColor,
                textShadow: generateShadow(textSettings.shadowIntensity - 4),
                marginTop: `${textSettings.lineSpacing * 2}px`,
              }}
            >
              {nextLine.text}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      )}
      
      {/* Progress Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          left: '10%',
          right: '10%',
          height: '4px',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <motion.div
          animate={{
            width: `${((currentLineIndex + 1) / lyrics.length) * 100}%`,
          }}
          transition={{ duration: 0.5 }}
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, #FFD700, #FFA500)',
            boxShadow: '0 0 10px rgba(255,215,0,0.5)',
          }}
        />
      </div>
      
      {/* High Quality Rendering Style */}
      <style jsx global>{`
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        
        @font-face {
          font-family: 'Pretendard';
          src: url('/fonts/Pretendard-Black.woff2') format('woff2');
          font-weight: 900;
          font-display: swap;
        }
        
        @font-face {
          font-family: 'Pretendard';
          src: url('/fonts/Pretendard-Bold.woff2') format('woff2');
          font-weight: 700;
          font-display: swap;
        }
        
        @font-face {
          font-family: 'Noto Sans KR';
          src: url('/fonts/NotoSansKR-Black.woff2') format('woff2');
          font-weight: 900;
          font-display: swap;
        }
      `}</style>
    </div>
  );
}