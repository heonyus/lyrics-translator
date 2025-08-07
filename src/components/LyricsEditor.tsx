'use client';

import React, { useState, useCallback, useEffect } from 'react';

// Define types locally since domains is removed
interface LyricLine {
  index: number;
  timestamp: number;
  text: string;
  duration?: number;
  wordTimings?: Array<{ word: string; start: number; end: number }>;
}

interface ParsedLRC {
  metadata?: Record<string, string>;
  lines: LyricLine[];
  totalDuration?: number;
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Save,
  Edit2,
  Check,
  X,
  Clock,
  Music
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LyricsEditorProps {
  lyrics: ParsedLRC | null;
  currentLineIndex: number;
  currentTime: number;
  isPlaying: boolean;
  onUpdateLine?: (lineIndex: number, updates: Partial<LyricLine>) => void;
  onSave?: (lyrics: ParsedLRC) => void;
  onSeek?: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
}

export function LyricsEditor({
  lyrics,
  currentLineIndex,
  currentTime,
  isPlaying,
  onUpdateLine,
  onSave,
  onSeek,
  onPlay,
  onPause,
}: LyricsEditorProps) {
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editedLyrics, setEditedLyrics] = useState<ParsedLRC | null>(null);
  const [tempLineData, setTempLineData] = useState<{
    text: string;
    timestamp: number;
    duration: number;
  } | null>(null);

  useEffect(() => {
    setEditedLyrics(lyrics);
  }, [lyrics]);

  const handleEditLine = useCallback((lineIndex: number) => {
    if (!editedLyrics) return;
    
    const line = editedLyrics.lines[lineIndex];
    setEditingLineIndex(lineIndex);
    setTempLineData({
      text: line.text,
      timestamp: line.startTime,
      duration: line.endTime - line.startTime,
    });
  }, [editedLyrics]);

  const handleSaveLineEdit = useCallback(() => {
    if (editingLineIndex === null || !tempLineData || !editedLyrics) return;

    const updatedLines = [...editedLyrics.lines];
    updatedLines[editingLineIndex] = {
      ...updatedLines[editingLineIndex],
      text: tempLineData.text,
      startTime: tempLineData.timestamp,
      endTime: tempLineData.timestamp + tempLineData.duration,
    };

    const updatedLyrics = {
      ...editedLyrics,
      lines: updatedLines,
    };

    setEditedLyrics(updatedLyrics);
    onUpdateLine?.(editingLineIndex, {
      text: tempLineData.text,
      startTime: tempLineData.timestamp,
      endTime: tempLineData.timestamp + tempLineData.duration,
    } as Partial<LyricLine>);

    setEditingLineIndex(null);
    setTempLineData(null);
  }, [editingLineIndex, tempLineData, editedLyrics, onUpdateLine]);

  const handleCancelEdit = useCallback(() => {
    setEditingLineIndex(null);
    setTempLineData(null);
  }, []);

  const handleTimestampChange = useCallback((value: number[]) => {
    if (!tempLineData) return;
    setTempLineData({
      ...tempLineData,
      timestamp: value[0],
    });
  }, [tempLineData]);

  const handleDurationChange = useCallback((value: number[]) => {
    if (!tempLineData) return;
    setTempLineData({
      ...tempLineData,
      duration: value[0],
    });
  }, [tempLineData]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!tempLineData) return;
    setTempLineData({
      ...tempLineData,
      text: e.target.value,
    });
  }, [tempLineData]);

  const handleSaveAll = useCallback(() => {
    if (editedLyrics && onSave) {
      onSave(editedLyrics);
    }
  }, [editedLyrics, onSave]);

  const formatTime = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  }, []);

  const handleJumpToLine = useCallback((lineIndex: number) => {
    if (!editedLyrics || !onSeek) return;
    const line = editedLyrics.lines[lineIndex];
    onSeek(line.startTime);
  }, [editedLyrics, onSeek]);

  if (!editedLyrics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">가사를 먼저 불러와주세요</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit2 className="w-5 h-5" />
            가사 편집기
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={isPlaying ? onPause : onPlay}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAll}
              className="flex items-center gap-1"
            >
              <Save className="w-4 h-4" />
              전체 저장
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {editedLyrics.lines.map((line, index) => {
            const isCurrentLine = index === currentLineIndex;
            const isEditing = index === editingLineIndex;

            return (
              <div
                key={`${line.id}-${index}`}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  isCurrentLine && "bg-primary/10 border-primary",
                  !isCurrentLine && "hover:bg-muted/50",
                  isEditing && "bg-accent/20 border-accent"
                )}
              >
                {isEditing && tempLineData ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor={`text-${index}`}>가사 텍스트</Label>
                      <Input
                        id={`text-${index}`}
                        value={tempLineData.text}
                        onChange={handleTextChange}
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`timestamp-${index}`}>
                        시작 시간: {formatTime(tempLineData.timestamp)}
                      </Label>
                      <Slider
                        id={`timestamp-${index}`}
                        value={[tempLineData.timestamp]}
                        onValueChange={handleTimestampChange}
                        max={editedLyrics.totalDuration || 300000}
                        step={10}
                        className="mt-2"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`duration-${index}`}>
                        지속 시간: {formatTime(tempLineData.duration)}
                      </Label>
                      <Slider
                        id={`duration-${index}`}
                        value={[tempLineData.duration]}
                        onValueChange={handleDurationChange}
                        max={10000}
                        step={10}
                        className="mt-2"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveLineEdit}
                        className="flex items-center gap-1"
                      >
                        <Check className="w-4 h-4" />
                        저장
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        className="flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs text-muted-foreground font-mono">
                          [{formatTime(line.startTime)}]
                        </span>
                        {isCurrentLine && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                            현재 재생 중
                          </span>
                        )}
                      </div>
                      <p className={cn(
                        "text-sm",
                        isCurrentLine && "font-semibold text-primary"
                      )}>
                        {line.text}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleJumpToLine(index)}
                        title="이 위치로 이동"
                      >
                        <Music className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditLine(index)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 타임라인 미리보기 */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">타임라인</span>
            <span className="text-sm text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(editedLyrics.totalDuration || 0)}
            </span>
          </div>
          <div className="relative h-8 bg-background rounded overflow-hidden">
            {editedLyrics.lines.map((line, index) => {
              const startPercent = (line.startTime / (editedLyrics.totalDuration || 1)) * 100;
              const widthPercent = ((line.endTime - line.startTime) / (editedLyrics.totalDuration || 1)) * 100;
              
              return (
                <div
                  key={`timeline-${index}`}
                  className={cn(
                    "absolute h-full transition-all cursor-pointer",
                    index === currentLineIndex ? "bg-primary" : "bg-primary/30 hover:bg-primary/50"
                  )}
                  style={{
                    left: `${startPercent}%`,
                    width: `${widthPercent}%`,
                  }}
                  onClick={() => handleJumpToLine(index)}
                  title={`Line ${index + 1}: ${line.text.substring(0, 30)}...`}
                />
              );
            })}
            
            {/* 현재 재생 위치 표시 */}
            <div
              className="absolute top-0 h-full w-0.5 bg-red-500 pointer-events-none"
              style={{
                left: `${(currentTime / (editedLyrics.totalDuration || 1)) * 100}%`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}