/**
 * LRC Provider Types
 */

export interface SongQuery {
  title: string;
  artist: string;
  album?: string;
  duration?: number; // in milliseconds
  isrc?: string; // International Standard Recording Code
  spotifyId?: string;
  youtubeId?: string;
  audioUrl?: string;
}

export interface LRCSearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  hasLyrics: boolean;
  hasWordTiming: boolean;
  hasSyncedLyrics: boolean;
  provider: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface LRCProvider {
  name: string;
  priority: number;
  confidence: number; // Base confidence score 0-1
  isAvailable(): Promise<boolean>;
  searchLRC(query: SongQuery): Promise<LRCSearchResult[]>;
  fetchLRC(lrcId: string): Promise<string>;
}

export interface LRCFetchResult {
  success: boolean;
  lrc?: string;
  source?: string;
  error?: string;
  fallback?: 'manual' | 'ai-generate';
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  rateLimit?: {
    requests: number;
    window: number; // in seconds
  };
}

// Scored result after confidence calculation
export interface ScoredLRCResult extends LRCSearchResult {
  finalScore: number;
  scoreBreakdown: {
    titleMatch: number;
    artistMatch: number;
    durationMatch: number;
    hasWordTiming: number;
    providerConfidence: number;
  };
}