'use client';

import React, { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, RotateCcw, Eye, Copy } from 'lucide-react';

interface TextSettings {
  originalSize: number;
  translationSize: number;
  lineSpacing: number;
  fontFamily: string;
  shadowIntensity: number;
  originalColor: string;
  translationColor: string;
  alignment: 'left' | 'center' | 'right';
  fontWeight: number;
  letterSpacing: number;
}

const DEFAULT_SETTINGS: TextSettings = {
  originalSize: 120,
  translationSize: 100,
  lineSpacing: 20,
  fontFamily: 'Pretendard',
  shadowIntensity: 8,
  originalColor: '#FFFFFF',
  translationColor: '#FFD700',
  alignment: 'center',
  fontWeight: 900,
  letterSpacing: 0.02,
};

const FONT_OPTIONS = [
  { value: 'Pretendard', label: 'Pretendard (추천)' },
  { value: 'Noto Sans KR', label: 'Noto Sans KR' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Comic Sans MS', label: 'Comic Sans MS' },
];

const PRESET_COLORS = [
  '#FFFFFF', // White
  '#FFD700', // Gold
  '#87CEEB', // Sky Blue
  '#FF69B4', // Hot Pink
  '#00FF00', // Lime
  '#FF4500', // Orange Red
  '#9370DB', // Medium Purple
  '#00CED1', // Dark Turquoise
];

export default function TextCustomizer() {
  const [settings, setSettings] = useState<TextSettings>(DEFAULT_SETTINGS);
  const [previewText, setPreviewText] = useState({
    artist: '星野源 (HOSHINOGEN)',
    title: '恋 (KOI)',
    original: '夫婦を超えてゆけ',
    translation: 'Go beyond being a married couple',
  });
  
  // Load saved settings
  useEffect(() => {
    const saved = localStorage.getItem('obs_text_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, []);
  
  // Save settings to localStorage
  const saveSettings = () => {
    localStorage.setItem('obs_text_settings', JSON.stringify(settings));
    toast.success('텍스트 설정이 저장되었습니다!');
  };
  
  // Reset to defaults
  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem('obs_text_settings', JSON.stringify(DEFAULT_SETTINGS));
    toast.info('기본 설정으로 초기화되었습니다');
  };
  
  // Copy OBS URL with current settings
  const copyOBSUrl = () => {
    const baseUrl = window.location.origin + '/obs/overlay-enhanced';
    const params = new URLSearchParams({
      chromaKey: '#00FF00',
    });
    
    const url = `${baseUrl}?${params.toString()}`;
    navigator.clipboard.writeText(url);
    toast.success('OBS URL이 복사되었습니다!');
  };
  
  // Generate text shadow
  const generateShadow = (intensity: number): string => {
    const shadows = [];
    for (let i = 1; i <= intensity; i++) {
      const opacity = 0.9 - (i * 0.1);
      shadows.push(`0 0 ${i * 5}px rgba(0,0,0,${opacity})`);
    }
    shadows.push('2px 2px 4px rgba(0,0,0,1)');
    return shadows.join(', ');
  };
  
  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            텍스트 커스터마이징
          </CardTitle>
          <CardDescription>
            OBS 오버레이의 텍스트 스타일을 세밀하게 조정할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="size" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="size">크기</TabsTrigger>
              <TabsTrigger value="color">색상</TabsTrigger>
              <TabsTrigger value="style">스타일</TabsTrigger>
              <TabsTrigger value="preview">미리보기</TabsTrigger>
            </TabsList>
            
            {/* Size Settings */}
            <TabsContent value="size" className="space-y-4">
              <div className="space-y-2">
                <Label>원본 가사 크기: {settings.originalSize}px</Label>
                <Slider
                  value={[settings.originalSize]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, originalSize: value }))}
                  min={60}
                  max={200}
                  step={5}
                />
              </div>
              
              <div className="space-y-2">
                <Label>번역 가사 크기: {settings.translationSize}px</Label>
                <Slider
                  value={[settings.translationSize]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, translationSize: value }))}
                  min={60}
                  max={200}
                  step={5}
                />
              </div>
              
              <div className="space-y-2">
                <Label>줄 간격: {settings.lineSpacing}px</Label>
                <Slider
                  value={[settings.lineSpacing]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, lineSpacing: value }))}
                  min={10}
                  max={100}
                  step={5}
                />
              </div>
              
              <div className="space-y-2">
                <Label>글자 간격: {settings.letterSpacing}em</Label>
                <Slider
                  value={[settings.letterSpacing * 100]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, letterSpacing: value / 100 }))}
                  min={-5}
                  max={10}
                  step={1}
                />
              </div>
            </TabsContent>
            
            {/* Color Settings */}
            <TabsContent value="color" className="space-y-4">
              <div className="space-y-2">
                <Label>원본 가사 색상</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.originalColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, originalColor: e.target.value }))}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={settings.originalColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, originalColor: e.target.value }))}
                    className="flex-1"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setSettings(prev => ({ ...prev, originalColor: color }))}
                      className="w-8 h-8 rounded border-2 border-gray-300"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>번역 가사 색상</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.translationColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, translationColor: e.target.value }))}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={settings.translationColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, translationColor: e.target.value }))}
                    className="flex-1"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setSettings(prev => ({ ...prev, translationColor: color }))}
                      className="w-8 h-8 rounded border-2 border-gray-300"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>
            
            {/* Style Settings */}
            <TabsContent value="style" className="space-y-4">
              <div className="space-y-2">
                <Label>폰트</Label>
                <Select
                  value={settings.fontFamily}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, fontFamily: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map(font => (
                      <SelectItem key={font.value} value={font.value}>
                        {font.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>글자 굵기: {settings.fontWeight}</Label>
                <Slider
                  value={[settings.fontWeight]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, fontWeight: value }))}
                  min={100}
                  max={900}
                  step={100}
                />
              </div>
              
              <div className="space-y-2">
                <Label>그림자 강도: {settings.shadowIntensity}</Label>
                <Slider
                  value={[settings.shadowIntensity]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, shadowIntensity: value }))}
                  min={0}
                  max={10}
                  step={1}
                />
              </div>
              
              <div className="space-y-2">
                <Label>정렬</Label>
                <Select
                  value={settings.alignment}
                  onValueChange={(value: 'left' | 'center' | 'right') => 
                    setSettings(prev => ({ ...prev, alignment: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">왼쪽</SelectItem>
                    <SelectItem value="center">가운데</SelectItem>
                    <SelectItem value="right">오른쪽</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            
            {/* Preview */}
            <TabsContent value="preview" className="space-y-4">
              <div 
                className="bg-green-500 p-8 rounded-lg min-h-[400px] flex flex-col items-center justify-center"
                style={{ backgroundColor: '#00FF00' }}
              >
                <div className="text-center mb-8">
                  <div 
                    style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: settings.originalColor,
                      textShadow: generateShadow(settings.shadowIntensity),
                      fontFamily: settings.fontFamily,
                    }}
                  >
                    {previewText.artist}
                  </div>
                  <div 
                    style={{
                      fontSize: '20px',
                      color: settings.originalColor,
                      textShadow: generateShadow(settings.shadowIntensity),
                      fontFamily: settings.fontFamily,
                      opacity: 0.9,
                    }}
                  >
                    {previewText.title}
                  </div>
                </div>
                
                <div style={{ textAlign: settings.alignment, width: '100%' }}>
                  <div
                    style={{
                      fontSize: `${settings.originalSize * 0.5}px`,
                      fontWeight: settings.fontWeight,
                      color: settings.originalColor,
                      textShadow: generateShadow(settings.shadowIntensity),
                      fontFamily: settings.fontFamily,
                      letterSpacing: `${settings.letterSpacing}em`,
                      marginBottom: `${settings.lineSpacing}px`,
                    }}
                  >
                    {previewText.original}
                  </div>
                  
                  <div
                    style={{
                      fontSize: `${settings.translationSize * 0.5}px`,
                      fontWeight: settings.fontWeight - 200,
                      color: settings.translationColor,
                      textShadow: generateShadow(settings.shadowIntensity - 2),
                      fontFamily: settings.fontFamily,
                      letterSpacing: `${settings.letterSpacing}em`,
                    }}
                  >
                    {previewText.translation}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder="원본 가사 테스트"
                  value={previewText.original}
                  onChange={(e) => setPreviewText(prev => ({ ...prev, original: e.target.value }))}
                />
                <Input
                  placeholder="번역 가사 테스트"
                  value={previewText.translation}
                  onChange={(e) => setPreviewText(prev => ({ ...prev, translation: e.target.value }))}
                />
              </div>
            </TabsContent>
          </Tabs>
          
          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button onClick={resetSettings} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              초기화
            </Button>
            <Button onClick={copyOBSUrl} variant="outline">
              <Copy className="w-4 h-4 mr-2" />
              OBS URL 복사
            </Button>
            <Button onClick={saveSettings}>
              <Save className="w-4 h-4 mr-2" />
              설정 저장
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}