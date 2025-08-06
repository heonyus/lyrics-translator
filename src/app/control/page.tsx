'use client';

import React, { useState, useEffect } from 'react';
import { useLRCFetcher } from '@/domains/lrc-fetcher';
import { useLyrics } from '@/domains/lyrics';
import { SupportedLanguage, supportedLanguages, languageInfo } from '@/domains/translation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Search, Copy, ExternalLink, Settings, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { WebSocketControl } from '@/components/websocket/WebSocketControl';
import { LyricsEditor } from '@/components/LyricsEditor';
import { useImprovedLyrics } from '@/domains/lyrics/hooks/useImprovedLyrics';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function ControlPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<SupportedLanguage[]>(['en']);
  const [overlaySettings, setOverlaySettings] = useState({
    fontSize: 32,
    color: '#FFD700',
    animation: 'glow' as 'fade' | 'slide' | 'glow',
    autoPlay: true,
    rate: 1.0,
  });
  
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
  } = useLRCFetcher();
  
  const { 
    lyrics, 
    loadLRC,
    loadParsedLRC,
    playbackState,
    play, 
    pause,
    seek,
    reset,
    togglePlayPause,
    skipForward,
    skipBackward,
    setPlaybackRate,
  } = useImprovedLyrics({
    autoPlay: false,
    targetFPS: 60,
    interpolation: true,
  });
  
  // 키보드 단축키 설정
  useKeyboardShortcuts({
    onPlayPause: togglePlayPause,
    onReset: reset,
    onSkipForward: () => skipForward(5),
    onSkipBackward: () => skipBackward(5),
    onStop: () => {
      pause();
      reset();
    },
    onSpeedUp: () => setPlaybackRate(Math.min(2, playbackState.playbackRate + 0.1)),
    onSpeedDown: () => setPlaybackRate(Math.max(0.5, playbackState.playbackRate - 0.1)),
    enabled: true,
  });
  
  // Generate overlay URL
  const generateOverlayUrl = () => {
    if (!selectedResult) return '';
    
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams({
      q: selectedResult.title + ' ' + selectedResult.artist,
      lang: selectedLanguages[0] || 'en',
      fontSize: overlaySettings.fontSize.toString(),
      color: overlaySettings.color,
      animation: overlaySettings.animation,
      autoPlay: overlaySettings.autoPlay.toString(),
      rate: overlaySettings.rate.toString(),
    });
    
    return `${baseUrl}/overlay?${params.toString()}`;
  };
  
  // Handle search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      await search(searchQuery);
    }
  };
  
  // Copy overlay URL
  const copyOverlayUrl = () => {
    const url = generateOverlayUrl();
    if (url) {
      navigator.clipboard.writeText(url);
      toast.success('오버레이 URL이 클립보드에 복사되었습니다!');
    }
  };
  
  // Open overlay in new tab
  const openOverlay = () => {
    const url = generateOverlayUrl();
    if (url) {
      window.open(url, '_blank');
    }
  };
  
  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">컨트롤 패널</h1>
      
      <Tabs defaultValue="search" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="search">검색 및 선택</TabsTrigger>
          <TabsTrigger value="editor">가사 편집</TabsTrigger>
          <TabsTrigger value="settings">오버레이 설정</TabsTrigger>
          <TabsTrigger value="preview">미리보기 및 내보내기</TabsTrigger>
          <TabsTrigger value="websocket">실시간 동기화</TabsTrigger>
        </TabsList>
        
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>노래 검색</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex gap-2 mb-4">
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
                <div className="p-4 bg-red-100 text-red-700 rounded mb-4">
                  {error.message}
                </div>
              )}
              
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold mb-2">검색 결과:</h3>
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
                      onClick={() => fetchLRC(selectedResult)}
                      disabled={isFetching}
                      className="w-full mt-2"
                    >
                      {isFetching ? '가져오는 중...' : '가사 가져오기 및 불러오기'}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                오버레이 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Translation Languages */}
              <div className="space-y-2">
                <Label>번역 언어 (기본)</Label>
                <Select
                  value={selectedLanguages[0]}
                  onValueChange={(value) => setSelectedLanguages([value as SupportedLanguage])}
                >
                  <SelectTrigger>
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
              
              {/* Font Size */}
              <div className="space-y-2">
                <Label>글자 크기: {overlaySettings.fontSize}px</Label>
                <Slider
                  value={[overlaySettings.fontSize]}
                  onValueChange={(value) => setOverlaySettings(prev => ({ ...prev, fontSize: value[0] }))}
                  min={16}
                  max={64}
                  step={2}
                />
              </div>
              
              {/* Highlight Color */}
              <div className="space-y-2">
                <Label>하이라이트 색상</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={overlaySettings.color}
                    onChange={(e) => setOverlaySettings(prev => ({ ...prev, color: e.target.value }))}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={overlaySettings.color}
                    onChange={(e) => setOverlaySettings(prev => ({ ...prev, color: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>
              
              {/* Animation Type */}
              <div className="space-y-2">
                <Label>애니메이션 타입</Label>
                <Select
                  value={overlaySettings.animation}
                  onValueChange={(value) => setOverlaySettings(prev => ({ 
                    ...prev, 
                    animation: value as 'fade' | 'slide' | 'glow' 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fade">페이드</SelectItem>
                    <SelectItem value="slide">슬라이드</SelectItem>
                    <SelectItem value="glow">글로우</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Auto Play */}
              <div className="flex items-center justify-between">
                <Label htmlFor="autoplay">로드 시 자동 재생</Label>
                <Switch
                  id="autoplay"
                  checked={overlaySettings.autoPlay}
                  onCheckedChange={(checked) => setOverlaySettings(prev => ({ ...prev, autoPlay: checked }))}
                />
              </div>
              
              {/* Playback Rate */}
              <div className="space-y-2">
                <Label>재생 속도: {overlaySettings.rate}x</Label>
                <Slider
                  value={[overlaySettings.rate]}
                  onValueChange={(value) => setOverlaySettings(prev => ({ ...prev, rate: value[0] }))}
                  min={0.5}
                  max={2}
                  step={0.1}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                OBS 브라우저 소스 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedResult ? (
                <>
                  <div className="space-y-2">
                    <Label>선택된 노래</Label>
                    <div className="p-3 bg-gray-100 rounded">
                      <div className="font-medium">{selectedResult.title}</div>
                      <div className="text-sm text-gray-600">{selectedResult.artist}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>오버레이 URL</Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={generateOverlayUrl()}
                        readOnly
                        className="flex-1 font-mono text-sm"
                      />
                      <Button size="icon" onClick={copyOverlayUrl}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="icon" onClick={openOverlay}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded space-y-2">
                    <h4 className="font-semibold">OBS 설정:</h4>
                    <ul className="text-sm space-y-1">
                      <li>• 너비: <strong>1920</strong></li>
                      <li>• 높이: <strong>1080</strong></li>
                      <li>• FPS: <strong>30</strong></li>
                      <li>• CSS: 비워두기 (투명 배경 포함됨)</li>
                      <li>• ✓ 소스가 보이지 않을 때 종료</li>
                      <li>• ✓ 장면이 활성화될 때 브라우저 새로고침</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  먼저 노래를 검색하고 선택해주세요
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="editor" className="space-y-4">
          <LyricsEditor
            lyrics={lyrics}
            currentLineIndex={playbackState.currentLineIndex}
            currentTime={playbackState.currentTime}
            isPlaying={playbackState.isPlaying}
            onUpdateLine={(lineIndex, updates) => {
              // 라인 업데이트 처리
              console.log('Line updated:', lineIndex, updates);
            }}
            onSave={(updatedLyrics) => {
              // 전체 가사 저장
              loadParsedLRC(updatedLyrics);
              toast.success('가사가 저장되었습니다!');
            }}
            onSeek={seek}
            onPlay={play}
            onPause={pause}
          />
        </TabsContent>
        
        <TabsContent value="websocket" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>실시간 동기화</CardTitle>
              <CardDescription>
                여러 디바이스 간 가사를 실시간으로 동기화합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WebSocketControl 
                currentLyricsId={selectedResult?.id}
                onLyricsChange={(lyricsId) => {
                  // 가사 변경 시 자동으로 로드
                  if (lyricsId && lyrics) {
                    loadParsedLRC(lyrics);
                    toast.success('가사가 동기화되었습니다');
                  }
                }}
              />
              
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">사용 방법</h4>
                <ol className="text-sm space-y-1 text-blue-800 dark:text-blue-200">
                  <li>1. 방을 생성하거나 참여 코드를 입력하세요</li>
                  <li>2. 호스트가 가사를 선택하면 모든 참가자에게 동기화됩니다</li>
                  <li>3. 재생 컨트롤도 실시간으로 동기화됩니다</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}