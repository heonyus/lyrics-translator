'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { supportedLanguages, languageInfo } from '@/domains/translation';

export default function OverlayHelpPage() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  const examples = [
    {
      title: '기본 사용법',
      url: '/overlay?q=Bohemian+Rhapsody+Queen',
      description: '노래 제목과 아티스트 이름으로 검색'
    },
    {
      title: 'YouTube URL',
      url: '/overlay?q=https://youtube.com/watch?v=fJ9rUzIMcZQ',
      description: 'YouTube 비디오 URL 직접 입력'
    },
    {
      title: '한국어 번역',
      url: '/overlay?q=Shape+of+You+Ed+Sheeran&lang=ko',
      description: '한국어로 번역'
    },
    {
      title: '사용자 정의 스타일',
      url: '/overlay?q=Imagine+John+Lennon&fontSize=40&color=%2300FF00&animation=slide',
      description: '녹색 색상, 큰 글꼴, 슬라이드 애니메이션'
    },
    {
      title: '수동 재생',
      url: '/overlay?q=Yesterday+Beatles&autoPlay=false',
      description: '자동 재생 비활성화'
    }
  ];
  
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">OBS 오버레이 설정 가이드</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>OBS에서 사용하는 방법</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2">
            <li>OBS에서 새로운 <strong>브라우저 소스</strong>를 추가하세요</li>
            <li>URL을 다음과 같이 설정하세요: <code className="bg-gray-100 px-2 py-1 rounded">{baseUrl}/overlay?q=노래_제목_입력</code></li>
            <li>너비: <strong>1920</strong>, 높이: <strong>1080</strong> (또는 스트림 해상도)로 설정</li>
            <li><strong>"소스가 보이지 않을 때 종료"</strong> 체크</li>
            <li><strong>"장면이 활성화될 때 브라우저 새로고침"</strong> 체크</li>
          </ol>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>URL 매개변수</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">매개변수</th>
                <th className="text-left p-2">설명</th>
                <th className="text-left p-2">기본값</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-2"><code>q</code> or <code>query</code></td>
                <td className="p-2">노래 검색어 또는 URL</td>
                <td className="p-2">필수</td>
              </tr>
              <tr className="border-b">
                <td className="p-2"><code>lang</code> or <code>targetLang</code></td>
                <td className="p-2">번역 대상 언어</td>
                <td className="p-2">en</td>
              </tr>
              <tr className="border-b">
                <td className="p-2"><code>sourceLang</code></td>
                <td className="p-2">원본 언어 (설정하지 않으면 자동 감지)</td>
                <td className="p-2">자동</td>
              </tr>
              <tr className="border-b">
                <td className="p-2"><code>fontSize</code></td>
                <td className="p-2">글꼴 크기 (픽셀)</td>
                <td className="p-2">32</td>
              </tr>
              <tr className="border-b">
                <td className="p-2"><code>color</code></td>
                <td className="p-2">하이라이트 색상 (hex)</td>
                <td className="p-2">#FFD700</td>
              </tr>
              <tr className="border-b">
                <td className="p-2"><code>animation</code></td>
                <td className="p-2">애니메이션 타입: fade, slide, glow</td>
                <td className="p-2">glow</td>
              </tr>
              <tr className="border-b">
                <td className="p-2"><code>autoPlay</code></td>
                <td className="p-2">자동 재생 시작</td>
                <td className="p-2">true</td>
              </tr>
              <tr className="border-b">
                <td className="p-2"><code>rate</code></td>
                <td className="p-2">재생 속도 (0.5-2.0)</td>
                <td className="p-2">1.0</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>지원 언어</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {supportedLanguages.map(lang => (
              <div key={lang} className="flex items-center gap-2">
                <code className="bg-gray-100 px-2 py-1 rounded text-sm">{lang}</code>
                <span className="text-sm">{languageInfo[lang].name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>URL 예시</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {examples.map((example, index) => (
            <div key={index} className="border rounded p-4">
              <h3 className="font-semibold mb-1">{example.title}</h3>
              <p className="text-sm text-gray-600 mb-2">{example.description}</p>
              <code className="block bg-gray-100 p-2 rounded text-sm mb-2 break-all">
                {baseUrl}{example.url}
              </code>
              <Link href={example.url} target="_blank">
                <Button size="sm">새 탭에서 테스트</Button>
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>팁</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2">
            <li>오버레이는 투명한 배경을 가지고 있어 스트림에 완벽하게 겹쳐집니다</li>
            <li>텍스트는 어떤 배경에서도 잘 보이도록 그림자 효과가 있습니다</li>
            <li>특수 문자는 URL 인코딩을 사용하세요 (예: 공백은 +로 변환)</li>
            <li>최상의 결과를 위해 동기화된 가사(LRC 형식)가 있는 노래를 사용하세요</li>
            <li>오버레이는 사용 가능한 최고의 가사 소스를 자동으로 선택합니다</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}