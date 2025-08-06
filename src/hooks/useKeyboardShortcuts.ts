'use client';

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcutsOptions {
  onPlayPause?: () => void;
  onReset?: () => void;
  onSkipForward?: () => void;
  onSkipBackward?: () => void;
  onStop?: () => void;
  onSpeedUp?: () => void;
  onSpeedDown?: () => void;
  onToggleTranslation?: () => void;
  onNextLine?: () => void;
  onPrevLine?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions) {
  const {
    onPlayPause,
    onReset,
    onSkipForward,
    onSkipBackward,
    onStop,
    onSpeedUp,
    onSpeedDown,
    onToggleTranslation,
    onNextLine,
    onPrevLine,
    enabled = true,
  } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if input is focused
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Prevent default for handled keys
    const preventDefault = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    switch (event.key) {
      case ' ': // Space - Play/Pause
        preventDefault();
        onPlayPause?.();
        break;
        
      case 'r': // R - Reset
      case 'R':
        preventDefault();
        onReset?.();
        break;
        
      case 'ArrowRight': // Right arrow - Skip forward 5s
        preventDefault();
        if (event.shiftKey) {
          // Shift + Right - Next line
          onNextLine?.();
        } else {
          onSkipForward?.();
        }
        break;
        
      case 'ArrowLeft': // Left arrow - Skip backward 5s
        preventDefault();
        if (event.shiftKey) {
          // Shift + Left - Previous line
          onPrevLine?.();
        } else {
          onSkipBackward?.();
        }
        break;
        
      case 'Escape': // ESC - Stop
        preventDefault();
        onStop?.();
        break;
        
      case 'ArrowUp': // Up arrow - Speed up
        preventDefault();
        onSpeedUp?.();
        break;
        
      case 'ArrowDown': // Down arrow - Speed down
        preventDefault();
        onSpeedDown?.();
        break;
        
      case 't': // T - Toggle translation
      case 'T':
        preventDefault();
        onToggleTranslation?.();
        break;
    }
  }, [
    onPlayPause,
    onReset,
    onSkipForward,
    onSkipBackward,
    onStop,
    onSpeedUp,
    onSpeedDown,
    onToggleTranslation,
    onNextLine,
    onPrevLine,
  ]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

// Keyboard shortcuts configuration
export const keyboardShortcuts = [
  { key: 'Space', description: '재생/일시정지' },
  { key: 'R', description: '리셋' },
  { key: '←', description: '5초 뒤로' },
  { key: '→', description: '5초 앞으로' },
  { key: '↑', description: '속도 증가' },
  { key: '↓', description: '속도 감소' },
  { key: 'ESC', description: '정지' },
  { key: 'T', description: '번역 토글' },
  { key: 'Shift+←', description: '이전 라인' },
  { key: 'Shift+→', description: '다음 라인' },
];