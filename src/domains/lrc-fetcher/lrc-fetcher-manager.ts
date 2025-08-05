/**
 * LRC Fetcher Manager
 * Orchestrates multiple LRC providers and selects the best result
 */

import { LRCProvider, LRCSearchResult, SongQuery, LRCFetchResult, ScoredLRCResult } from './types/provider.types';
import { LRClibProvider } from './providers/lrclib-provider';
import { SpotifyProvider } from './providers/spotify-provider';
import { GeniusProvider } from './providers/genius-provider';
import { YouTubeProvider } from './providers/youtube-provider';
import { MetadataService } from '../metadata/metadata-service';

interface CachedLRC {
  results: ScoredLRCResult[];
  timestamp: number;
  query: SongQuery;
}

export class LRCFetcherManager {
  private providers: Map<string, LRCProvider> = new Map();
  private cache: Map<string, CachedLRC> = new Map();
  private metadataService: MetadataService;
  private cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  
  constructor() {
    this.metadataService = new MetadataService();
    this.initializeProviders();
  }
  
  private initializeProviders(): void {
    // Initialize providers with their configurations
    this.providers.set('lrclib', new LRClibProvider());
    this.providers.set('spotify', new SpotifyProvider());
    this.providers.set('youtube', new YouTubeProvider());
    
    // Genius requires API key from environment
    const geniusApiKey = process.env.NEXT_PUBLIC_GENIUS_API_KEY;
    if (geniusApiKey) {
      this.providers.set('genius', new GeniusProvider({ apiKey: geniusApiKey }));
    }
  }
  
  /**
   * Search for lyrics using all available providers
   */
  async searchSong(input: string): Promise<ScoredLRCResult[]> {
    // Extract metadata from input
    const extractResult = await this.metadataService.extractMetadata(input);
    if (!extractResult.success || !extractResult.metadata) {
      throw new Error('Failed to extract metadata from input');
    }
    
    const query = this.metadataService.metadataToSongQuery(extractResult.metadata);
    
    // Check cache
    const cacheKey = this.generateCacheKey(query);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('Returning cached results for:', query.title, query.artist);
      return cached.results;
    }
    
    // Search all providers in parallel
    const searchPromises = Array.from(this.providers.entries()).map(async ([name, provider]) => {
      try {
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
          console.log(`Provider ${name} is not available`);
          return [];
        }
        
        const results = await provider.searchLRC(query);
        console.log(`Provider ${name} found ${results.length} results`);
        return results;
      } catch (error) {
        console.error(`Provider ${name} search failed:`, error);
        return [];
      }
    });
    
    const allResults = await Promise.allSettled(searchPromises);
    
    // Flatten and score results
    const flatResults = allResults
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => (result as PromiseFulfilledResult<LRCSearchResult[]>).value);
    
    const scoredResults = this.calculateConfidenceScores(flatResults, query);
    
    // Cache results
    this.cache.set(cacheKey, {
      results: scoredResults,
      timestamp: Date.now(),
      query
    });
    
    return scoredResults;
  }
  
  /**
   * Fetch LRC content from the best matching result
   */
  async fetchBestMatch(results: ScoredLRCResult[]): Promise<LRCFetchResult> {
    if (results.length === 0) {
      return {
        success: false,
        error: 'No results found',
        fallback: 'manual'
      };
    }
    
    // Try results in order of confidence
    const sortedResults = [...results].sort((a, b) => b.finalScore - a.finalScore);
    
    for (const result of sortedResults) {
      try {
        const provider = this.providers.get(result.provider.toLowerCase());
        if (!provider) {
          continue;
        }
        
        const lrcContent = await provider.fetchLRC(result.id);
        
        return {
          success: true,
          lrc: lrcContent,
          source: result.provider
        };
      } catch (error) {
        console.error(`Failed to fetch from ${result.provider}:`, error);
        continue;
      }
    }
    
    // All providers failed
    const hasLyricsWithoutTiming = sortedResults.some(r => r.hasLyrics && !r.hasSyncedLyrics);
    
    return {
      success: false,
      error: 'Failed to fetch lyrics from all providers',
      fallback: hasLyricsWithoutTiming ? 'ai-generate' : 'manual'
    };
  }
  
  /**
   * Automatic fetch pipeline - search and get best result
   */
  async autoFetchLRC(input: string): Promise<LRCFetchResult> {
    try {
      const results = await this.searchSong(input);
      
      if (results.length === 0) {
        return {
          success: false,
          error: 'No lyrics found',
          fallback: 'manual'
        };
      }
      
      // Auto-select best result if confidence is high enough
      const bestResult = results[0];
      if (bestResult.finalScore > 0.8) {
        console.log(`Auto-selecting result with confidence ${bestResult.finalScore}`);
        return this.fetchBestMatch([bestResult]);
      }
      
      // Otherwise return all results for user selection
      return {
        success: false,
        error: 'Multiple results found, manual selection needed',
        fallback: 'manual'
      };
    } catch (error) {
      console.error('Auto-fetch failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallback: 'manual'
      };
    }
  }
  
  /**
   * Calculate confidence scores for search results
   */
  private calculateConfidenceScores(
    results: LRCSearchResult[], 
    query: SongQuery
  ): ScoredLRCResult[] {
    return results.map(result => {
      const provider = this.providers.get(result.provider.toLowerCase());
      const baseConfidence = provider?.confidence || 0.5;
      
      // Title matching (40% weight)
      const titleScore = this.calculateStringSimilarity(result.title, query.title) * 0.4;
      
      // Artist matching (30% weight)
      const artistScore = this.calculateStringSimilarity(result.artist, query.artist) * 0.3;
      
      // Provider confidence (15% weight)
      const providerScore = baseConfidence * 0.15;
      
      // Timing availability (10% weight)
      const timingScore = result.hasSyncedLyrics ? 0.1 : 0;
      
      // Duration matching (5% weight)
      let durationScore = 0.05; // Default if no duration
      if (query.duration && result.duration) {
        const durationDiff = Math.abs(query.duration - result.duration);
        if (durationDiff < 5000) { // Within 5 seconds
          durationScore = 0.05;
        } else if (durationDiff < 10000) { // Within 10 seconds
          durationScore = 0.03;
        } else {
          durationScore = 0.01;
        }
      }
      
      const finalScore = titleScore + artistScore + providerScore + timingScore + durationScore;
      
      return {
        ...result,
        finalScore: Math.min(finalScore, 1.0),
        scoreBreakdown: {
          titleMatch: titleScore / 0.4,
          artistMatch: artistScore / 0.3,
          durationMatch: durationScore / 0.05,
          hasWordTiming: result.hasWordTiming ? 1 : 0,
          providerConfidence: baseConfidence
        }
      };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }
  
  /**
   * String similarity calculation
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = this.normalizeString(str1);
    const s2 = this.normalizeString(str2);
    
    if (s1 === s2) return 1.0;
    
    // Levenshtein distance
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Generate cache key
   */
  private generateCacheKey(query: SongQuery): string {
    return `${query.artist}-${query.title}`.toLowerCase().replace(/\s+/g, '-');
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}