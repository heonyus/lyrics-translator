'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Music, 
  Clock, 
  Globe, 
  CheckCircle2, 
  XCircle,
  Sparkles,
  Database,
  Globe2,
  FileText,
  Timer
} from 'lucide-react';

interface LyricsResult {
  lyrics: string;
  syncedLyrics?: string;
  source: string;
  confidence?: number;
  finalScore?: number;
  validation?: {
    isValid: boolean;
    confidence: number;
    issues: string[];
  };
  title?: string;
  artist?: string;
  searchTime?: number;
  url?: string;
  language?: string;
  hasTimestamps?: boolean;
  priority?: number;
}

interface LyricsResultSelectorProps {
  results: LyricsResult[];
  onSelect: (result: LyricsResult) => void;
  onCancel?: () => void;
}

export default function LyricsResultSelector({ 
  results, 
  onSelect, 
  onCancel 
}: LyricsResultSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<'plain' | 'synced'>('plain');
  
  // Sort results by quality
  const sortedResults = [...results].sort((a, b) => {
    // Use finalScore if available
    if (a.finalScore !== undefined && b.finalScore !== undefined) {
      return b.finalScore - a.finalScore;
    }
    
    // Prioritize synced lyrics
    if (a.syncedLyrics && !b.syncedLyrics) return -1;
    if (!a.syncedLyrics && b.syncedLyrics) return 1;
    
    // Then by validation confidence
    if (a.validation && b.validation) {
      const confDiff = b.validation.confidence - a.validation.confidence;
      if (Math.abs(confDiff) > 0.1) return confDiff;
    }
    
    // Then by priority
    if (a.priority !== undefined && b.priority !== undefined) {
      return b.priority - a.priority;
    }
    
    // Then by confidence
    const aConf = a.confidence ?? a.validation?.confidence ?? 0;
    const bConf = b.confidence ?? b.validation?.confidence ?? 0;
    const confDiff = bConf - aConf;
    if (Math.abs(confDiff) > 0.1) return confDiff;
    
    // Then by length
    return b.lyrics.length - a.lyrics.length;
  });
  
  const selectedResult = sortedResults[selectedIndex];
  
  // Get source icon
  const getSourceIcon = (source: string) => {
    if (source.toLowerCase().includes('lrclib')) return <Timer className="w-4 h-4" />;
    if (source.toLowerCase().includes('database')) return <Database className="w-4 h-4" />;
    if (source.toLowerCase().includes('korean')) return <Globe className="w-4 h-4" />;
    if (source.toLowerCase().includes('scraper')) return <Globe2 className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };
  
  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-500';
    if (confidence >= 0.7) return 'text-yellow-500';
    return 'text-red-500';
  };
  
  // Get language badge
  const getLanguageBadge = (language?: string) => {
    const langMap: { [key: string]: string } = {
      'ko': '🇰🇷 한국어',
      'ja': '🇯🇵 日本語',
      'en': '🇺🇸 English',
      'zh': '🇨🇳 中文'
    };
    return langMap[language || ''] || '🌍 Unknown';
  };
  
  // Preview lyrics (first 10 lines)
  const getPreview = (lyrics: string, lines: number = 10) => {
    const lyricsLines = lyrics.split('\n').filter(l => l.trim());
    return lyricsLines.slice(0, lines).join('\n') + 
           (lyricsLines.length > lines ? '\n...' : '');
  };
  
  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <Card className="bg-gray-900/95 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            Select Best Lyrics Result
          </CardTitle>
          <p className="text-sm text-gray-400 mt-2">
            Found {results.length} result{results.length > 1 ? 's' : ''}. 
            Select the best match for your needs.
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Results List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 space-y-2">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Available Sources</h3>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {sortedResults.map((result, index) => (
                    <Card
                      key={index}
                      className={`cursor-pointer transition-all ${
                        selectedIndex === index 
                          ? 'bg-blue-900/30 border-blue-500' 
                          : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800/70'
                      }`}
                      onClick={() => setSelectedIndex(index)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getSourceIcon(result.source)}
                            <div>
                              <p className="font-medium text-sm">{result.source}</p>
                              {(result.artist || result.title) && (
                                <p className="text-xs text-gray-400">
                                  {result.artist} - {result.title}
                                </p>
                              )}
                            </div>
                          </div>
                          {index === 0 && (
                            <Badge variant="default" className="bg-green-600">
                              Best
                            </Badge>
                          )}
                        </div>
                        
                        <div className="mt-2 space-y-1">
                          {/* Confidence */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Confidence</span>
                            <span className={getConfidenceColor(result.confidence ?? result.validation?.confidence ?? 0)}>
                              {((result.confidence ?? result.validation?.confidence ?? 0) * 100).toFixed(0)}%
                            </span>
                          </div>
                          
                          {/* Validation Issues */}
                          {result.validation && result.validation.issues.length > 0 && (
                            <div className="text-xs text-yellow-500">
                              ⚠️ {result.validation.issues[0]}
                            </div>
                          )}
                          
                          {/* Features */}
                          <div className="flex gap-1 flex-wrap">
                            {result.syncedLyrics && (
                              <Badge variant="outline" className="text-xs py-0">
                                <Clock className="w-3 h-3 mr-1" />
                                Synced
                              </Badge>
                            )}
                            {result.language && (
                              <Badge variant="outline" className="text-xs py-0">
                                {getLanguageBadge(result.language)}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Stats */}
                          <div className="text-xs text-gray-500">
                            {result.lyrics.length} chars
                            {result.searchTime && ` • ${result.searchTime.toFixed(1)}s`}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
            
            {/* Preview Panel */}
            <div className="lg:col-span-2">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Preview</h3>
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getSourceIcon(selectedResult.source)}
                      <div>
                        <p className="font-medium">{selectedResult.source}</p>
                        {(selectedResult.artist || selectedResult.title) && (
                          <p className="text-sm text-gray-400">
                            {selectedResult.artist} - {selectedResult.title}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {selectedResult.syncedLyrics && (
                      <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as 'plain' | 'synced')}>
                        <TabsList className="h-8">
                          <TabsTrigger value="plain" className="text-xs">Plain</TabsTrigger>
                          <TabsTrigger value="synced" className="text-xs">Synced</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent>
                  <ScrollArea className="h-[300px] w-full">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                      {previewMode === 'synced' && selectedResult.syncedLyrics
                        ? getPreview(selectedResult.syncedLyrics, 20)
                        : getPreview(selectedResult.lyrics, 20)}
                    </pre>
                  </ScrollArea>
                  
                  {/* Metadata */}
                  <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">Language:</span>
                      <span className="ml-2">{getLanguageBadge(selectedResult.language)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Confidence:</span>
                      <span className={`ml-2 ${getConfidenceColor(selectedResult.confidence ?? selectedResult.validation?.confidence ?? 0)}`}>
                        {((selectedResult.confidence ?? selectedResult.validation?.confidence ?? 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Length:</span>
                      <span className="ml-2">{selectedResult.lyrics.length} characters</span>
                    </div>
                    {selectedResult.searchTime && (
                      <div>
                        <span className="text-gray-400">Search Time:</span>
                        <span className="ml-2">{selectedResult.searchTime.toFixed(2)}s</span>
                      </div>
                    )}
                    {selectedResult.syncedLyrics && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Features:</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Synchronized Lyrics Available
                        </Badge>
                      </div>
                    )}
                    {selectedResult.url && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Source URL:</span>
                        <a 
                          href={selectedResult.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-400 hover:underline truncate inline-block max-w-[300px]"
                        >
                          {selectedResult.url}
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-800">
            {onCancel && (
              <Button 
                variant="outline" 
                onClick={onCancel}
                className="gap-2"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </Button>
            )}
            <Button 
              onClick={() => onSelect(selectedResult)}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle2 className="w-4 h-4" />
              Use This Result
              {selectedIndex === 0 && ' (Recommended)'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}