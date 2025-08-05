/**
 * LRC Fetcher Domain
 * Provides automatic LRC file fetching from multiple sources
 */

// Types (explicit exports to avoid conflicts)
export type {
  LRCProvider,
  LRCSearchResult,
  ScoredLRCResult,
  LRCFetchResult,
  ProviderConfig
} from './types/provider.types';

// Schemas (explicit exports to avoid conflicts)
export {
  songQuerySchema,
  lrcSearchResultSchema,
  scoredLRCResultSchema,
  lrcFetchResultSchema,
  providerConfigSchema,
  lrcProviderSchema,
  songMetadataSchema,
  youtubeMetadataSchema,
  spotifyMetadataSchema,
  extractorResultSchema
} from './schemas/fetcher.schema';

export type {
  SongQuery,
  SongMetadata,
  YouTubeMetadata,
  SpotifyMetadata,
  ExtractorResult
} from './schemas/fetcher.schema';

// Providers
export { BaseProvider } from './providers/base-provider';
export { LRClibProvider } from './providers/lrclib-provider';
export { SpotifyProvider } from './providers/spotify-provider';
export { GeniusProvider } from './providers/genius-provider';
export { YouTubeProvider } from './providers/youtube-provider';

// Manager
export { LRCFetcherManager } from './lrc-fetcher-manager';

// Hooks
export { useLRCFetcher } from './hooks/useLRCFetcher';

// Default instance
import { LRCFetcherManager } from './lrc-fetcher-manager';
export const lrcFetcher = new LRCFetcherManager();