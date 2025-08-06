'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Monitor, 
  Settings, 
  Music,
  Mic,
  Globe,
  Zap,
  Shield,
  ArrowRight,
  Youtube,
  Headphones,
  FileMusic,
  Layers
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('start');

  const features = [
    {
      icon: <Music className="w-8 h-8" />,
      title: '자동 가사 검색',
      description: 'YouTube, Spotify, Genius에서 자동으로 가사를 검색하고 동기화합니다'
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: '실시간 번역',
      description: 'GPT-4 기반 고품질 번역으로 20개 이상 언어를 지원합니다'
    },
    {
      icon: <Mic className="w-8 h-8" />,
      title: '노래방 스타일',
      description: '단어별 하이라이팅으로 따라 부르기 쉬운 노래방 모드'
    },
    {
      icon: <Monitor className="w-8 h-8" />,
      title: 'OBS 완벽 호환',
      description: '크로마키 배경으로 방송 화면에 자연스럽게 오버레이'
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: '스마트 캐싱',
      description: '한 번 번역한 가사는 저장되어 빠르게 재사용'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: '안전한 저장',
      description: 'Supabase를 통한 안전한 데이터 저장 및 관리'
    }
  ];

  const quickStartSteps = [
    {
      step: 1,
      title: '가사 검색',
      description: '노래 제목이나 YouTube URL로 검색',
      icon: <Youtube className="w-6 h-6" />
    },
    {
      step: 2,
      title: 'OBS 설정',
      description: '브라우저 소스 추가 및 크로마키 설정',
      icon: <Monitor className="w-6 h-6" />
    },
    {
      step: 3,
      title: '방송 시작',
      description: '실시간 가사와 번역이 화면에 표시',
      icon: <Play className="w-6 h-6" />
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent mb-4">
            Lyrics Translator
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8">
            OBS 스트리밍을 위한 실시간 가사 번역 오버레이
          </p>
          
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              size="lg"
              onClick={() => router.push('/control')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Play className="mr-2 w-5 h-5" />
              컨트롤 패널 시작
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push('/obs/control')}
              className="border-purple-400 text-purple-400 hover:bg-purple-400/10"
            >
              <Monitor className="mr-2 w-5 h-5" />
              OBS 컨트롤러
            </Button>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index, duration: 0.5 }}
            >
              <Card className="bg-black/40 backdrop-blur-lg border-purple-500/30 hover:border-purple-400/50 transition-all h-full">
                <CardHeader>
                  <div className="text-purple-400 mb-2">{feature.icon}</div>
                  <CardTitle className="text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Quick Start Guide */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-black/40 backdrop-blur-lg">
              <TabsTrigger value="start">빠른 시작</TabsTrigger>
              <TabsTrigger value="obs">OBS 설정</TabsTrigger>
              <TabsTrigger value="shortcuts">단축키</TabsTrigger>
            </TabsList>

            <TabsContent value="start" className="mt-6">
              <Card className="bg-black/40 backdrop-blur-lg border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">3단계로 시작하기</CardTitle>
                  <CardDescription className="text-gray-400">
                    간단한 설정으로 바로 시작할 수 있습니다
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {quickStartSteps.map((step) => (
                      <div key={step.step} className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                          {step.step}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-purple-400">{step.icon}</span>
                            <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                          </div>
                          <p className="text-gray-400">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-8 flex gap-4">
                    <Button
                      onClick={() => router.push('/control')}
                      className="bg-gradient-to-r from-purple-600 to-pink-600"
                    >
                      시작하기
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="obs" className="mt-6">
              <Card className="bg-black/40 backdrop-blur-lg border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">OBS 브라우저 소스 설정</CardTitle>
                  <CardDescription className="text-gray-400">
                    OBS Studio에서 가사 오버레이를 추가하는 방법
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-purple-400">1. 브라우저 소스 추가</h3>
                    <ul className="space-y-2 text-gray-300 ml-4">
                      <li>• OBS에서 소스 추가 → 브라우저</li>
                      <li>• URL: <code className="bg-black/60 px-2 py-1 rounded">http://localhost:3000/obs</code></li>
                      <li>• 너비: 1920, 높이: 1080</li>
                      <li>• FPS: 30 이상 권장</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-purple-400">2. 크로마키 필터 적용</h3>
                    <ul className="space-y-2 text-gray-300 ml-4">
                      <li>• 브라우저 소스 우클릭 → 필터</li>
                      <li>• 효과 필터 추가 → 크로마키</li>
                      <li>• 키 색상: 녹색 (#00FF00)</li>
                      <li>• 유사성/부드러움 조절로 최적화</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-purple-400">3. 컨트롤 패널 연결</h3>
                    <ul className="space-y-2 text-gray-300 ml-4">
                      <li>• 별도 브라우저에서 컨트롤 패널 열기</li>
                      <li>• 가사 검색 및 선택</li>
                      <li>• 재생 컨트롤로 동기화 관리</li>
                    </ul>
                  </div>

                  <div className="mt-6 p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                    <p className="text-sm text-purple-300">
                      💡 팁: OBS 오버레이와 컨트롤 패널은 localStorage로 통신하므로 
                      같은 브라우저/컴퓨터에서 실행되어야 합니다.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="shortcuts" className="mt-6">
              <Card className="bg-black/40 backdrop-blur-lg border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">키보드 단축키</CardTitle>
                  <CardDescription className="text-gray-400">
                    빠른 컨트롤을 위한 단축키 목록
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-purple-400 mb-3">재생 컨트롤</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <kbd className="px-2 py-1 bg-black/60 rounded text-purple-300">Space</kbd>
                          <span className="text-gray-300">재생/일시정지</span>
                        </div>
                        <div className="flex justify-between">
                          <kbd className="px-2 py-1 bg-black/60 rounded text-purple-300">R</kbd>
                          <span className="text-gray-300">처음으로</span>
                        </div>
                        <div className="flex justify-between">
                          <kbd className="px-2 py-1 bg-black/60 rounded text-purple-300">ESC</kbd>
                          <span className="text-gray-300">정지</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-purple-400 mb-3">탐색 & 속도</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <kbd className="px-2 py-1 bg-black/60 rounded text-purple-300">←/→</kbd>
                          <span className="text-gray-300">5초 뒤/앞</span>
                        </div>
                        <div className="flex justify-between">
                          <kbd className="px-2 py-1 bg-black/60 rounded text-purple-300">↑/↓</kbd>
                          <span className="text-gray-300">속도 증가/감소</span>
                        </div>
                        <div className="flex justify-between">
                          <kbd className="px-2 py-1 bg-black/60 rounded text-purple-300">T</kbd>
                          <span className="text-gray-300">번역 토글</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                    <p className="text-sm text-purple-300">
                      💡 단축키는 컨트롤 패널과 OBS 오버레이 모두에서 작동합니다
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Footer Links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-12 flex justify-center gap-6 flex-wrap"
        >
          <Button
            variant="ghost"
            onClick={() => router.push('/control')}
            className="text-purple-400 hover:text-purple-300"
          >
            <Layers className="mr-2 w-4 h-4" />
            전체 컨트롤 패널
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push('/obs/control')}
            className="text-purple-400 hover:text-purple-300"
          >
            <Monitor className="mr-2 w-4 h-4" />
            OBS 전용 컨트롤
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push('/overlay/simple')}
            className="text-purple-400 hover:text-purple-300"
          >
            <FileMusic className="mr-2 w-4 h-4" />
            심플 오버레이
          </Button>
        </motion.div>
      </div>
    </div>
  );
}