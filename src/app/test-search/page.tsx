'use client';

import { useState } from 'react';

export default function TestSearchPage() {
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const testLRClib = async () => {
    setLoading(true);
    setError('');
    setResults([]);

    try {
      // Test 1: Direct API call
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${title}`)}`;
      console.log('Testing URL:', searchUrl);
      
      const response = await fetch(searchUrl);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Search results:', data);
      setResults(data);
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testYouTube = async () => {
    setLoading(true);
    setError('');
    setResults([]);

    try {
      const response = await fetch('/api/youtube/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: { artist, title } })
      });
      
      console.log('YouTube API Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('YouTube search results:', data);
      setResults(data.data || []);
    } catch (err: any) {
      console.error('YouTube search error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">API Test Page</h1>
      
      <div className="space-y-4 mb-6">
        <input
          type="text"
          placeholder="Artist (e.g., IU, 아이유)"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          placeholder="Title (e.g., Good Day, 좋은날)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={testLRClib}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test LRClib API
        </button>
        <button
          onClick={testYouTube}
          disabled={loading}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
        >
          Test YouTube API
        </button>
      </div>

      {loading && <p className="text-gray-600">Loading...</p>}
      
      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded mb-4">
          Error: {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Results ({results.length}):</h2>
          {results.map((result, index) => (
            <div key={index} className="p-4 border rounded">
              <pre className="text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}