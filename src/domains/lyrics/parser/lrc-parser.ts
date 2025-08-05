import { 
  LRCMetadata, 
  WordTiming, 
  LyricLine, 
  ParsedLRC, 
  LRCParseOptions, 
  LRCParseResult 
} from '../types/lyrics.types';
import { v4 as uuidv4 } from 'uuid';

/**
 * LRC Parser - Handles both standard and extended LRC formats
 * Standard: [mm:ss.xx]lyrics text
 * Extended: [mm:ss.xx]<mm:ss.xx>word1 <mm:ss.xx>word2
 */
export class LRCParser {
  private options: LRCParseOptions;
  
  constructor(options: LRCParseOptions = {}) {
    this.options = {
      strict: false,
      wordLevelTiming: true,
      encoding: 'utf-8',
      ...options
    };
  }

  /**
   * Parse LRC content
   */
  parse(content: string): LRCParseResult {
    try {
      const lines = content.split(/\r?\n/);
      const metadata: LRCMetadata = {};
      const lyricLines: LyricLine[] = [];
      const warnings: string[] = [];

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Parse metadata tags
        if (this.isMetadataLine(trimmedLine)) {
          this.parseMetadata(trimmedLine, metadata);
          continue;
        }

        // Parse lyric lines
        const parsedLine = this.parseLyricLine(trimmedLine);
        if (parsedLine) {
          lyricLines.push(parsedLine);
        } else if (this.options.strict) {
          warnings.push(`Invalid line format: ${trimmedLine}`);
        }
      }

      // Sort lines by start time
      lyricLines.sort((a, b) => a.startTime - b.startTime);

      // Calculate end times and total duration
      this.calculateEndTimes(lyricLines);
      const totalDuration = lyricLines.length > 0 
        ? lyricLines[lyricLines.length - 1].endTime 
        : 0;

      return {
        success: true,
        data: {
          metadata,
          lines: lyricLines,
          totalDuration
        },
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error'
      };
    }
  }

  /**
   * Check if line is metadata
   */
  private isMetadataLine(line: string): boolean {
    return /^\[[a-zA-Z]+:.*\]$/.test(line);
  }

  /**
   * Parse metadata line
   */
  private parseMetadata(line: string, metadata: LRCMetadata): void {
    const match = line.match(/^\[([a-zA-Z]+):(.*)\]$/);
    if (!match) return;

    const [, tag, value] = match;
    const trimmedValue = value.trim();

    switch (tag.toLowerCase()) {
      case 'ti':
        metadata.title = trimmedValue;
        break;
      case 'ar':
        metadata.artist = trimmedValue;
        break;
      case 'al':
        metadata.album = trimmedValue;
        break;
      case 'au':
        metadata.author = trimmedValue;
        break;
      case 'length':
        metadata.length = trimmedValue;
        break;
      case 'by':
        metadata.by = trimmedValue;
        break;
      case 'offset':
        metadata.offset = parseInt(trimmedValue, 10);
        break;
      case 'tool':
        metadata.tool = trimmedValue;
        break;
      case 've':
        metadata.version = trimmedValue;
        break;
    }
  }

  /**
   * Parse lyric line with timing
   */
  private parseLyricLine(line: string): LyricLine | null {
    // Match standard format: [mm:ss.xx]lyrics
    const standardMatch = line.match(/^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/);
    if (!standardMatch) return null;

    const [, minutes, seconds, text] = standardMatch;
    const startTime = this.timeToMilliseconds(minutes, seconds);
    
    // If no text, skip
    if (!text.trim()) return null;

    const lyricLine: LyricLine = {
      id: uuidv4(),
      startTime,
      endTime: startTime + 3000, // Default 3 seconds, will be adjusted
      text: this.extractPlainText(text),
      words: []
    };

    // Parse word-level timing if enabled and present
    if (this.options.wordLevelTiming && text.includes('<')) {
      lyricLine.words = this.parseWordTimings(text, startTime);
    } else {
      // Create single word timing for the whole line
      lyricLine.words = [{
        word: lyricLine.text,
        startTime,
        endTime: startTime + 3000,
        duration: 3000
      }];
    }

    return lyricLine;
  }

  /**
   * Parse word-level timings from extended format
   */
  private parseWordTimings(text: string, lineStartTime: number): WordTiming[] {
    const words: WordTiming[] = [];
    const wordPattern = /<(\d{1,2}):(\d{2}(?:\.\d{1,3})?)>([^<]+)/g;
    let match;
    let lastEndTime = lineStartTime;

    while ((match = wordPattern.exec(text)) !== null) {
      const [, minutes, seconds, word] = match;
      const startTime = this.timeToMilliseconds(minutes, seconds);
      const trimmedWord = word.trim();
      
      if (trimmedWord) {
        words.push({
          word: trimmedWord,
          startTime,
          endTime: startTime + 500, // Default 500ms, will be adjusted
          duration: 500
        });
        lastEndTime = startTime;
      }
    }

    // If no word timings found, treat as single word
    if (words.length === 0) {
      const plainText = this.extractPlainText(text);
      words.push({
        word: plainText,
        startTime: lineStartTime,
        endTime: lineStartTime + 3000,
        duration: 3000
      });
    } else {
      // Adjust word end times based on next word start
      for (let i = 0; i < words.length - 1; i++) {
        words[i].endTime = words[i + 1].startTime;
        words[i].duration = words[i].endTime - words[i].startTime;
      }
      // Last word gets default duration
      const lastWord = words[words.length - 1];
      lastWord.endTime = lastWord.startTime + 1000;
      lastWord.duration = 1000;
    }

    return words;
  }

  /**
   * Extract plain text by removing timing tags
   */
  private extractPlainText(text: string): string {
    return text.replace(/<\d{1,2}:\d{2}(?:\.\d{1,3})?>/g, '').trim();
  }

  /**
   * Convert time to milliseconds
   */
  private timeToMilliseconds(minutes: string, seconds: string): number {
    const min = parseInt(minutes, 10);
    const sec = parseFloat(seconds);
    return (min * 60 + sec) * 1000;
  }

  /**
   * Calculate end times for lines based on next line start
   */
  private calculateEndTimes(lines: LyricLine[]): void {
    for (let i = 0; i < lines.length - 1; i++) {
      lines[i].endTime = lines[i + 1].startTime;
      
      // Update last word end time if needed
      const lastWord = lines[i].words[lines[i].words.length - 1];
      if (lastWord && lastWord.endTime > lines[i].endTime) {
        lastWord.endTime = lines[i].endTime;
        lastWord.duration = lastWord.endTime - lastWord.startTime;
      }
    }

    // Last line gets 5 seconds or until last word ends
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const lastWord = lastLine.words[lastLine.words.length - 1];
      lastLine.endTime = Math.max(
        lastLine.startTime + 5000,
        lastWord ? lastWord.endTime : lastLine.startTime + 5000
      );
    }
  }

  /**
   * Static method for quick parsing
   */
  static parse(content: string, options?: LRCParseOptions): LRCParseResult {
    const parser = new LRCParser(options);
    return parser.parse(content);
  }
}

// Export default parser instance
export const lrcParser = new LRCParser();