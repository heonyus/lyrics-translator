/**
 * Lyrics Domain
 * Core lyrics parsing, management, and playback functionality
 */

// Types (explicit exports to avoid conflicts)
export type {
  LRCMetadata,
  WordTiming,
  LyricLine,
  ParsedLRC,
  LRCParseOptions,
  LRCParseResult,
  LyricsPlaybackState,
  LyricsDisplayOptions,
  TranslationRequest,
  TranslationResult
} from './types/lyrics.types';

// Schemas (explicit exports to avoid conflicts)
export {
  lrcMetadataSchema,
  wordTimingSchema,
  lyricLineSchema,
  parsedLRCSchema,
  lrcParseOptionsSchema,
  lrcParseResultSchema,
  lyricsPlaybackStateSchema,
  lyricsDisplayOptionsSchema
} from './schemas/lyrics.schema';

// Parser
export { LRCParser, lrcParser } from './parser/lrc-parser';
export * from './parser/parser-utils';

// Hooks
export { useLyrics } from './hooks/useLyrics';

// Default parser instance
export { lrcParser as defaultLRCParser } from './parser/lrc-parser';