'use client';

import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* 헤더 */}
      <div className="text-center pt-20 pb-12">
        <h1 className="text-6xl font-bold mb-4">
          <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            🎤 Karaoke Live
          </span>
        </h1>
        <p className="text-xl text-gray-600">
          실시간 노래방 스트리밍을 위한 완벽한 솔루션
        </p>
      </div>

      {/* 메인 카드들 */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 gap-6">
          {/* 호스트 모드 */}
          <Link
            href="/host-v2"
            className="group relative overflow-hidden bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-400 opacity-10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            
            <div className="relative">
              <div className="text-4xl mb-4">🎙️</div>
              <h2 className="text-2xl font-bold mb-2">호스트 모드</h2>
              <p className="text-gray-600 mb-4">
                YouTube MR과 가사를 동기화하고 방송을 시작하세요
              </p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>✓ YouTube MR 연동</li>
                <li>✓ 실시간 싱크 조절</li>
                <li>✓ 다국어 번역 지원</li>
              </ul>
              <div className="mt-6 inline-flex items-center text-blue-500 font-semibold group-hover:translate-x-2 transition-transform">
                시작하기 →
              </div>
            </div>
          </Link>

          {/* 뷰어 모드 */}
          <Link
            href="/obs/viewer"
            className="group relative overflow-hidden bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400 to-blue-400 opacity-10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            
            <div className="relative">
              <div className="text-4xl mb-4">📺</div>
              <h2 className="text-2xl font-bold mb-2">OBS 오버레이</h2>
              <p className="text-gray-600 mb-4">
                크로마키 배경으로 방송에 가사를 오버레이하세요
              </p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>✓ 크로마키 지원</li>
                <li>✓ 커스텀 폰트 & 스타일</li>
                <li>✓ 실시간 동기화</li>
              </ul>
              <div className="mt-6 inline-flex items-center text-green-500 font-semibold group-hover:translate-x-2 transition-transform">
                설정하기 →
              </div>
            </div>
          </Link>
        </div>

        {/* 빠른 시작 가이드 */}
        <div className="mt-12 bg-white rounded-3xl shadow-lg p-8">
          <h3 className="text-xl font-bold mb-6 text-center">🚀 빠른 시작 가이드</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h4 className="font-semibold mb-2">호스트 모드 시작</h4>
              <p className="text-sm text-gray-600">
                YouTube MR URL을 입력하고 가사를 검색하세요
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <h4 className="font-semibold mb-2">싱크 조절</h4>
              <p className="text-sm text-gray-600">
                키보드로 가사 타이밍을 맞추세요 (←/→)
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold">3</span>
              </div>
              <h4 className="font-semibold mb-2">OBS 연동</h4>
              <p className="text-sm text-gray-600">
                브라우저 소스로 /obs/viewer를 추가하세요
              </p>
            </div>
          </div>
        </div>

        {/* 추가 링크들 */}
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/control"
            className="px-6 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            기존 컨트롤 →
          </Link>
          <Link
            href="/test-search"
            className="px-6 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            API 테스트 →
          </Link>
        </div>
      </div>
    </main>
  );
}