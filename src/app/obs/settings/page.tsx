'use client';

import React, { useState, useEffect } from 'react';
import { Sliders, Copy, Check, Monitor, Globe, Palette, Type, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function OBSSettings() {
  // 설정 상태
  const [fontSize, setFontSize] = useState(60);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [highlightColor, setHighlightColor] = useState('#FFD700');
  const [translationColor, setTranslationColor] = useState('#87CEEB');
  const [chromaKey, setChromaKey] = useState('#00FF00');
  const [showTranslation, setShowTranslation] = useState(true);
  const [targetLang, setTargetLang] = useState('ko');
  const [overlayStyle, setOverlayStyle] = useState('default');
  
  // URL 상태
  const [overlayUrl, setOverlayUrl] = useState('');
  const [titleUrl, setTitleUrl] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  
  // 프리셋
  const [presets, setPresets] = useState<any[]>([]);
  const [presetName, setPresetName] = useState('');
  
  // API 키 설정
  const [openaiKey, setOpenaiKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [showApiKeys, setShowApiKeys] = useState(false);
  
  // URL 생성
  useEffect(() => {
    const params = new URLSearchParams({
      fontSize: fontSize.toString(),
      textColor: textColor,
      highlightColor: highlightColor,
      translationColor: translationColor,
      chromaKey: chromaKey,
      showTranslation: showTranslation.toString(),
      lang: targetLang,
      style: overlayStyle
    });
    
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    setOverlayUrl(`${baseUrl}/obs/overlay?${params.toString()}`);
    setTitleUrl(`${baseUrl}/obs/title?style=${overlayStyle}`);
  }, [fontSize, textColor, highlightColor, translationColor, chromaKey, showTranslation, targetLang, overlayStyle]);
  
  // 설정 저장
  useEffect(() => {
    const settings = {
      fontSize,
      textColor,
      highlightColor,
      translationColor,
      chromaKey,
      showTranslation,
      targetLang,
      overlayStyle
    };
    localStorage.setItem('obs_settings', JSON.stringify(settings));
  }, [fontSize, textColor, highlightColor, translationColor, chromaKey, showTranslation, targetLang, overlayStyle]);
  
  // 설정 불러오기
  useEffect(() => {
    const saved = localStorage.getItem('obs_settings');
    if (saved) {
      const settings = JSON.parse(saved);
      setFontSize(settings.fontSize || 60);
      setTextColor(settings.textColor || '#FFFFFF');
      setHighlightColor(settings.highlightColor || '#FFD700');
      setTranslationColor(settings.translationColor || '#87CEEB');
      setChromaKey(settings.chromaKey || '#00FF00');
      setShowTranslation(settings.showTranslation ?? true);
      setTargetLang(settings.targetLang || 'ko');
      setOverlayStyle(settings.overlayStyle || 'default');
    }
    
    // API 키 불러오기
    const savedOpenai = localStorage.getItem('user_openai_key');
    const savedGoogle = localStorage.getItem('user_google_key');
    if (savedOpenai) setOpenaiKey(savedOpenai);
    if (savedGoogle) setGoogleKey(savedGoogle);
    
    // 프리셋 불러오기
    const savedPresets = localStorage.getItem('obs_presets');
    if (savedPresets) {
      setPresets(JSON.parse(savedPresets));
    }
  }, []);
  
  // URL 복사
  const copyUrl = (url: string, type: string) => {
    navigator.clipboard.writeText(url);
    setCopied(type);
    toast.success(`${type === 'overlay' ? '오버레이' : '타이틀'} URL이 복사되었습니다!`);
    setTimeout(() => setCopied(null), 2000);
  };
  
  // 프리셋 저장
  const savePreset = () => {
    if (!presetName) {
      toast.error('프리셋 이름을 입력해주세요');
      return;
    }
    
    const preset = {
      name: presetName,
      fontSize,
      textColor,
      highlightColor,
      translationColor,
      chromaKey,
      showTranslation,
      targetLang,
      overlayStyle
    };
    
    const newPresets = [...presets, preset];
    setPresets(newPresets);
    localStorage.setItem('obs_presets', JSON.stringify(newPresets));
    setPresetName('');
    toast.success('프리셋이 저장되었습니다!');
  };
  
  // 프리셋 적용
  const applyPreset = (preset: any) => {
    setFontSize(preset.fontSize);
    setTextColor(preset.textColor);
    setHighlightColor(preset.highlightColor);
    setTranslationColor(preset.translationColor);
    setChromaKey(preset.chromaKey);
    setShowTranslation(preset.showTranslation);
    setTargetLang(preset.targetLang);
    setOverlayStyle(preset.overlayStyle);
    toast.success(`"${preset.name}" 프리셋이 적용되었습니다!`);
  };
  
  // API 키 저장
  const saveApiKeys = () => {
    localStorage.setItem('user_openai_key', openaiKey);
    localStorage.setItem('user_google_key', googleKey);
    toast.success('API 키가 저장되었습니다!');
    setShowApiKeys(false);
  };
  
  // OBS에서 자동 열기
  const openInOBS = (type: 'overlay' | 'title') => {
    const url = type === 'overlay' ? overlayUrl : titleUrl;
    copyUrl(url, type);
    
    // OBS 가이드 표시
    toast.info(
      <div>
        <p className="font-semibold mb-2">OBS에서 설정하기:</p>
        <ol className="text-sm space-y-1">
          <li>1. 소스 → 브라우저 추가</li>
          <li>2. URL 붙여넣기 (Ctrl+V)</li>
          <li>3. 크기: 1920x1080</li>
          {type === 'overlay' && <li>4. 필터 → 크로마키 추가</li>}
        </ol>
      </div>,
      { duration: 10000 }
    );
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 flex items-center">
          <Sliders className="w-8 h-8 mr-3" />
          OBS 스트리밍 설정
        </h1>
        
        <div className="grid lg:grid-cols-2 gap-6">
          {/* 왼쪽: 설정 패널 */}
          <div className="space-y-6">
            {/* 텍스트 설정 */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Type className="w-5 h-5 mr-2" />
                텍스트 설정
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2">글자 크기</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="30"
                      max="120"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-12 text-center">{fontSize}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-2">텍스트 색상</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-full h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-24 px-2 bg-gray-700 rounded text-sm"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm mb-2">하이라이트 색상</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={highlightColor}
                        onChange={(e) => setHighlightColor(e.target.value)}
                        className="w-full h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={highlightColor}
                        onChange={(e) => setHighlightColor(e.target.value)}
                        className="w-24 px-2 bg-gray-700 rounded text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 번역 설정 */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Globe className="w-5 h-5 mr-2" />
                번역 설정
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm">번역 표시</label>
                  <button
                    onClick={() => setShowTranslation(!showTranslation)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      showTranslation ? 'bg-blue-500' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      showTranslation ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                
                {showTranslation && (
                  <>
                    <div>
                      <label className="block text-sm mb-2">번역 언어</label>
                      <select
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 rounded"
                      >
                        <option value="ko">한국어</option>
                        <option value="en">English</option>
                        <option value="ja">日本語</option>
                        <option value="zh">中文</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-2">번역 텍스트 색상</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={translationColor}
                          onChange={(e) => setTranslationColor(e.target.value)}
                          className="w-full h-10 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={translationColor}
                          onChange={(e) => setTranslationColor(e.target.value)}
                          className="w-24 px-2 bg-gray-700 rounded text-sm"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* 크로마키 설정 */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Palette className="w-5 h-5 mr-2" />
                크로마키 설정
              </h2>
              
              <div>
                <label className="block text-sm mb-2">크로마키 색상</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={chromaKey}
                    onChange={(e) => setChromaKey(e.target.value)}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={chromaKey}
                    onChange={(e) => setChromaKey(e.target.value)}
                    className="w-24 px-2 bg-gray-700 rounded text-sm"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  OBS 크로마키 필터에서 이 색상을 제거하도록 설정하세요
                </p>
              </div>
            </div>
            
            {/* API 키 설정 */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">
                API 키 설정
                <button
                  onClick={() => setShowApiKeys(!showApiKeys)}
                  className="ml-2 text-sm text-blue-400 hover:text-blue-300"
                >
                  {showApiKeys ? '숨기기' : '설정'}
                </button>
              </h2>
              
              {showApiKeys && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-2">OpenAI API Key</label>
                    <input
                      type="password"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 bg-gray-700 rounded"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm mb-2">Google API Key</label>
                    <input
                      type="password"
                      value={googleKey}
                      onChange={(e) => setGoogleKey(e.target.value)}
                      placeholder="AIza..."
                      className="w-full px-3 py-2 bg-gray-700 rounded"
                    />
                  </div>
                  
                  <button
                    onClick={saveApiKeys}
                    className="w-full py-2 bg-blue-500 rounded hover:bg-blue-600 transition"
                  >
                    API 키 저장
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* 오른쪽: 미리보기 및 URL */}
          <div className="space-y-6">
            {/* 미리보기 */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Eye className="w-5 h-5 mr-2" />
                미리보기
              </h2>
              
              <div 
                className="relative rounded-lg overflow-hidden"
                style={{ backgroundColor: chromaKey, minHeight: '300px' }}
              >
                <div className="p-8 text-center">
                  <div 
                    style={{ 
                      fontSize: `${fontSize * 0.5}px`,
                      color: textColor,
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                    }}
                    className="mb-4"
                  >
                    이전 가사 라인
                  </div>
                  
                  <div 
                    style={{ 
                      fontSize: `${fontSize * 0.7}px`,
                      color: highlightColor,
                      textShadow: '3px 3px 6px rgba(0,0,0,0.9)'
                    }}
                    className="mb-3 font-bold"
                  >
                    현재 가사 라인
                  </div>
                  
                  {showTranslation && (
                    <div 
                      style={{ 
                        fontSize: `${fontSize * 0.4}px`,
                        color: translationColor,
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                      }}
                      className="mb-4 italic"
                    >
                      번역된 텍스트
                    </div>
                  )}
                  
                  <div 
                    style={{ 
                      fontSize: `${fontSize * 0.5}px`,
                      color: textColor,
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      opacity: 0.5
                    }}
                  >
                    다음 가사 라인
                  </div>
                </div>
              </div>
            </div>
            
            {/* OBS URL */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Monitor className="w-5 h-5 mr-2" />
                OBS 브라우저 소스 URL
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2">가사 오버레이</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={overlayUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-700 rounded text-sm"
                    />
                    <button
                      onClick={() => copyUrl(overlayUrl, 'overlay')}
                      className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 transition"
                    >
                      {copied === 'overlay' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => openInOBS('overlay')}
                    className="w-full mt-2 py-2 bg-green-600 rounded hover:bg-green-700 transition"
                  >
                    OBS에서 열기 (가사)
                  </button>
                </div>
                
                <div>
                  <label className="block text-sm mb-2">곡명 표시</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={titleUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-700 rounded text-sm"
                    />
                    <button
                      onClick={() => copyUrl(titleUrl, 'title')}
                      className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 transition"
                    >
                      {copied === 'title' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => openInOBS('title')}
                    className="w-full mt-2 py-2 bg-green-600 rounded hover:bg-green-700 transition"
                  >
                    OBS에서 열기 (곡명)
                  </button>
                </div>
              </div>
            </div>
            
            {/* 프리셋 */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">프리셋</h2>
              
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="프리셋 이름"
                    className="flex-1 px-3 py-2 bg-gray-700 rounded"
                  />
                  <button
                    onClick={savePreset}
                    className="px-4 py-2 bg-purple-500 rounded hover:bg-purple-600 transition"
                  >
                    저장
                  </button>
                </div>
                
                {presets.length > 0 && (
                  <div className="space-y-2">
                    {presets.map((preset, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                        <span className="text-sm">{preset.name}</span>
                        <button
                          onClick={() => applyPreset(preset)}
                          className="px-3 py-1 bg-blue-500 rounded text-sm hover:bg-blue-600 transition"
                        >
                          적용
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}