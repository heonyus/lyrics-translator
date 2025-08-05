'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLRCFetcher } from '@/domains/lrc-fetcher';
import { useLyrics } from '@/domains/lyrics';
import { KaraokeDisplayWithTranslation } from '@/domains/karaoke';
import { SupportedLanguage, isSupportedLanguage } from '@/domains/translation';

export default function OverlayPage() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get parameters from URL
  const query = searchParams.get('q') || searchParams.get('query') || '';
  const targetLang = searchParams.get('lang') || searchParams.get('targetLang') || 'en';
  const sourceLang = searchParams.get('sourceLang') || undefined;
  const fontSize = parseInt(searchParams.get('fontSize') || '32');
  const highlightColor = searchParams.get('color') || '#FFD700';
  const animation = (searchParams.get('animation') || 'glow') as 'fade' | 'slide' | 'glow';
  const autoPlay = searchParams.get('autoPlay') !== 'false';
  
  // Validate language parameters
  const targetLanguage: SupportedLanguage = isSupportedLanguage(targetLang) ? targetLang : 'en';
  const sourceLanguage: SupportedLanguage | undefined = sourceLang && isSupportedLanguage(sourceLang) ? sourceLang : undefined;
  
  const {
    searchResults,
    fetchedLRC,
    error: fetchError,
    autoFetch,
  } = useLRCFetcher();
  
  const {
    lyrics,
    playbackState,
    currentLine,
    currentWord,
    loadLRC,
    play,
    setPlaybackRate,
  } = useLyrics();
  
  // Auto-fetch lyrics on mount
  useEffect(() => {
    if (query) {
      setIsLoading(true);
      autoFetch(query)
        .then(() => setIsLoading(false))
        .catch((err) => {
          setError(err.message);
          setIsLoading(false);
        });
    } else {
      setError('검색어가 없습니다. ?q=노래+이름 또는 ?q=youtube_url 형식으로 사용하세요');
      setIsLoading(false);
    }
  }, [query, autoFetch]);
  
  // Load fetched LRC
  useEffect(() => {
    if (fetchedLRC) {
      loadLRC(fetchedLRC);
    }
  }, [fetchedLRC, loadLRC]);
  
  // Auto-play when lyrics are loaded
  useEffect(() => {
    if (lyrics && autoPlay) {
      // Small delay to ensure everything is loaded
      setTimeout(() => play(), 100);
    }
  }, [lyrics, autoPlay, play]);
  
  // Set playback rate if specified
  useEffect(() => {
    const rate = parseFloat(searchParams.get('rate') || '1');
    if (rate !== 1 && rate > 0 && rate <= 2) {
      setPlaybackRate(rate);
    }
  }, [searchParams, setPlaybackRate]);
  
  // Apply transparent styles for OBS
  useEffect(() => {
    // Make background transparent
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    
    // Hide scrollbars
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.backgroundColor = '';
      document.documentElement.style.backgroundColor = '';
      document.body.style.overflow = '';
    };
  }, []);
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        <div className="text-2xl animate-pulse">가사 불러오는 중...</div>
      </div>
    );
  }
  
  // Error state
  if (error || fetchError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-2xl text-red-500 bg-black/50 p-4 rounded">
          오류: {error || fetchError?.message}
        </div>
      </div>
    );
  }
  
  // No lyrics state
  if (!lyrics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-2xl text-gray-400">가사를 찾을 수 없습니다</div>
      </div>
    );
  }
  
  return (
    <div className="overlay-container h-screen flex items-center justify-center p-8">
      <style jsx global>{`
        body {
          background: transparent !important;
          margin: 0;
          padding: 0;
        }
        
        html {
          background: transparent !important;
        }
        
        .overlay-container {
          color: white;
          text-shadow: 
            2px 2px 4px rgba(0, 0, 0, 0.8),
            -1px -1px 2px rgba(0, 0, 0, 0.8),
            1px -1px 2px rgba(0, 0, 0, 0.8),
            -1px 1px 2px rgba(0, 0, 0, 0.8);
        }
        
        .karaoke-word {
          text-shadow: inherit;
        }
        
        .karaoke-translation {
          color: #FFE66D;
          font-weight: 500;
        }
      `}</style>
      
      <KaraokeDisplayWithTranslation
        lyrics={lyrics}
        currentLine={currentLine}
        currentWord={currentWord}
        currentTime={playbackState.currentTime}
        targetLanguages={[targetLanguage]}
        sourceLanguage={sourceLanguage}
        className="w-full max-w-4xl"
        fontSize={fontSize}
        highlightColor={highlightColor}
        animationType={animation}
        fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
      />
    </div>
  );
}