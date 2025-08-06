'use client';

import React, { useEffect, useState } from 'react';
import { Music2, Disc3 } from 'lucide-react';

interface SongInfo {
  title: string;
  artist: string;
  album?: string;
}

export default function TitleDisplay() {
  const [songInfo, setSongInfo] = useState<SongInfo>({
    title: '곡을 선택해주세요',
    artist: '아티스트'
  });
  const [animation, setAnimation] = useState(false);

  useEffect(() => {
    // localStorage에서 곡 정보 폴링
    const updateSongInfo = () => {
      const title = localStorage.getItem('current_song_title');
      const artist = localStorage.getItem('current_song_artist');
      const album = localStorage.getItem('current_song_album');

      if (title && artist) {
        const newInfo = { title, artist, album: album || undefined };
        
        // 곡이 변경되었을 때 애니메이션
        if (newInfo.title !== songInfo.title || newInfo.artist !== songInfo.artist) {
          setAnimation(true);
          setTimeout(() => setAnimation(false), 500);
        }
        
        setSongInfo(newInfo);
      }
    };

    updateSongInfo();
    const interval = setInterval(updateSongInfo, 500);

    return () => clearInterval(interval);
  }, [songInfo]);

  // URL 파라미터로 스타일 커스터마이징
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const style = params.get('style') || 'modern';
    const position = params.get('position') || 'bottom-left';
    const bgColor = params.get('bg') || '#000000';
    const textColor = params.get('color') || '#FFFFFF';
    
    document.documentElement.style.setProperty('--bg-color', bgColor);
    document.documentElement.style.setProperty('--text-color', textColor);
    document.documentElement.setAttribute('data-style', style);
    document.documentElement.setAttribute('data-position', position);
  }, []);

  return (
    <div className="title-container">
      <div className={`title-card ${animation ? 'animate' : ''}`}>
        <div className="icon-wrapper">
          <Disc3 className="disc-icon" />
          <Music2 className="music-icon" />
        </div>
        
        <div className="song-info">
          <div className="song-title">{songInfo.title}</div>
          <div className="song-artist">{songInfo.artist}</div>
          {songInfo.album && (
            <div className="song-album">{songInfo.album}</div>
          )}
        </div>
      </div>

      <style jsx global>{`
        :root {
          --bg-color: #000000;
          --text-color: #FFFFFF;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: transparent;
          overflow: hidden;
        }

        .title-container {
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: flex-end;
          padding: 30px;
        }

        /* 위치 설정 */
        [data-position="top-left"] .title-container {
          align-items: flex-start;
          justify-content: flex-start;
        }

        [data-position="top-right"] .title-container {
          align-items: flex-start;
          justify-content: flex-end;
        }

        [data-position="bottom-left"] .title-container {
          align-items: flex-end;
          justify-content: flex-start;
        }

        [data-position="bottom-right"] .title-container {
          align-items: flex-end;
          justify-content: flex-end;
        }

        [data-position="center"] .title-container {
          align-items: center;
          justify-content: center;
        }

        /* 기본 모던 스타일 */
        .title-card {
          background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(0,0,0,0.7));
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 20px 30px;
          display: flex;
          align-items: center;
          gap: 20px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.1);
          transition: all 0.5s ease;
        }

        .title-card.animate {
          animation: slideIn 0.5s ease;
        }

        @keyframes slideIn {
          0% {
            transform: translateX(-20px);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .icon-wrapper {
          position: relative;
          width: 50px;
          height: 50px;
        }

        .disc-icon {
          position: absolute;
          width: 50px;
          height: 50px;
          color: var(--text-color);
          animation: spin 3s linear infinite;
          opacity: 0.3;
        }

        .music-icon {
          position: absolute;
          width: 30px;
          height: 30px;
          top: 10px;
          left: 10px;
          color: var(--text-color);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .song-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .song-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-color);
          line-height: 1.2;
        }

        .song-artist {
          font-size: 18px;
          font-weight: 500;
          color: var(--text-color);
          opacity: 0.8;
        }

        .song-album {
          font-size: 14px;
          color: var(--text-color);
          opacity: 0.6;
          margin-top: 2px;
        }

        /* 미니멀 스타일 */
        [data-style="minimal"] .title-card {
          background: rgba(0,0,0,0.8);
          border-radius: 12px;
          padding: 15px 20px;
          box-shadow: none;
          border: none;
        }

        [data-style="minimal"] .icon-wrapper {
          display: none;
        }

        [data-style="minimal"] .song-title {
          font-size: 20px;
        }

        [data-style="minimal"] .song-artist {
          font-size: 16px;
        }

        /* 글래스 스타일 */
        [data-style="glass"] .title-card {
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.2);
        }

        /* 네온 스타일 */
        [data-style="neon"] .title-card {
          background: rgba(0,0,0,0.9);
          border: 2px solid var(--text-color);
          box-shadow: 
            0 0 20px rgba(255,255,255,0.5),
            inset 0 0 20px rgba(255,255,255,0.1);
        }

        [data-style="neon"] .song-title {
          text-shadow: 0 0 10px currentColor;
        }

        /* 컴팩트 스타일 */
        [data-style="compact"] .title-card {
          background: transparent;
          padding: 0;
          box-shadow: none;
          border: none;
          backdrop-filter: none;
        }

        [data-style="compact"] .icon-wrapper {
          display: none;
        }

        [data-style="compact"] .song-title {
          font-size: 20px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        }

        [data-style="compact"] .song-artist {
          font-size: 16px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        }

        /* 바 스타일 */
        [data-style="bar"] .title-container {
          padding: 0;
          align-items: stretch;
        }

        [data-style="bar"] .title-card {
          width: 100%;
          border-radius: 0;
          padding: 15px 30px;
          background: linear-gradient(90deg, rgba(0,0,0,0.9), rgba(0,0,0,0.7), transparent);
        }

        [data-style="bar"] .song-info {
          flex-direction: row;
          align-items: center;
          gap: 15px;
        }

        [data-style="bar"] .song-title::after {
          content: " • ";
          margin: 0 10px;
          opacity: 0.5;
        }

        [data-style="bar"] .song-album {
          margin-top: 0;
        }
      `}</style>
    </div>
  );
}