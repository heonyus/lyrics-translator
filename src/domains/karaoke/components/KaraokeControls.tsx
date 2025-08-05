'use client';

import React from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw,
  Plus,
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface KaraokeControlsProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onReset: () => void;
  currentTime: number;
  totalDuration: number;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  offset: number;
  onOffsetChange: (offset: number) => void;
  className?: string;
}

export function KaraokeControls({
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  onReset,
  currentTime,
  totalDuration,
  playbackRate,
  onPlaybackRateChange,
  offset,
  onOffsetChange,
  className,
}: KaraokeControlsProps) {
  // Handle seek slider change
  const handleSeekChange = (value: number[]) => {
    onSeek(value[0]);
  };
  
  // Handle playback rate change
  const handlePlaybackRateChange = (value: number[]) => {
    onPlaybackRateChange(value[0]);
  };
  
  // Adjust offset
  const adjustOffset = (delta: number) => {
    onOffsetChange(offset + delta);
  };
  
  return (
    <div className={cn('karaoke-controls', 'space-y-4', className)}>
      {/* Main controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onSeek(Math.max(0, currentTime - 5000))}
          title="Rewind 5s"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button
          variant="default"
          size="icon"
          onClick={isPlaying ? onPause : onPlay}
          className="h-12 w-12"
        >
          {isPlaying ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6" />
          )}
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => onSeek(Math.min(totalDuration, currentTime + 5000))}
          title="Forward 5s"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={onReset}
          title="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Seek slider */}
      <div className="space-y-2">
        <label className="text-sm font-medium">위치</label>
        <Slider
          value={[currentTime]}
          onValueChange={handleSeekChange}
          max={totalDuration}
          step={100}
          className="w-full"
        />
      </div>
      
      {/* Playback rate */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          속도: {playbackRate.toFixed(2)}x
        </label>
        <Slider
          value={[playbackRate]}
          onValueChange={handlePlaybackRateChange}
          min={0.5}
          max={2}
          step={0.1}
          className="w-full"
        />
      </div>
      
      {/* Timing offset */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          오프셋: {offset > 0 ? '+' : ''}{offset}ms
        </label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => adjustOffset(-100)}
          >
            <Minus className="h-4 w-4 mr-1" />
            100ms
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => adjustOffset(-10)}
          >
            <Minus className="h-4 w-4 mr-1" />
            10ms
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOffsetChange(0)}
          >
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => adjustOffset(10)}
          >
            <Plus className="h-4 w-4 mr-1" />
            10ms
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => adjustOffset(100)}
          >
            <Plus className="h-4 w-4 mr-1" />
            100ms
          </Button>
        </div>
      </div>
    </div>
  );
}