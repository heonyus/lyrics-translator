'use client';

import React, { useState } from 'react';
import { AILyricsService } from '@/services/ai-lyrics-service';

export default function TestAI() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [artist, setArtist] = useState('샘킴');
  const [title, setTitle] = useState('Make Up');

  const testSearch = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const service = new AILyricsService();
      console.log('Testing AI search...');
      const searchResult = await service.searchLyrics(artist, title);
      console.log('Result:', searchResult);
      setResult(searchResult);
    } catch (error) {
      console.error('Error:', error);
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">AI 가사 검색 테스트</h1>
      
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="아티스트"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          className="px-3 py-2 border rounded"
        />
        <input
          type="text"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="px-3 py-2 border rounded"
        />
        <button
          onClick={testSearch}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? '검색중...' : '테스트'}
        </button>
      </div>

      {result && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}