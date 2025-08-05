/**
 * React hook for LRC fetching functionality
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { LRCFetcherManager } from '../lrc-fetcher-manager';
import { ScoredLRCResult, LRCFetchResult } from '../types/provider.types';

interface UseLRCFetcherOptions {
  autoFetch?: boolean;
  cacheResults?: boolean;
  onSuccess?: (result: LRCFetchResult) => void;
  onError?: (error: Error) => void;
}

interface UseLRCFetcherReturn {
  // State
  isSearching: boolean;
  isFetching: boolean;
  searchResults: ScoredLRCResult[];
  selectedResult: ScoredLRCResult | null;
  fetchedLRC: string | null;
  error: Error | null;
  
  // Actions
  search: (input: string) => Promise<void>;
  selectResult: (result: ScoredLRCResult) => void;
  fetchLRC: (result?: ScoredLRCResult) => Promise<void>;
  autoFetch: (input: string) => Promise<void>;
  clearResults: () => void;
  clearError: () => void;
}

export function useLRCFetcher(options: UseLRCFetcherOptions = {}): UseLRCFetcherReturn {
  const { autoFetch = false, cacheResults = true, onSuccess, onError } = options;
  
  // State
  const [isSearching, setIsSearching] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [searchResults, setSearchResults] = useState<ScoredLRCResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<ScoredLRCResult | null>(null);
  const [fetchedLRC, setFetchedLRC] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  // Refs
  const fetcherRef = useRef<LRCFetcherManager | null>(null);
  
  // Initialize fetcher
  useEffect(() => {
    fetcherRef.current = new LRCFetcherManager();
    
    return () => {
      // Cleanup if needed
      fetcherRef.current = null;
    };
  }, []);
  
  // Search for lyrics
  const search = useCallback(async (input: string) => {
    if (!fetcherRef.current) return;
    
    setIsSearching(true);
    setError(null);
    setSearchResults([]);
    setSelectedResult(null);
    setFetchedLRC(null);
    
    try {
      const results = await fetcherRef.current.searchSong(input);
      setSearchResults(results);
      
      // Auto-select if only one high-confidence result
      if (results.length === 1 && results[0].finalScore > 0.9) {
        setSelectedResult(results[0]);
        
        if (autoFetch) {
          await fetchLRC(results[0]);
        }
      }
      
      console.log(`Search complete: Found ${results.length} result(s)`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Search failed');
      setError(error);
      onError?.(error);
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [autoFetch, onError]);
  
  // Select a search result
  const selectResult = useCallback((result: ScoredLRCResult) => {
    setSelectedResult(result);
    setFetchedLRC(null);
  }, []);
  
  // Fetch LRC content
  const fetchLRC = useCallback(async (result?: ScoredLRCResult) => {
    if (!fetcherRef.current) return;
    
    const targetResult = result || selectedResult;
    if (!targetResult) {
      setError(new Error('No result selected'));
      return;
    }
    
    setIsFetching(true);
    setError(null);
    
    try {
      const fetchResult = await fetcherRef.current.fetchBestMatch([targetResult]);
      
      if (fetchResult.success && fetchResult.lrc) {
        setFetchedLRC(fetchResult.lrc);
        onSuccess?.(fetchResult);
        console.log(`Lyrics fetched successfully from ${fetchResult.source}`);
      } else {
        throw new Error(fetchResult.error || 'Failed to fetch lyrics');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Fetch failed');
      setError(error);
      onError?.(error);
      console.error('Fetch failed:', error);
    } finally {
      setIsFetching(false);
    }
  }, [selectedResult, onSuccess, onError]);
  
  // Auto fetch pipeline
  const autoFetchLRC = useCallback(async (input: string) => {
    if (!fetcherRef.current) return;
    
    setIsSearching(true);
    setIsFetching(true);
    setError(null);
    
    try {
      const result = await fetcherRef.current.autoFetchLRC(input);
      
      if (result.success && result.lrc) {
        setFetchedLRC(result.lrc);
        onSuccess?.(result);
        console.log(`Auto-fetch success: Lyrics from ${result.source}`);
      } else {
        throw new Error(result.error || 'Auto-fetch failed');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Auto-fetch failed');
      setError(error);
      onError?.(error);
      console.error('Auto-fetch failed:', error);
    } finally {
      setIsSearching(false);
      setIsFetching(false);
    }
  }, [onSuccess, onError]);
  
  // Clear results
  const clearResults = useCallback(() => {
    setSearchResults([]);
    setSelectedResult(null);
    setFetchedLRC(null);
    setError(null);
  }, []);
  
  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  return {
    // State
    isSearching,
    isFetching,
    searchResults,
    selectedResult,
    fetchedLRC,
    error,
    
    // Actions
    search,
    selectResult,
    fetchLRC,
    autoFetch: autoFetchLRC,
    clearResults,
    clearError,
  };
}