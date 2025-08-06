'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Music, Settings, ChevronLeft, ChevronRight, Play, Pause, RotateCcw, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { LyricsSearchServiceClient } from '@/services/lyrics-search-service-client';
import { supabase } from '@/lib/supabase';
import { checkTablesExist } from '@/lib/init-database';

type ControlMode = 'manual' | 'learning' | 'auto';
type SearchMode = 'auto' | 'manual';

interface LyricsLine {
  time: number;
  text: string;
  actualTime?: number; // 학습된 실제 시간
}

interface SongData {
  title: string;
  artist: string;
  lyrics: LyricsLine[];
  patternId?: string;
  source?: string;
  confidence?: number;
}

interface SearchResult {
  lyrics: string;
  source: string;
  confidence: number;
  title: string;
  artist: string;
  searchTime: number;
  status: 'success' | 'failed' | 'searching';
  error?: string;
  preview?: string;
}

export default function HostControlV2() {
  // 검색 모드
  const [searchMode, setSearchMode] = useState<SearchMode>('auto');
  const [autoSearchQuery, setAutoSearchQuery] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  
  // 가사 데이터
  const [songData, setSongData] = useState<SongData | null>(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResultsModal, setShowResultsModal] = useState(false);
  
  // 컨트롤 모드
  const [controlMode, setControlMode] = useState<ControlMode>('manual');
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  
  // 학습 데이터
  const [learningData, setLearningData] = useState<number[]>([]);
  const lyricsSearchService = useRef(new LyricsSearchServiceClient());
  const [dbStatus, setDbStatus] = useState<string>('');
  
  // 데이터베이스 테이블 체크
  useEffect(() => {
    checkTablesExist().then(results => {
      const missing = results.filter(r => !r.exists);
      if (missing.length > 0) {
        setDbStatus(`⚠️ 누락된 테이블: ${missing.map(m => m.table).join(', ')}`);
      } else if (results.length > 0) {
        setDbStatus('✅ 데이터베이스 준비 완료');
      }
    });
  }, []);

  // 가사 검색 (멀티 결과)
  const handleSearch = async () => {
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      let artist = '';
      let title = '';
      
      if (searchMode === 'auto') {
        // 자동 파싱
        const parts = autoSearchQuery.split(/\s+/);
        if (parts.length >= 2) {
          artist = parts[0];
          title = parts.slice(1).join(' ');
        } else {
          artist = autoSearchQuery;
          title = autoSearchQuery;
        }
      } else {
        // 수동 입력
        artist = manualArtist;
        title = manualTitle;
      }
      
      if (!artist || !title) {
        toast.error('아티스트와 제목을 입력해주세요');
        return;
      }
      
      // 멀티 AI 검색 API 호출
      const response = await fetch('/api/lyrics/ai-search-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      });
      
      const data = await response.json();
      
      if (data.success && data.results) {
        setSearchResults(data.results);
        
        // 성공한 결과가 있는지 확인
        const successResults = data.results.filter((r: SearchResult) => r.status === 'success' && r.confidence > 0);
        
        if (successResults.length === 0) {
          toast.error('가사를 찾을 수 없습니다');
        } else if (successResults.length === 1 && successResults[0].confidence > 0.8) {
          // 신뢰도 높은 단일 결과는 자동 선택
          selectLyrics(successResults[0]);
          toast.success(`${successResults[0].source}에서 가사를 찾았습니다! (신뢰도: ${(successResults[0].confidence * 100).toFixed(0)}%)`);
        } else {
          // 여러 결과가 있거나 신뢰도가 낮으면 선택 모달 표시
          setShowResultsModal(true);
          toast.info(`${successResults.length}개의 검색 결과를 찾았습니다. 선택해주세요.`);
        }
      } else {
        toast.error('검색 중 오류가 발생했습니다');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('검색 중 오류가 발생했습니다');
    } finally {
      setIsSearching(false);
    }
  };

  // 가사 선택
  const selectLyrics = async (result: SearchResult) => {
    const lyrics = parseLRCOrCreateDefault(result.lyrics);
    
    setSongData({
      title: result.title,
      artist: result.artist,
      lyrics,
      source: result.source,
      confidence: result.confidence
    });
    
    // 곡 정보를 localStorage에 저장
    localStorage.setItem('current_song_title', result.title);
    localStorage.setItem('current_song_artist', result.artist);
    
    // 전체 가사를 localStorage에 저장 (OBS에서 사용)
    localStorage.setItem('current_lyrics_full', result.lyrics);
    localStorage.setItem('current_lrc', convertToLRC(result.lyrics, result.title, result.artist));
    
    setShowResultsModal(false);
    
    // 이전 학습 데이터 확인
    await checkPreviousPattern(result.artist, result.title);
    
    // 캐시 저장 (성공한 결과만)
    if (result.status === 'success' && !result.source.includes('캐시')) {
      await saveToCache(result);
    }
  };

  // 캐시 저장
  const saveToCache = async (result: SearchResult) => {
    try {
      await supabase
        .from('ai_lyrics_cache')
        .upsert({
          artist: result.artist,
          title: result.title,
          lyrics: result.lyrics,
          source: result.source,
          confidence: result.confidence,
          search_time: result.searchTime,
          hit_count: 0,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }, {
          onConflict: 'artist,title'
        });
    } catch (error) {
      console.error('Cache save error:', error);
    }
  };

  // 이전 학습 패턴 확인
  const checkPreviousPattern = async (artist: string, title: string) => {
    try {
      const { data } = await supabase
        .from('song_patterns')
        .select('*')
        .eq('song_id', `${artist}_${title}`)
        .single();
      
      if (data) {
        toast.info('이전 학습 데이터를 찾았습니다. 자동 모드 사용 가능!');
        if (data.line_timings) {
          setLearningData(data.line_timings);
        }
      }
    } catch (error) {
      // 패턴 없음 - 정상
    }
  };

  // 다음 라인으로
  const nextLine = () => {
    if (!songData) return;
    
    const newIndex = Math.min(currentLineIndex + 1, songData.lyrics.length - 1);
    setCurrentLineIndex(newIndex);
    
    if (controlMode === 'learning') {
      const currentTime = Date.now() - startTime;
      setLearningData(prev => [...prev, currentTime]);
    }
    
    localStorage.setItem('current_line_index', newIndex.toString());
    localStorage.setItem('current_line_text', songData.lyrics[newIndex]?.text || '');
  };

  // 이전 라인으로
  const prevLine = () => {
    const newIndex = Math.max(currentLineIndex - 1, 0);
    setCurrentLineIndex(newIndex);
    localStorage.setItem('current_line_index', newIndex.toString());
  };

  // 재생/정지
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    
    if (!isPlaying) {
      setStartTime(Date.now());
      
      if (controlMode === 'auto' && learningData.length > 0) {
        autoPlay();
      }
    }
  };

  // 자동 재생
  const autoPlay = () => {
    learningData.forEach((timing, index) => {
      setTimeout(() => {
        if (index < (songData?.lyrics.length || 0) - 1) {
          setCurrentLineIndex(index + 1);
          localStorage.setItem('current_line_index', (index + 1).toString());
        }
      }, timing);
    });
  };

  // 학습 데이터 저장
  const saveLearningData = async () => {
    if (!songData || learningData.length === 0) return;
    
    try {
      await supabase.from('song_patterns').upsert({
        song_id: `${songData.artist}_${songData.title}`,
        mr_url: localStorage.getItem('youtube_url'),
        line_timings: learningData,
        created_at: new Date().toISOString()
      });
      
      toast.success('학습 데이터가 저장되었습니다!');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('저장 실패');
    }
  };

  // 키보드 단축키
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // 모달이 열려있을 때는 단축키 비활성화
      if (showResultsModal) return;
      
      // 입력 필드에 포커스가 있으면 단축키 비활성화
      const activeElement = document.activeElement;
      if (activeElement && 
          (activeElement.tagName === 'INPUT' || 
           activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      
      switch(e.key) {
        case ' ':
          e.preventDefault();
          if (controlMode !== 'auto') {
            nextLine();
          } else {
            togglePlay();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prevLine();
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextLine();
          break;
        case 'Enter':
          e.preventDefault();
          togglePlay();
          break;
        case 's':
        case 'S':
          if (controlMode === 'learning') {
            saveLearningData();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [controlMode, currentLineIndex, songData, showResultsModal]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-center mb-8">
          🎤 스마트 노래방 컨트롤
        </h1>
        
        {/* DB 상태 표시 */}
        {dbStatus && (
          <div className={`text-center mb-4 px-4 py-2 rounded-lg ${
            dbStatus.includes('⚠️') ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
          }`}>
            {dbStatus}
            {dbStatus.includes('⚠️') && (
              <div className="text-sm mt-2">
                <a href="/create-tables.sql" download className="underline">
                  SQL 스크립트 다운로드
                </a>
                <span className="mx-2">|</span>
                <a href="https://supabase.com/dashboard" target="_blank" className="underline">
                  Supabase 대시보드
                </a>
              </div>
            )}
          </div>
        )}
        
        {/* OBS 설정 바로가기 */}
        <div className="flex justify-center mb-6">
          <a
            href="/obs/settings"
            target="_blank"
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl hover:from-purple-600 hover:to-blue-600 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            OBS 스트리밍 설정
          </a>
        </div>

        {/* 검색 섹션 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <Search className="w-5 h-5 mr-2" />
              가사 검색
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setSearchMode('auto')}
                className={`px-3 py-1 rounded-lg ${
                  searchMode === 'auto' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100'
                }`}
              >
                자동
              </button>
              <button
                onClick={() => setSearchMode('manual')}
                className={`px-3 py-1 rounded-lg ${
                  searchMode === 'manual' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100'
                }`}
              >
                수동
              </button>
            </div>
          </div>

          {searchMode === 'auto' ? (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="아티스트 노래제목 (예: 아이유 좋은날)"
                value={autoSearchQuery}
                onChange={(e) => setAutoSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    검색중...
                  </>
                ) : (
                  '검색'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="아티스트"
                value={manualArtist}
                onChange={(e) => setManualArtist(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="노래 제목"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="w-full px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    검색중...
                  </>
                ) : (
                  '검색'
                )}
              </button>
            </div>
          )}
        </div>

        {/* 검색 결과 선택 모달 */}
        {showResultsModal && searchResults.length > 0 && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b">
                <h3 className="text-2xl font-bold">검색 결과 선택</h3>
                <p className="text-gray-600 mt-1">원하는 가사를 선택해주세요</p>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                {searchResults
                  .filter(r => r.status === 'success' && r.confidence > 0)
                  .map((result, index) => (
                    <div
                      key={index}
                      className="border rounded-xl p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => selectLyrics(result)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <div>
                            <span className="font-semibold text-lg">{result.source}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-sm px-2 py-0.5 rounded-full ${
                                result.confidence > 0.7 
                                  ? 'bg-green-100 text-green-700'
                                  : result.confidence > 0.5
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-red-100 text-red-700'
                              }`}>
                                신뢰도: {(result.confidence * 100).toFixed(0)}%
                              </span>
                              <span className="text-xs text-gray-500">
                                {result.searchTime.toFixed(1)}초
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            selectLyrics(result);
                          }}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                        >
                          선택
                        </button>
                      </div>
                      
                      {/* 가사 미리보기 */}
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 font-mono">
                        <pre className="whitespace-pre-wrap">{result.preview || result.lyrics.slice(0, 200)}...</pre>
                      </div>
                    </div>
                  ))}
                
                {/* 실패한 검색 결과 표시 */}
                {searchResults.filter(r => r.status === 'failed').length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-gray-500 mb-2">검색 실패</h4>
                    {searchResults
                      .filter(r => r.status === 'failed')
                      .map((result, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                          <XCircle className="w-4 h-4 text-red-400" />
                          <span>{result.source}: {result.error || '결과 없음'}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t bg-gray-50">
                <button
                  onClick={() => setShowResultsModal(false)}
                  className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 가사 표시 */}
        {songData && (
          <>
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              {/* 곡 정보 */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">{songData.title}</h2>
                <p className="text-gray-600">{songData.artist}</p>
                <div className="mt-2 text-sm text-gray-500">
                  {currentLineIndex + 1} / {songData.lyrics.length}
                </div>
                {/* 소스와 신뢰도 표시 */}
                {songData.source && (
                  <div className="mt-2 flex items-center justify-center gap-2 text-xs text-gray-400">
                    <span className="px-2 py-1 bg-gray-100 rounded-full">
                      {songData.source}
                    </span>
                    {songData.confidence && (
                      <span className="px-2 py-1 bg-blue-50 rounded-full">
                        신뢰도: {(songData.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 가사 디스플레이 */}
              <div className="space-y-4 min-h-[300px] flex flex-col justify-center">
                {/* 이전 라인 */}
                {currentLineIndex > 0 && (
                  <div className="text-center text-gray-400 text-lg">
                    {songData.lyrics[currentLineIndex - 1]?.text}
                  </div>
                )}
                
                {/* 현재 라인 */}
                <div className="text-center text-3xl font-bold text-blue-600 py-4">
                  <span className="inline-block animate-pulse">▶</span>
                  <span className="mx-4">
                    {songData.lyrics[currentLineIndex]?.text || '준비...'}
                  </span>
                  <span className="inline-block animate-pulse">◀</span>
                </div>
                
                {/* 다음 라인 */}
                {currentLineIndex < songData.lyrics.length - 1 && (
                  <div className="text-center text-gray-400 text-lg">
                    {songData.lyrics[currentLineIndex + 1]?.text}
                  </div>
                )}
              </div>

              {/* 컨트롤 버튼 */}
              <div className="flex justify-center items-center gap-4 mt-8">
                <button
                  onClick={prevLine}
                  className="p-3 bg-gray-100 rounded-full hover:bg-gray-200"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                
                <button
                  onClick={togglePlay}
                  className="p-4 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6" />
                  )}
                </button>
                
                <button
                  onClick={nextLine}
                  className="p-3 bg-gray-100 rounded-full hover:bg-gray-200"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                
                <button
                  onClick={() => setCurrentLineIndex(0)}
                  className="p-3 bg-gray-100 rounded-full hover:bg-gray-200"
                >
                  <RotateCcw className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* 모드 선택 */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4">컨트롤 모드</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setControlMode('manual')}
                  className={`flex-1 py-3 rounded-xl ${
                    controlMode === 'manual'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100'
                  }`}
                >
                  수동
                  <div className="text-xs mt-1">Space로 넘기기</div>
                </button>
                <button
                  onClick={() => setControlMode('learning')}
                  className={`flex-1 py-3 rounded-xl ${
                    controlMode === 'learning'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100'
                  }`}
                >
                  학습
                  <div className="text-xs mt-1">타이밍 기록</div>
                </button>
                <button
                  onClick={() => setControlMode('auto')}
                  disabled={learningData.length === 0}
                  className={`flex-1 py-3 rounded-xl ${
                    controlMode === 'auto'
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100'
                  } ${learningData.length === 0 ? 'opacity-50' : ''}`}
                >
                  자동
                  <div className="text-xs mt-1">학습된 타이밍</div>
                </button>
              </div>
              
              {controlMode === 'learning' && learningData.length > 0 && (
                <button
                  onClick={saveLearningData}
                  className="w-full mt-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600"
                >
                  학습 데이터 저장 (S)
                </button>
              )}
            </div>
          </>
        )}

        {/* 단축키 안내 */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Space: 다음 | ←/→: 이전/다음 | Enter: 재생/정지 | S: 저장 (학습모드)
        </div>

        {/* OBS 사용 안내 */}
        {songData && (
          <>
            {/* 크로마키 오버레이 설정 */}
            <div className="mt-6 p-4 bg-green-50 border-2 border-green-300 rounded-xl">
              <h4 className="font-semibold text-green-900 mb-2">🎥 OBS 크로마키 가사 오버레이</h4>
              <p className="text-sm text-green-700 mb-3">
                <strong>브라우저 소스 URL:</strong>
              </p>
              <code className="block bg-white p-3 rounded text-xs text-gray-800 mb-3">
                http://localhost:3000/obs/overlay
              </code>
              
              <div className="text-xs text-green-600 space-y-2">
                <div className="font-semibold">크로마키 설정:</div>
                <p>• 필터 → 크로마키 추가</p>
                <p>• 키 색상 유형: 녹색 (사용자 지정)</p>
                <p>• 키 색상: #00FF00</p>
                <p>• 유사성: 420</p>
                <p>• 부드러움: 100</p>
                <p>• 키 색상 매칭: 0.10</p>
                
                <div className="font-semibold mt-3">URL 파라미터:</div>
                <p>• ?fontSize=60 (글자 크기)</p>
                <p>• ?textColor=%23FFFFFF (텍스트 색상)</p>
                <p>• ?highlightColor=%23FFD700 (하이라이트 색상)</p>
                <p>• ?showTranslation=true (번역 표시)</p>
                <p>• ?lang=ko (번역 언어: ko/en/ja/zh)</p>
              </div>
            </div>
            
            {/* 곡명 표시 설정 */}
            <div className="mt-4 p-4 bg-blue-50 rounded-xl">
              <h4 className="font-semibold text-blue-900 mb-2">🎵 OBS 곡명 표시</h4>
              <p className="text-sm text-blue-700 mb-2">
                <strong>브라우저 소스 URL:</strong>
              </p>
              <code className="block bg-white p-2 rounded text-xs text-gray-800">
                http://localhost:3000/obs/title
              </code>
              <div className="text-xs text-blue-600 mt-2">
                <p>• 크기: 600 x 200</p>
                <p>• 스타일: ?style=modern</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// LRC 파싱 또는 기본 형식 생성
function parseLRCOrCreateDefault(text: string): LyricsLine[] {
  const lines = text.split('\n').filter(line => line.trim());
  const lrcPattern = /\[(\d{2}):(\d{2}\.\d{2})\](.*)/;
  
  const lyrics: LyricsLine[] = [];
  
  for (const line of lines) {
    const match = line.match(lrcPattern);
    if (match) {
      const [, minutes, seconds, text] = match;
      const time = parseInt(minutes) * 60 + parseFloat(seconds);
      lyrics.push({ time, text: text.trim() });
    } else if (!line.startsWith('[')) {
      // LRC 메타데이터가 아닌 일반 텍스트
      lyrics.push({ 
        time: lyrics.length * 3, // 3초 간격 기본값
        text: line.trim() 
      });
    }
  }
  
  return lyrics;
}

// 일반 텍스트를 LRC 형식으로 변환
function convertToLRC(lyrics: string, title: string, artist: string): string {
  const lines = lyrics.split('\n').filter(line => line.trim());
  const header = [
    `[ti:${title}]`,
    `[ar:${artist}]`,
    '[by:Host Control V2]',
    ''
  ].join('\n');
  
  // 각 라인에 기본 타이밍 추가 (3초 간격)
  const lrcLines = lines.map((line, index) => {
    const seconds = index * 3;
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2).padStart(5, '0');
    return `[${minutes.toString().padStart(2, '0')}:${secs}]${line}`;
  });
  
  return header + lrcLines.join('\n');
}