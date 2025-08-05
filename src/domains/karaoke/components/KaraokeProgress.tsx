'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface KaraokeProgressProps {
  currentTime: number;
  totalDuration: number;
  className?: string;
  height?: number;
  color?: string;
  backgroundColor?: string;
}

export function KaraokeProgress({
  currentTime,
  totalDuration,
  className,
  height = 4,
  color = '#FFD700',
  backgroundColor = 'rgba(255, 255, 255, 0.2)',
}: KaraokeProgressProps) {
  const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
  const percentage = Math.max(0, Math.min(100, progress * 100));
  
  // Format time display
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className={cn('karaoke-progress', className)}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-mono">
          {formatTime(currentTime)}
        </span>
        <div 
          className="flex-1 relative rounded-full overflow-hidden"
          style={{ 
            height: `${height}px`,
            backgroundColor,
          }}
        >
          <motion.div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{ 
              backgroundColor: color,
              boxShadow: `0 0 10px ${color}`,
            }}
            initial={{ width: '0%' }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.3, ease: 'linear' }}
          />
        </div>
        <span className="text-sm font-mono">
          {formatTime(totalDuration)}
        </span>
      </div>
    </div>
  );
}