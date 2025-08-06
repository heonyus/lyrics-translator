/**
 * Text-based Metadata Parser
 * Handles plain text queries like "Artist - Song Title"
 */

import { MetadataExtractor, SongMetadata } from '../types/metadata.types';

export class TextParser implements MetadataExtractor {
  private readonly QUERY_PATTERNS = [
    // Artist - Title
    /^(.+?)\s*[-–]\s*(.+?)$/,
    // Title by Artist
    /^(.+?)\s+by\s+(.+?)$/i,
    // Artist: Title
    /^(.+?):\s*(.+?)$/,
    // Artist | Title
    /^(.+?)\s*\|\s*(.+?)$/,
    // "Title" Artist
    /^"(.+?)"\s+(.+?)$/,
    // Title (Artist)
    /^(.+?)\s*\((.+?)\)$/
  ];
  
  canHandle(input: string): boolean {
    // Handle any non-URL text input
    return !input.startsWith('http://') && 
           !input.startsWith('https://') && 
           !input.startsWith('spotify:') &&
           input.trim().length > 0;
  }
  
  async extract(input: string): Promise<SongMetadata> {
    const trimmedInput = input.trim();
    
    // Try to parse with patterns
    for (const pattern of this.QUERY_PATTERNS) {
      const match = trimmedInput.match(pattern);
      if (match) {
        // Determine which is artist and which is title based on pattern
        const result = this.determineArtistAndTitle(match, pattern, trimmedInput);
        if (result) {
          return result;
        }
      }
    }
    
    // If no pattern matches, try to make an educated guess
    return this.guessMetadata(trimmedInput);
  }
  
  private determineArtistAndTitle(
    match: RegExpMatchArray, 
    pattern: RegExp,
    originalInput: string
  ): SongMetadata | null {
    const [, part1, part2] = match;
    
    if (!part1 || !part2) return null;
    
    // Special handling for specific patterns
    if (pattern.source.includes('by')) {
      // "Title by Artist" pattern
      return {
        title: part1.trim(),
        artist: part2.trim()
      };
    } else if (pattern.source.includes('"')) {
      // "Title" Artist pattern
      return {
        title: part1.trim(),
        artist: part2.trim()
      };
    } else if (pattern.source.includes('\\(')) {
      // Title (Artist) pattern - but could also be Title (feat. Artist)
      if (part2.toLowerCase().includes('feat')) {
        // This is likely a featuring, not the main artist
        return {
          title: originalInput,
          artist: '알 수 없는 아티스트'
        };
      }
      return {
        title: part1.trim(),
        artist: part2.trim()
      };
    } else {
      // For other patterns (-, :, |), assume Artist - Title format
      return {
        artist: part1.trim(),
        title: part2.trim()
      };
    }
  }
  
  private guessMetadata(input: string): SongMetadata {
    // Remove common suffixes
    const cleanedInput = input
      .replace(/\s*\(official\s*(video|audio|music\s*video|lyric\s*video)?\s*\)/gi, '')
      .replace(/\s*\[official\s*(video|audio|music\s*video|lyric\s*video)?\s*\]/gi, '')
      .replace(/\s*(HD|HQ|4K|FULL|VEVO)$/gi, '')
      .trim();
    
    // Check if it contains common featuring indicators
    const featMatch = cleanedInput.match(/(.+?)\s+(?:feat\.?|featuring|ft\.?)\s+(.+)/i);
    if (featMatch) {
      // Extract main part before featuring
      const mainPart = featMatch[1];
      
      // Try to parse the main part
      for (const pattern of this.QUERY_PATTERNS) {
        const match = mainPart.match(pattern);
        if (match) {
          const result = this.determineArtistAndTitle(match, pattern, mainPart);
          if (result) {
            // Add featuring artists to the title
            result.title = cleanedInput;
            return result;
          }
        }
      }
    }
    
    // Check if input contains multiple words - might be "artist title" format
    const words = cleanedInput.split(/\s+/);
    if (words.length >= 2) {
      // Common Korean/English artist-title patterns
      const firstWord = words[0];
      const restWords = words.slice(1).join(' ');
      
      // Check if first word could be an artist (Korean names are usually 2-4 chars)
      const koreanPattern = /^[가-힣]{2,4}$/;
      const englishPattern = /^[A-Za-z]+$/;
      
      if (koreanPattern.test(firstWord) || englishPattern.test(firstWord)) {
        return {
          title: restWords,
          artist: firstWord
        };
      }
    }
    
    // If single word input, use it for both title and artist for better search
    return {
      title: cleanedInput,
      artist: cleanedInput // Use same value instead of "unknown artist"
    };
  }
  
  // Enhanced parser that can handle more complex queries
  parseAdvanced(input: string): SongMetadata {
    const metadata: SongMetadata = this.guessMetadata(input);
    
    // Try to extract additional information
    const yearMatch = input.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      metadata.releaseDate = yearMatch[0];
    }
    
    // Extract album if in brackets or parentheses
    const albumMatch = input.match(/\[([^\]]+)\]|\(([^)]+)\)/);
    if (albumMatch) {
      const potentialAlbum = albumMatch[1] || albumMatch[2];
      if (!potentialAlbum.toLowerCase().includes('feat') && 
          !potentialAlbum.toLowerCase().includes('official')) {
        metadata.album = potentialAlbum;
      }
    }
    
    return metadata;
  }
}