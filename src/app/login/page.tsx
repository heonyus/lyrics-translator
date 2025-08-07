'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (data.success) {
        // 쿠키 설정 (클라이언트 사이드)
        document.cookie = `auth=${password}; path=/; max-age=${60 * 60 * 24 * 30}`; // 30일
        router.push('/');
        router.refresh();
      } else {
        setError('비밀번호가 올바르지 않습니다.');
      }
    } catch (error) {
      setError('로그인 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 flex items-center justify-center">
      <div className="bg-black/50 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-2xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">
          🎤 가사 번역기
        </h1>
        <p className="text-gray-400 text-center mb-8">
          접근 권한이 필요합니다
        </p>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              비밀번호
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all"
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>
          
          {error && (
            <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 px-4 rounded-lg">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-black transition-all transform hover:scale-[1.02]"
          >
            로그인
          </button>
        </form>
        
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>허가된 사용자만 접근 가능합니다</p>
          <p className="mt-2">문의: lhe339@gmail.com</p>
        </div>
      </div>
    </div>
  );
}