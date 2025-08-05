'use client';

import React, { useState } from 'react';
import { useLRCFetcher } from '@/domains/lrc-fetcher';
import { useLyrics } from '@/domains/lyrics';
import { KaraokeDisplayWithTranslation, KaraokeProgress, KaraokeControls } from '@/domains/karaoke';
import { SupportedLanguage, supportedLanguages, languageInfo } from '@/domains/translation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Music, Languages } from 'lucide-react';

export default function DemoPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [targetLanguage, setTargetLanguage] = useState<SupportedLanguage>('en');
  
  const {
    isSearching,
    isFetching,
    searchResults,
    selectedResult,
    fetchedLRC,
    error,
    search,
    selectResult,
    fetchLRC,
    autoFetch,
  } = useLRCFetcher();
  
  const {
    lyrics,
    playbackState,
    currentLine,
    currentWord,
    loadLRC,
    play,
    pause,
    seek,
    setOffset,
    setPlaybackRate,
    reset,
  } = useLyrics();
  
  // Handle search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      await search(searchQuery);
    }
  };
  
  // Handle fetch and load
  const handleFetchAndLoad = async () => {
    if (selectedResult) {
      await fetchLRC(selectedResult);
    }
  };
  
  // Load fetched LRC into player
  React.useEffect(() => {
    if (fetchedLRC) {
      loadLRC(fetchedLRC);
    }
  }, [fetchedLRC, loadLRC]);
  
  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6 text-center">
        가사 번역기 데모
      </h1>
      
      {/* Search Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>가사 검색</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              type="text"
              placeholder="노래 제목, 아티스트, YouTube/Spotify URL 입력"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
              className="flex-1"
            />
            <Button type="submit" disabled={isSearching}>
              <Search className="h-4 w-4 mr-2" />
              {isSearching ? '검색 중...' : '검색'}
            </Button>
          </form>
          
          {error && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
              {error.message}
            </div>
          )}
          
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="font-semibold">검색 결과:</h3>
              {searchResults.map((result) => (
                <div
                  key={`${result.provider}-${result.id}`}
                  className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                    selectedResult?.id === result.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => selectResult(result)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{result.title}</div>
                      <div className="text-sm text-gray-600">{result.artist}</div>
                      {result.album && (
                        <div className="text-sm text-gray-500">{result.album}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{result.provider}</div>
                      <div className="text-sm text-gray-600">
                        {(result.finalScore * 100).toFixed(0)}% 일치
                      </div>
                      {result.hasSyncedLyrics && (
                        <div className="text-xs text-green-600">싱크 있음</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {selectedResult && (
                <Button
                  onClick={handleFetchAndLoad}
                  disabled={isFetching}
                  className="w-full"
                >
                  {isFetching ? '가져오는 중...' : '가사 가져오기'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Translation Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            번역 설정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">번역할 언어:</label>
            <Select
              value={targetLanguage}
              onValueChange={(value) => setTargetLanguage(value as SupportedLanguage)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedLanguages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {languageInfo[lang].name} ({languageInfo[lang].nativeName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Karaoke Display */}
      {lyrics && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                {lyrics.metadata.title || '제목 없음'} - {lyrics.metadata.artist || '알 수 없는 아티스트'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <KaraokeProgress
                currentTime={playbackState.currentTime}
                totalDuration={lyrics.totalDuration}
                className="mb-6"
              />
              
              <KaraokeDisplayWithTranslation
                lyrics={lyrics}
                currentLine={currentLine}
                currentWord={currentWord}
                currentTime={playbackState.currentTime}
                targetLanguages={[targetLanguage]}
                className="min-h-[200px] mb-6"
                fontSize={28}
                highlightColor="#3B82F6"
                animationType="glow"
              />
              
              <KaraokeControls
                isPlaying={playbackState.isPlaying}
                onPlay={play}
                onPause={pause}
                onSeek={seek}
                onReset={reset}
                currentTime={playbackState.currentTime}
                totalDuration={lyrics.totalDuration}
                playbackRate={playbackState.playbackRate}
                onPlaybackRateChange={setPlaybackRate}
                offset={0}
                onOffsetChange={setOffset}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}