'use client';

import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, CheckCircle, XCircle, Loader2, Globe, Music, Mic } from 'lucide-react';
import { toast } from 'sonner';

interface SearchResult {
  lyrics: string;
  source: string;
  confidence: number;
  searchTime: number;
  status: 'idle' | 'searching' | 'success' | 'failed';
  error?: string;
}

interface LyricsLine {
  text: string;
  pronunciation?: string; // 한글 발음
  translations?: {
    en?: string;
    ko?: string;
    ja?: string;
    zh?: string;
  };
}

export default function HostV3() {
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLyrics, setSelectedLyrics] = useState<string>('');
  const [selectedPronunciation, setSelectedPronunciation] = useState<string>('');
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  
  // 각 API별 검색 결과
  const [searchResults, setSearchResults] = useState<{
    perplexity: SearchResult | null;
    gemini: SearchResult | null;
    claude: SearchResult | null;
    gpt: SearchResult | null;
  }>({
    perplexity: null,
    gemini: null,
    claude: null,
    gpt: null
  });

  // 언어 설정 (호스트용)
  const [hostLanguage] = useState('ko'); // 한국어 호스트
  const [showPronunciation, setShowPronunciation] = useState(true);
  
  // 검색 API 순서
  const searchOrder = ['perplexity', 'gemini', 'claude', 'gpt'] as const;
  const apiNames = {
    perplexity: 'Perplexity AI',
    gemini: 'Google Gemini',
    claude: 'Claude 3',
    gpt: 'GPT-4'
  };

  // Perplexity 검색
  const searchWithPerplexity = async () => {
    setIsSearching(true);
    setSearchResults(prev => ({
      ...prev,
      perplexity: { lyrics: '', source: 'Perplexity', confidence: 0, searchTime: 0, status: 'searching' }
    }));

    try {
      const response = await fetch('/api/lyrics/ai-search-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      });

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const bestResult = data.results
          .filter((r: any) => r.source.includes('Perplexity'))
          .sort((a: any, b: any) => b.confidence - a.confidence)[0];
        
        if (bestResult) {
          setSearchResults(prev => ({
            ...prev,
            perplexity: {
              lyrics: bestResult.lyrics,
              source: 'Perplexity',
              confidence: bestResult.confidence,
              searchTime: bestResult.searchTime,
              status: 'success'
            }
          }));
          return;
        }
      }
      
      throw new Error('No results found');
    } catch (error) {
      setSearchResults(prev => ({
        ...prev,
        perplexity: {
          lyrics: '',
          source: 'Perplexity',
          confidence: 0,
          searchTime: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Search failed'
        }
      }));
    } finally {
      setIsSearching(false);
    }
  };

  // Gemini 검색
  const searchWithGemini = async () => {
    setIsSearching(true);
    setSearchResults(prev => ({
      ...prev,
      gemini: { lyrics: '', source: 'Gemini', confidence: 0, searchTime: 0, status: 'searching' }
    }));

    try {
      const response = await fetch('/api/lyrics/gemini-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      });

      const data = await response.json();
      
      if (data.success && data.lyrics) {
        setSearchResults(prev => ({
          ...prev,
          gemini: {
            lyrics: data.lyrics,
            source: 'Gemini',
            confidence: data.confidence || 0.9,
            searchTime: data.searchTime,
            status: 'success'
          }
        }));
      } else {
        throw new Error(data.error || 'No results found');
      }
    } catch (error) {
      setSearchResults(prev => ({
        ...prev,
        gemini: {
          lyrics: '',
          source: 'Gemini',
          confidence: 0,
          searchTime: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Search failed'
        }
      }));
    } finally {
      setIsSearching(false);
    }
  };

  // Claude 검색
  const searchWithClaude = async () => {
    setIsSearching(true);
    setSearchResults(prev => ({
      ...prev,
      claude: { lyrics: '', source: 'Claude', confidence: 0, searchTime: 0, status: 'searching' }
    }));

    try {
      const response = await fetch('/api/lyrics/claude-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      });

      const data = await response.json();
      
      if (data.success && data.lyrics) {
        setSearchResults(prev => ({
          ...prev,
          claude: {
            lyrics: data.lyrics,
            source: 'Claude',
            confidence: data.confidence || 0.95,
            searchTime: data.searchTime,
            status: 'success'
          }
        }));
      } else {
        throw new Error(data.error || 'No results found');
      }
    } catch (error) {
      setSearchResults(prev => ({
        ...prev,
        claude: {
          lyrics: '',
          source: 'Claude',
          confidence: 0,
          searchTime: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Search failed'
        }
      }));
    } finally {
      setIsSearching(false);
    }
  };

  // GPT 검색
  const searchWithGPT = async () => {
    setIsSearching(true);
    setSearchResults(prev => ({
      ...prev,
      gpt: { lyrics: '', source: 'GPT', confidence: 0, searchTime: 0, status: 'searching' }
    }));

    try {
      const response = await fetch('/api/lyrics/gpt-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      });

      const data = await response.json();
      
      if (data.success && data.lyrics) {
        setSearchResults(prev => ({
          ...prev,
          gpt: {
            lyrics: data.lyrics,
            source: 'GPT-4',
            confidence: data.confidence || 0.9,
            searchTime: data.searchTime,
            status: 'success'
          }
        }));
      } else {
        throw new Error(data.error || 'No results found');
      }
    } catch (error) {
      setSearchResults(prev => ({
        ...prev,
        gpt: {
          lyrics: '',
          source: 'GPT-4',
          confidence: 0,
          searchTime: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Search failed'
        }
      }));
    } finally {
      setIsSearching(false);
    }
  };

  // 순차적 검색 시작
  const startSequentialSearch = async () => {
    if (!artist || !title) {
      toast.error('아티스트와 제목을 입력해주세요');
      return;
    }

    setCurrentStep(1);
    await searchWithPerplexity();
  };

  // 다음 검색 진행
  const proceedToNext = async () => {
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);

    switch (searchOrder[nextStep - 1]) {
      case 'gemini':
        await searchWithGemini();
        break;
      case 'claude':
        await searchWithClaude();
        break;
      case 'gpt':
        await searchWithGPT();
        break;
    }
  };

  // 가사 선택
  const selectLyrics = async (lyrics: string, source: string) => {
    setSelectedLyrics(lyrics);
    
    // localStorage에 저장 (OBS 연동용)
    localStorage.setItem('current_lyrics', lyrics);
    localStorage.setItem('current_artist', artist);
    localStorage.setItem('current_title', title);
    localStorage.setItem('lyrics_source', source);
    
    toast.success(`${source} 가사 선택됨`);

    // 발음 변환 요청 (일본어/영어인 경우)
    if (needsPronunciation(lyrics)) {
      toast.info('발음 변환 중...');
      await getPronunciation(lyrics);
    }
  };

  // 발음 변환 필요 여부 확인
  const needsPronunciation = (lyrics: string): boolean => {
    const hasJapanese = /[ぁ-んァ-ン一-龯]/.test(lyrics);
    const hasEnglish = /[a-zA-Z]/.test(lyrics);
    const hasKorean = /[가-힣]/.test(lyrics);
    
    // 한국어가 없고 일본어나 영어가 있으면 발음 변환 필요
    if (!hasKorean && (hasJapanese || hasEnglish)) {
      return true;
    }
    
    // 한국어와 영어가 섞여있으면 변환 불필요 (이미 한글 가사)
    if (hasKorean && hasEnglish) {
      return false;
    }
    
    return false;
  };

  // 발음 변환 요청
  const getPronunciation = async (lyrics: string) => {
    try {
      const response = await fetch('/api/pronunciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: lyrics,
          targetLang: 'ko' // 한글 발음으로 변환
        })
      });

      const data = await response.json();
      if (data.success) {
        setSelectedPronunciation(data.pronunciation);
        localStorage.setItem('lyrics_pronunciation', data.pronunciation);
        
        const langName = data.detectedLanguage === 'ja' ? '일본어' : 
                         data.detectedLanguage === 'en' ? '영어' : 
                         data.detectedLanguage === 'zh' ? '중국어' : '외국어';
        toast.success(`${langName} 발음 변환 완료`);
      }
    } catch (error) {
      console.error('Pronunciation error:', error);
      toast.error('발음 변환 실패');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900/20 to-black p-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🎤 호스트 컨트롤 v3
          </h1>
          <p className="text-gray-400">순차적 가사 검색 시스템</p>
        </div>

        {/* 검색 입력 */}
        <div className="bg-black/50 backdrop-blur rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="아티스트 (예: 샘킴, YOASOBI)"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500"
            />
            <input
              type="text"
              placeholder="제목 (예: Make Up, 夜に駆ける)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500"
            />
          </div>
          <button
            onClick={startSequentialSearch}
            disabled={isSearching || !artist || !title}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {isSearching ? (
              <>
                <Loader2 className="inline-block w-5 h-5 mr-2 animate-spin" />
                검색 중...
              </>
            ) : (
              <>
                <Search className="inline-block w-5 h-5 mr-2" />
                순차 검색 시작
              </>
            )}
          </button>
        </div>

        {/* 검색 결과 */}
        <div className="space-y-4">
          {searchOrder.map((api, index) => {
            const result = searchResults[api];
            const isCurrentStep = currentStep === index + 1;
            const isPastStep = currentStep > index + 1;
            
            if (!result && !isCurrentStep && !isPastStep) return null;

            return (
              <div
                key={api}
                className={`bg-black/50 backdrop-blur rounded-2xl p-6 transition-all ${
                  isCurrentStep ? 'ring-2 ring-purple-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      result?.status === 'success' ? 'bg-green-500' :
                      result?.status === 'failed' ? 'bg-red-500' :
                      result?.status === 'searching' ? 'bg-yellow-500 animate-pulse' :
                      'bg-gray-700'
                    }`}>
                      {result?.status === 'success' ? <CheckCircle className="w-6 h-6 text-white" /> :
                       result?.status === 'failed' ? <XCircle className="w-6 h-6 text-white" /> :
                       result?.status === 'searching' ? <Loader2 className="w-6 h-6 text-white animate-spin" /> :
                       <span className="text-white font-bold">{index + 1}</span>}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">{apiNames[api]}</h3>
                      {result && (
                        <p className="text-sm text-gray-400">
                          {result.status === 'success' && `신뢰도: ${(result.confidence * 100).toFixed(0)}% | ${result.searchTime.toFixed(2)}초`}
                          {result.status === 'failed' && `오류: ${result.error}`}
                          {result.status === 'searching' && '검색 중...'}
                        </p>
                      )}
                    </div>
                  </div>

                  {result?.status === 'success' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => selectLyrics(result.lyrics, apiNames[api])}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                      >
                        이 가사 사용
                      </button>
                      {index < searchOrder.length - 1 && (
                        <button
                          onClick={proceedToNext}
                          disabled={isSearching}
                          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition flex items-center gap-1"
                        >
                          다음 검색
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 가사 미리보기 */}
                {result?.status === 'success' && result.lyrics && (
                  <div className="mt-4 p-4 bg-black/30 rounded-lg max-h-60 overflow-y-auto">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                      {result.lyrics.split('\n').slice(0, 10).join('\n')}
                      {result.lyrics.split('\n').length > 10 && '\n\n... (더 보기)'}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 선택된 가사 표시 */}
        {selectedLyrics && (
          <div className="mt-8 bg-gradient-to-r from-purple-900/50 to-pink-900/50 backdrop-blur rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              <Music className="inline-block w-6 h-6 mr-2" />
              선택된 가사
            </h2>
            
            {/* 발음이 있는 경우 탭으로 표시 */}
            {selectedPronunciation && (
              <div className="mb-4 flex gap-2">
                <button
                  className={`px-4 py-2 rounded-lg transition ${
                    showPronunciation 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  onClick={() => setShowPronunciation(true)}
                >
                  <Mic className="inline-block w-4 h-4 mr-2" />
                  한글 발음
                </button>
                <button
                  className={`px-4 py-2 rounded-lg transition ${
                    !showPronunciation 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  onClick={() => setShowPronunciation(false)}
                >
                  원본 가사
                </button>
              </div>
            )}
            
            <div className="bg-black/30 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="text-white whitespace-pre-wrap font-sans leading-relaxed">
                {showPronunciation && selectedPronunciation ? selectedPronunciation : selectedLyrics}
              </pre>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                onClick={() => {
                  localStorage.setItem('obs_control', 'play');
                  toast.success('재생 시작');
                }}
              >
                OBS 재생
              </button>
              <button
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
                onClick={() => {
                  localStorage.setItem('obs_control', 'stop');
                  toast.success('정지');
                }}
              >
                정지
              </button>
            </div>
          </div>
        )}

        {/* 설정 */}
        <div className="mt-8 bg-black/50 backdrop-blur rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">
            <Globe className="inline-block w-5 h-5 mr-2" />
            호스트 설정
          </h3>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-white">
              <input
                type="checkbox"
                checked={showPronunciation}
                onChange={(e) => setShowPronunciation(e.target.checked)}
                className="w-4 h-4"
              />
              일본어/중국어 한글 발음 표시
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}