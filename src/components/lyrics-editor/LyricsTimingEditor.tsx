'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ParsedLRC, LyricLine } from '@/domains/lyrics/types/lyrics.types';
import { GlassmorphicCard, NeonButton } from '@/components/design-system';
import { Clock, Plus, Minus, Save, Undo, Play, Pause } from 'lucide-react';

interface LyricsTimingEditorProps {
  lyrics: ParsedLRC;
  onSave: (lyrics: ParsedLRC) => void;
  onCancel?: () => void;
  currentTime?: number;
  isPlaying?: boolean;
}

export function LyricsTimingEditor({
  lyrics: initialLyrics,
  onSave,
  onCancel,
  currentTime = 0,
  isPlaying = false
}: LyricsTimingEditorProps) {
  const [editedLyrics, setEditedLyrics] = useState<ParsedLRC>(initialLyrics);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [globalOffset, setGlobalOffset] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);

  // Format time for display
  const formatTime = (timeMs: number) => {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((timeMs % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  // Parse formatted time back to milliseconds
  const parseTime = (timeStr: string): number => {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\.(\d{2})$/);
    if (!match) return 0;
    
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const centiseconds = parseInt(match[3], 10);
    
    return (minutes * 60 + seconds) * 1000 + centiseconds * 10;
  };

  // Adjust timing for a single line
  const adjustLineTiming = useCallback((index: number, offsetMs: number) => {
    setEditedLyrics(prev => {
      const newLyrics = { ...prev };
      const newLines = [...newLyrics.lines];
      const line = { ...newLines[index] };
      
      line.startTime = Math.max(0, line.startTime + offsetMs);
      line.endTime = Math.max(line.startTime + 100, line.endTime + offsetMs);
      
      // Adjust word timings if present
      if (line.words && line.words.length > 0) {
        line.words = line.words.map(word => ({
          ...word,
          startTime: Math.max(0, word.startTime + offsetMs),
          endTime: Math.max(word.startTime + 10, word.endTime + offsetMs)
        }));
      }
      
      newLines[index] = line;
      newLyrics.lines = newLines;
      
      return newLyrics;
    });
    setHasChanges(true);
  }, []);

  // Apply global offset to all lines
  const applyGlobalOffset = useCallback(() => {
    if (globalOffset === 0) return;
    
    setEditedLyrics(prev => {
      const newLyrics = { ...prev };
      newLyrics.lines = newLyrics.lines.map(line => {
        const newLine = { ...line };
        newLine.startTime = Math.max(0, newLine.startTime + globalOffset);
        newLine.endTime = Math.max(newLine.startTime + 100, newLine.endTime + globalOffset);
        
        // Adjust word timings if present
        if (newLine.words && newLine.words.length > 0) {
          newLine.words = newLine.words.map(word => ({
            ...word,
            startTime: Math.max(0, word.startTime + globalOffset),
            endTime: Math.max(word.startTime + 10, word.endTime + globalOffset)
          }));
        }
        
        return newLine;
      });
      
      return newLyrics;
    });
    
    setGlobalOffset(0);
    setHasChanges(true);
  }, [globalOffset]);

  // Set line timing to current playback time
  const setLineToCurrentTime = useCallback((index: number) => {
    if (currentTime === undefined) return;
    
    setEditedLyrics(prev => {
      const newLyrics = { ...prev };
      const newLines = [...newLyrics.lines];
      const line = { ...newLines[index] };
      const duration = line.endTime - line.startTime;
      
      line.startTime = currentTime;
      line.endTime = currentTime + duration;
      
      // Adjust word timings proportionally
      if (line.words && line.words.length > 0) {
        const oldDuration = newLines[index].endTime - newLines[index].startTime;
        line.words = line.words.map(word => {
          const wordOffset = word.startTime - newLines[index].startTime;
          const wordDuration = word.endTime - word.startTime;
          return {
            ...word,
            startTime: currentTime + wordOffset,
            endTime: currentTime + wordOffset + wordDuration
          };
        });
      }
      
      newLines[index] = line;
      newLyrics.lines = newLines;
      
      return newLyrics;
    });
    setHasChanges(true);
  }, [currentTime]);

  // Reset all changes
  const resetChanges = useCallback(() => {
    setEditedLyrics(initialLyrics);
    setGlobalOffset(0);
    setHasChanges(false);
  }, [initialLyrics]);

  // Save changes
  const handleSave = useCallback(() => {
    onSave(editedLyrics);
    setHasChanges(false);
  }, [editedLyrics, onSave]);

  // Highlight current line based on playback
  useEffect(() => {
    if (!isPlaying || currentTime === undefined) return;
    
    const currentLineIndex = editedLyrics.lines.findIndex(
      line => line.startTime <= currentTime && currentTime < line.endTime
    );
    
    if (currentLineIndex >= 0) {
      setSelectedLineIndex(currentLineIndex);
    }
  }, [currentTime, editedLyrics.lines, isPlaying]);

  return (
    <div className="space-y-4">
      {/* Global Controls */}
      <GlassmorphicCard variant="dark" blur="md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-neon-cyan">가사 타이밍 편집</h2>
          <div className="flex gap-2">
            {hasChanges && (
              <>
                <NeonButton onClick={resetChanges} variant="outline" color="orange" size="sm">
                  <Undo className="w-4 h-4 mr-1" />
                  초기화
                </NeonButton>
                <NeonButton onClick={handleSave} color="green" size="sm">
                  <Save className="w-4 h-4 mr-1" />
                  저장
                </NeonButton>
              </>
            )}
            {onCancel && (
              <NeonButton onClick={onCancel} variant="outline" color="red" size="sm">
                취소
              </NeonButton>
            )}
          </div>
        </div>

        {/* Global Offset Control */}
        <div className="mb-4 p-3 bg-black/30 rounded-lg">
          <label className="text-sm text-gray-400 block mb-2">전체 오프셋 (ms)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={globalOffset}
              onChange={(e) => setGlobalOffset(parseInt(e.target.value) || 0)}
              className="flex-1 px-3 py-1 bg-black/50 border border-neon-cyan/30 rounded text-white text-sm"
              step="100"
            />
            <NeonButton 
              onClick={() => setGlobalOffset(prev => prev - 100)} 
              variant="outline" 
              color="cyan" 
              size="sm"
            >
              -100ms
            </NeonButton>
            <NeonButton 
              onClick={() => setGlobalOffset(prev => prev + 100)} 
              variant="outline" 
              color="cyan" 
              size="sm"
            >
              +100ms
            </NeonButton>
            <NeonButton 
              onClick={applyGlobalOffset} 
              color="cyan" 
              size="sm"
              disabled={globalOffset === 0}
            >
              적용
            </NeonButton>
          </div>
        </div>

        {/* Playback Status */}
        {currentTime !== undefined && (
          <div className="mb-2 p-2 bg-black/20 rounded flex items-center gap-2">
            {isPlaying ? (
              <Play className="w-4 h-4 text-neon-green" />
            ) : (
              <Pause className="w-4 h-4 text-neon-orange" />
            )}
            <span className="text-sm text-gray-400">
              현재 시간: <span className="text-white font-mono">{formatTime(currentTime)}</span>
            </span>
          </div>
        )}
      </GlassmorphicCard>

      {/* Lines Editor */}
      <GlassmorphicCard variant="dark" blur="md">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-black/80 backdrop-blur">
              <tr className="text-left text-xs text-gray-400 border-b border-gray-700">
                <th className="p-2">#</th>
                <th className="p-2">시작</th>
                <th className="p-2">종료</th>
                <th className="p-2">가사</th>
                <th className="p-2 text-center">조정</th>
              </tr>
            </thead>
            <tbody>
              {editedLyrics.lines.map((line, index) => (
                <tr
                  key={index}
                  className={`border-b border-gray-800 hover:bg-black/30 cursor-pointer transition-colors ${
                    selectedLineIndex === index ? 'bg-neon-blue/10' : ''
                  }`}
                  onClick={() => setSelectedLineIndex(index)}
                >
                  <td className="p-2 text-xs text-gray-500">{index + 1}</td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={formatTime(line.startTime)}
                      onChange={(e) => {
                        const newTime = parseTime(e.target.value);
                        const offset = newTime - line.startTime;
                        adjustLineTiming(index, offset);
                      }}
                      className="w-20 px-2 py-1 bg-black/50 border border-gray-700 rounded text-xs font-mono text-white"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={formatTime(line.endTime)}
                      onChange={(e) => {
                        const newTime = parseTime(e.target.value);
                        setEditedLyrics(prev => {
                          const newLyrics = { ...prev };
                          const newLines = [...newLyrics.lines];
                          newLines[index] = {
                            ...newLines[index],
                            endTime: Math.max(newLines[index].startTime + 100, newTime)
                          };
                          newLyrics.lines = newLines;
                          return newLyrics;
                        });
                        setHasChanges(true);
                      }}
                      className="w-20 px-2 py-1 bg-black/50 border border-gray-700 rounded text-xs font-mono text-white"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="p-2 text-sm text-gray-300">
                    {line.text}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustLineTiming(index, -100);
                        }}
                        className="p-1 hover:bg-neon-red/20 rounded transition-colors"
                        title="-100ms"
                      >
                        <Minus className="w-3 h-3 text-neon-red" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLineToCurrentTime(index);
                        }}
                        className="p-1 hover:bg-neon-cyan/20 rounded transition-colors"
                        title="현재 시간으로 설정"
                        disabled={currentTime === undefined}
                      >
                        <Clock className="w-3 h-3 text-neon-cyan" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustLineTiming(index, 100);
                        }}
                        className="p-1 hover:bg-neon-green/20 rounded transition-colors"
                        title="+100ms"
                      >
                        <Plus className="w-3 h-3 text-neon-green" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassmorphicCard>
    </div>
  );
}