// Lyrics domain types

/**
 * LRC file metadata
 */
export interface LRCMetadata {
  title?: string;          // [ti:Song Title]
  artist?: string;         // [ar:Artist Name]
  album?: string;          // [al:Album Name]
  author?: string;         // [au:Lyrics Author]
  length?: string;         // [length:03:50]
  by?: string;            // [by:Creator]
  offset?: number;        // [offset:+/-ms]
  tool?: string;          // [tool:Tool Name]
  version?: string;       // [ve:Version]
}

/**
 * Individual word with timing
 */
export interface WordTiming {
  word: string;
  startTime: number;  // in milliseconds
  endTime: number;    // in milliseconds
  duration: number;   // in milliseconds
}

/**
 * Single lyric line with timing
 */
export interface LyricLine {
  id: string;
  startTime: number;      // in milliseconds
  endTime: number;        // in milliseconds
  text: string;           // full line text
  words: WordTiming[];    // word-level timing
  translation?: string;   // translated text
}

/**
 * Complete parsed LRC data
 */
export interface ParsedLRC {
  metadata: LRCMetadata;
  lines: LyricLine[];
  totalDuration: number;  // in milliseconds
}

/**
 * LRC parse options
 */
export interface LRCParseOptions {
  strict?: boolean;           // strict parsing mode
  wordLevelTiming?: boolean;  // parse word-level timing
  encoding?: string;          // file encoding
}

/**
 * LRC parse result
 */
export interface LRCParseResult {
  success: boolean;
  data?: ParsedLRC;
  error?: string;
  warnings?: string[];
}

/**
 * Current playback state
 */
export interface LyricsPlaybackState {
  currentTime: number;        // in milliseconds
  currentLineIndex: number;
  currentWordIndex: number;
  currentLine?: LyricLine;
  currentWord?: WordTiming;
  nextLine?: LyricLine;
  progress: number;           // 0-100
  isPlaying: boolean;         // playback state
  playbackRate: number;       // playback speed
}

/**
 * Lyrics display options
 */
export interface LyricsDisplayOptions {
  showTranslation: boolean;
  highlightMode: 'word' | 'line' | 'both';
  previewNextLine: boolean;
  animationDuration: number;  // in milliseconds
}

/**
 * Translation request
 */
export interface TranslationRequest {
  text: string;
  sourceLang?: string;
  targetLang: string;
  lineId?: string;
}

/**
 * Translation result
 */
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  confidence?: number;
  cached: boolean;
}