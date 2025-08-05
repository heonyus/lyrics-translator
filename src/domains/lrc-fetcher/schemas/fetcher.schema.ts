/**
 * Zod schemas for LRC fetcher domain validation
 */

import { z } from 'zod';

// Song query schema
export const songQuerySchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().optional(),
  duration: z.number().min(0).optional(),
  isrc: z.string().optional(),
  spotifyId: z.string().optional(),
  youtubeId: z.string().optional(),
  audioUrl: z.string().url().optional()
});

// LRC search result schema
export const lrcSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  duration: z.number().min(0).optional(),
  hasLyrics: z.boolean(),
  hasWordTiming: z.boolean(),
  hasSyncedLyrics: z.boolean(),
  provider: z.string(),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.any()).optional()
});

// Scored LRC result schema
export const scoredLRCResultSchema = lrcSearchResultSchema.extend({
  finalScore: z.number().min(0).max(1),
  scoreBreakdown: z.object({
    titleMatch: z.number().min(0).max(1),
    artistMatch: z.number().min(0).max(1),
    durationMatch: z.number().min(0).max(1),
    hasWordTiming: z.number().min(0).max(1),
    providerConfidence: z.number().min(0).max(1)
  })
});

// LRC fetch result schema
export const lrcFetchResultSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    lrc: z.string(),
    source: z.string()
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
    fallback: z.enum(['manual', 'ai-generate']).optional()
  })
]);

// Provider config schema
export const providerConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  timeout: z.number().min(1000).max(60000).default(10000),
  rateLimit: z.object({
    requests: z.number().min(1),
    window: z.number().min(1) // in seconds
  }).optional()
});

// LRC provider interface schema
export const lrcProviderSchema = z.object({
  name: z.string(),
  priority: z.number().min(1).max(10),
  confidence: z.number().min(0).max(1)
});

// Metadata schemas
export const songMetadataSchema = z.object({
  title: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  duration: z.number().min(0).optional(),
  releaseDate: z.string().optional(),
  genre: z.array(z.string()).optional(),
  isrc: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  audioUrl: z.string().url().optional()
});

export const youtubeMetadataSchema = songMetadataSchema.extend({
  videoId: z.string(),
  channelId: z.string(),
  channelName: z.string(),
  viewCount: z.number().optional(),
  likeCount: z.number().optional(),
  description: z.string().optional(),
  uploadDate: z.string()
});

export const spotifyMetadataSchema = songMetadataSchema.extend({
  trackId: z.string(),
  albumId: z.string().optional(),
  artistIds: z.array(z.string()),
  popularity: z.number().min(0).max(100).optional(),
  previewUrl: z.string().url().optional(),
  explicit: z.boolean(),
  availableMarkets: z.array(z.string()).optional()
});

export const extractorResultSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    metadata: songMetadataSchema,
    source: z.enum(['youtube', 'spotify', 'text', 'unknown'])
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
    source: z.enum(['youtube', 'spotify', 'text', 'unknown'])
  })
]);

// Type exports
export type SongQuery = z.infer<typeof songQuerySchema>;
export type LRCSearchResult = z.infer<typeof lrcSearchResultSchema>;
export type ScoredLRCResult = z.infer<typeof scoredLRCResultSchema>;
export type LRCFetchResult = z.infer<typeof lrcFetchResultSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type LRCProvider = z.infer<typeof lrcProviderSchema>;
export type SongMetadata = z.infer<typeof songMetadataSchema>;
export type YouTubeMetadata = z.infer<typeof youtubeMetadataSchema>;
export type SpotifyMetadata = z.infer<typeof spotifyMetadataSchema>;
export type ExtractorResult = z.infer<typeof extractorResultSchema>;