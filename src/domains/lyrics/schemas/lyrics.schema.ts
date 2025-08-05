/**
 * Zod schemas for lyrics domain validation
 */

import { z } from 'zod';

// Word timing schema
export const wordTimingSchema = z.object({
  word: z.string().min(1),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  duration: z.number().min(0)
}).refine(data => data.endTime >= data.startTime, {
  message: "종료 시간은 시작 시간보다 크거나 같아야 합니다"
}).refine(data => data.duration === data.endTime - data.startTime, {
  message: "지속 시간은 종료 시간 - 시작 시간과 같아야 합니다"
});

// Lyric line schema
export const lyricLineSchema = z.object({
  id: z.string().uuid(),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  text: z.string(),
  words: z.array(wordTimingSchema),
  translation: z.string().optional()
}).refine(data => data.endTime >= data.startTime, {
  message: "종료 시간은 시작 시간보다 크거나 같아야 합니다"
});

// LRC metadata schema
export const lrcMetadataSchema = z.object({
  title: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional(),
  author: z.string().optional(),
  length: z.string().optional(),
  by: z.string().optional(),
  offset: z.number().optional(),
  tool: z.string().optional(),
  version: z.string().optional()
});

// Parsed LRC schema
export const parsedLRCSchema = z.object({
  metadata: lrcMetadataSchema,
  lines: z.array(lyricLineSchema),
  totalDuration: z.number().min(0)
});

// LRC parse options schema
export const lrcParseOptionsSchema = z.object({
  strict: z.boolean().default(false),
  wordLevelTiming: z.boolean().default(true),
  encoding: z.string().default('utf-8')
});

// LRC parse result schema
export const lrcParseResultSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: parsedLRCSchema,
    warnings: z.array(z.string()).optional()
  }),
  z.object({
    success: z.literal(false),
    error: z.string()
  })
]);

// Lyrics playback state schema
export const lyricsPlaybackStateSchema = z.object({
  isPlaying: z.boolean(),
  currentTime: z.number().min(0),
  currentLineIndex: z.number().int().min(-1),
  currentWordIndex: z.number().int().min(-1),
  playbackRate: z.number().min(0.25).max(4.0).default(1.0)
});

// Lyrics display options schema
export const lyricsDisplayOptionsSchema = z.object({
  showTranslation: z.boolean().default(true),
  highlightColor: z.string().default('#FFD700'),
  fontSize: z.number().min(12).max(72).default(24),
  fontFamily: z.string().default('Arial'),
  lineHeight: z.number().min(1).max(3).default(1.5),
  animation: z.enum(['fade', 'slide', 'glow']).default('fade')
});

// Translation request schema
export const translationRequestSchema = z.object({
  text: z.string().min(1),
  sourceLang: z.string().length(2).optional(),
  targetLang: z.string().length(2),
  cacheKey: z.string().optional()
});

// Translation result schema
export const translationResultSchema = z.object({
  originalText: z.string(),
  translatedText: z.string(),
  sourceLang: z.string(),
  targetLang: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  cached: z.boolean().default(false)
});

// Type exports
export type WordTiming = z.infer<typeof wordTimingSchema>;
export type LyricLine = z.infer<typeof lyricLineSchema>;
export type LRCMetadata = z.infer<typeof lrcMetadataSchema>;
export type ParsedLRC = z.infer<typeof parsedLRCSchema>;
export type LRCParseOptions = z.infer<typeof lrcParseOptionsSchema>;
export type LRCParseResult = z.infer<typeof lrcParseResultSchema>;
export type LyricsPlaybackState = z.infer<typeof lyricsPlaybackStateSchema>;
export type LyricsDisplayOptions = z.infer<typeof lyricsDisplayOptionsSchema>;
export type TranslationRequest = z.infer<typeof translationRequestSchema>;
export type TranslationResult = z.infer<typeof translationResultSchema>;