export interface WordTiming {
  text: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface LyricLine {
  id: string;
  timestamp: number;
  text: string;
  words: WordTiming[];
  duration?: number;
  translation?: string;
}

export interface Line {
  timestamp: number;
  text: string;
  words?: WordTiming[] | null;
  duration?: number;
}

export interface ParsedLRC {
  lines: LyricLine[];
  totalDuration: number;
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    by?: string;
    offset?: number;
  };
}

export interface LRCMetadata {
  title?: string;
  artist?: string;
  album?: string;
  by?: string;
  offset?: number;
  [key: string]: string | number | undefined;
}