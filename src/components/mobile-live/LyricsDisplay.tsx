'use client';

import { useEffect, useState } from 'react';

interface LyricsDisplayProps {
  currentLine: string;
  nextLine?: string;
  translations?: { [lang: string]: string };
  fontSize?: number;
  textColor?: string;
  showNext?: boolean;
  showTranslation?: boolean;
}

export default function LyricsDisplay({
  currentLine,
  nextLine,
  translations = {},
  fontSize = 48,
  textColor = '#FFFFFF',
  showNext = true,
  showTranslation = true
}: LyricsDisplayProps) {
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    // Trigger animation on line change
    setAnimationKey(prev => prev + 1);
  }, [currentLine]);

  return (
    <div 
      className="p-6 transition-all duration-300"
    >
      {/* Current Line with Karaoke Style */}
      <div 
        key={`current-${animationKey}`}
        className="text-right mb-6 font-bold leading-tight"
        style={{
          fontSize: `${fontSize * 0.6}px`,  // 크기를 60%로 줄임
          color: '#FFFFFF',
          textShadow: `
            -2px -2px 0 #000,
            2px -2px 0 #000,
            -2px 2px 0 #000,
            2px 2px 0 #000
          `,
          animation: 'slideInFromBottom 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          letterSpacing: '0.02em'
        }}
      >
        {currentLine || '♪ ♪ ♪'}
      </div>

      {/* Next Line Preview with Glass Effect */}
      {showNext && nextLine && (
        <div 
          className="text-right mb-6 relative"
          style={{
            fontSize: `${fontSize * 0.45}px`,  // 45%로 줄임
            color: '#FFFFFF',
            opacity: 0.7,
            textShadow: `
              -1px -1px 0 #000,
              1px -1px 0 #000,
              -1px 1px 0 #000,
              1px 1px 0 #000
            `,
            animation: 'fadeIn 0.5s ease-out 0.1s both',
            filter: 'blur(0.3px)'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent" />
          {nextLine}
        </div>
      )}

      {/* Translations with Apple Music Style */}
      {showTranslation && Object.keys(translations).length > 0 && (
        <div className="mt-3 space-y-2">
          {Object.entries(translations).map(([lang, text], index) => (
            <div
              key={lang}
              className="text-right"
              style={{
                fontSize: `${fontSize * 0.4}px`,  // 40%로 줄임
                color: '#FFFFFF',
                opacity: 0.9,
                fontWeight: 'bold',  // 번역 텍스트 굵게
                textShadow: `
                  -1px -1px 0 #000,
                  1px -1px 0 #000,
                  -1px 1px 0 #000,
                  1px 1px 0 #000
                `,
                animation: `fadeIn 0.5s ease-out ${0.2 + index * 0.1}s both`
              }}
            >
              <span 
                className="inline-block px-3 py-1 rounded-full text-xs mr-3 font-medium"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  letterSpacing: '0.05em'
                }}
              >
                {lang.toUpperCase()}
              </span>
              {text}
            </div>
          ))}
        </div>
      )}

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes slideInFromBottom {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          50% {
            transform: translateY(-5px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes glow {
          0%, 100% {
            text-shadow: 
              0 0 60px rgba(255, 200, 100, 0.4),
              0 0 30px rgba(255, 255, 255, 0.3),
              0 0 20px rgba(0, 0, 0, 1),
              0 6px 20px rgba(0, 0, 0, 0.9),
              3px 3px 6px rgba(0, 0, 0, 1);
          }
          50% {
            text-shadow: 
              0 0 80px rgba(255, 200, 100, 0.6),
              0 0 40px rgba(255, 255, 255, 0.4),
              0 0 20px rgba(0, 0, 0, 1),
              0 6px 20px rgba(0, 0, 0, 0.9),
              3px 3px 6px rgba(0, 0, 0, 1);
          }
        }
      `}</style>
    </div>
  );
}