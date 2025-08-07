'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Music, Loader2, X, Database, Globe } from 'lucide-react';
import { debounce } from 'lodash';
import toast from 'react-hot-toast';

interface SearchBarProps {
  onSearchResult: (result: any) => void;
  isDarkMode: boolean;
}

export default function EnhancedSearchBar({ onSearchResult, isDarkMode }: SearchBarProps) {
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [combinedQuery, setCombinedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    artists: string[];
    titles: string[];
    combined: string[];
  }>({ artists: [], titles: [], combined: [] });
  const [activeField, setActiveField] = useState<'artist' | 'title' | 'combined' | null>(null);
  const [searchMode, setSearchMode] = useState<'separate' | 'combined'>('separate');
  
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete function
  const fetchSuggestions = useCallback(
    debounce(async (query: string, type: 'artist' | 'title' | 'all') => {
      if (query.length < 1) {
        setSuggestions({ artists: [], titles: [], combined: [] });
        return;
      }

      try {
        const response = await fetch(`/api/lyrics/autocomplete?query=${encodeURIComponent(query)}&type=${type}`);
        const data = await response.json();
        
        if (data.success) {
          setSuggestions({
            artists: data.artists || [],
            titles: data.titles || [],
            combined: data.suggestions || []
          });
        }
      } catch (error) {
        console.error('Autocomplete error:', error);
      }
    }, 300),
    []
  );

  // Handle input changes with autocomplete
  useEffect(() => {
    if (activeField === 'artist' && artist) {
      fetchSuggestions(artist, 'artist');
    } else if (activeField === 'title' && title) {
      fetchSuggestions(title, 'title');
    } else if (activeField === 'combined' && combinedQuery) {
      fetchSuggestions(combinedQuery, 'all');
    }
  }, [artist, title, combinedQuery, activeField, fetchSuggestions]);

  // Handle outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async () => {
    let searchArtist = artist;
    let searchTitle = title;
    
    // Parse combined query if in combined mode
    if (searchMode === 'combined' && combinedQuery) {
      const parts = combinedQuery.split(' - ');
      if (parts.length >= 2) {
        searchArtist = parts[0].trim();
        searchTitle = parts[1].trim();
      } else {
        searchArtist = combinedQuery;
        searchTitle = '';
      }
    }
    
    if (!searchArtist && !searchTitle) {
      toast.error('아티스트 또는 제목을 입력해주세요');
      return;
    }
    
    setIsSearching(true);
    setShowSuggestions(false);
    
    try {
      // First try database search
      const dbResponse = await fetch('/api/lyrics/db-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist: searchArtist, title: searchTitle })
      });
      
      const dbData = await dbResponse.json();
      
      if (dbData.success && dbData.results && dbData.results.length > 0) {
        toast.success('📚 DB에서 가사를 찾았습니다!', { icon: '✅' });
        onSearchResult(dbData.results[0]);
        return;
      }
      
      // If not in DB, search using multiple APIs
      toast.loading('🔍 여러 소스에서 검색 중...', { id: 'multi-search' });
      
      const response = await fetch('/api/lyrics/multi-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist: searchArtist, title: searchTitle })
      });
      
      const data = await response.json();
      toast.dismiss('multi-search');
      
      if (data.success && data.results && data.results.length > 0) {
        toast.success(`🎵 ${data.results[0].source}에서 가사를 찾았습니다!`);
        onSearchResult(data.results[0]);
      } else {
        toast.error('가사를 찾을 수 없습니다');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('검색 중 오류가 발생했습니다');
    } finally {
      setIsSearching(false);
    }
  };

  const applySuggestion = (suggestion: string, type: 'artist' | 'title' | 'combined') => {
    if (type === 'artist') {
      setArtist(suggestion);
    } else if (type === 'title') {
      // Remove artist part if it's included
      const titleOnly = suggestion.includes(' - ') 
        ? suggestion.split(' - ')[0] 
        : suggestion;
      setTitle(titleOnly);
    } else {
      setCombinedQuery(suggestion);
      // Also parse and set individual fields
      const parts = suggestion.split(' - ');
      if (parts.length >= 2) {
        setArtist(parts[0].trim());
        setTitle(parts[1].trim());
      }
    }
    setShowSuggestions(false);
  };

  return (
    <div className={`${
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'
    } rounded-2xl shadow-sm border p-4 relative`} ref={searchRef}>
      
      {/* Search Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSearchMode('separate')}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            searchMode === 'separate'
              ? 'bg-blue-500 text-white'
              : isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          분리 검색
        </button>
        <button
          onClick={() => setSearchMode('combined')}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            searchMode === 'combined'
              ? 'bg-blue-500 text-white'
              : isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          통합 검색
        </button>
      </div>
      
      {searchMode === 'separate' ? (
        <div className="space-y-3">
          {/* Artist Input */}
          <div className="relative">
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              onFocus={() => {
                setActiveField('artist');
                setShowSuggestions(true);
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="🎤 아티스트명"
              className={`w-full px-4 py-3 rounded-xl ${
                isDarkMode 
                  ? 'bg-gray-700 text-white placeholder-gray-400' 
                  : 'bg-slate-50 text-slate-800 placeholder-slate-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {artist && (
              <button
                onClick={() => setArtist('')}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                  isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Title Input */}
          <div className="relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => {
                setActiveField('title');
                setShowSuggestions(true);
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="🎵 곡 제목"
              className={`w-full px-4 py-3 rounded-xl ${
                isDarkMode 
                  ? 'bg-gray-700 text-white placeholder-gray-400' 
                  : 'bg-slate-50 text-slate-800 placeholder-slate-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {title && (
              <button
                onClick={() => setTitle('')}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                  isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Combined Search Input */
        <div className="relative">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${
            isDarkMode ? 'text-gray-400' : 'text-slate-400'
          }`} />
          <input
            type="text"
            value={combinedQuery}
            onChange={(e) => setCombinedQuery(e.target.value)}
            onFocus={() => {
              setActiveField('combined');
              setShowSuggestions(true);
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="🎵 아티스트 - 제목 형식으로 입력"
            className={`w-full pl-12 pr-12 py-3 rounded-xl ${
              isDarkMode 
                ? 'bg-gray-700 text-white placeholder-gray-400' 
                : 'bg-slate-50 text-slate-800 placeholder-slate-400'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          {combinedQuery && (
            <button
              onClick={() => setCombinedQuery('')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      
      {/* Search Button */}
      <button
        onClick={handleSearch}
        disabled={isSearching}
        className="w-full mt-4 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
      >
        {isSearching ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            검색중...
          </>
        ) : (
          <>
            <Search className="w-5 h-5" />
            검색
          </>
        )}
      </button>
      
      {/* Suggestions Dropdown */}
      {showSuggestions && (
        (activeField === 'artist' && suggestions.artists.length > 0) ||
        (activeField === 'title' && suggestions.titles.length > 0) ||
        (activeField === 'combined' && suggestions.combined.length > 0)
      ) && (
        <div className={`absolute left-4 right-4 top-full mt-2 rounded-xl shadow-lg border ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-slate-200'
        } overflow-hidden z-10 max-h-64 overflow-y-auto`}>
          {activeField === 'artist' && suggestions.artists.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => applySuggestion(suggestion, 'artist')}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-200' 
                  : 'hover:bg-slate-50 text-slate-700'
              } ${idx !== 0 ? 'border-t ' + (isDarkMode ? 'border-gray-700' : 'border-slate-100') : ''}`}
            >
              <Database className="w-4 h-4 text-blue-500" />
              {suggestion}
            </button>
          ))}
          
          {activeField === 'title' && suggestions.titles.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => applySuggestion(suggestion, 'title')}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-200' 
                  : 'hover:bg-slate-50 text-slate-700'
              } ${idx !== 0 ? 'border-t ' + (isDarkMode ? 'border-gray-700' : 'border-slate-100') : ''}`}
            >
              <Database className="w-4 h-4 text-blue-500" />
              {suggestion}
            </button>
          ))}
          
          {activeField === 'combined' && suggestions.combined.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => applySuggestion(suggestion, 'combined')}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-200' 
                  : 'hover:bg-slate-50 text-slate-700'
              } ${idx !== 0 ? 'border-t ' + (isDarkMode ? 'border-gray-700' : 'border-slate-100') : ''}`}
            >
              <Database className="w-4 h-4 text-blue-500" />
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}