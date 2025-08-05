/**
 * Metadata Service - Orchestrates metadata extraction from various sources
 */

import { SongMetadata, ExtractorResult } from './types/metadata.types';
import { YouTubeExtractor } from './extractors/youtube-extractor';
import { SpotifyExtractor } from './extractors/spotify-extractor';
import { TextParser } from './extractors/text-parser';
import { SongQuery } from '../lrc-fetcher/types/provider.types';

export class MetadataService {
  private extractors = [
    new YouTubeExtractor(),
    new SpotifyExtractor(),
    new TextParser()
  ];
  
  /**
   * Extract metadata from any input (URL or text)
   */
  async extractMetadata(input: string): Promise<ExtractorResult> {
    const trimmedInput = input.trim();
    
    if (!trimmedInput) {
      return {
        success: false,
        error: '입력값이 없습니다',
        source: 'unknown'
      };
    }
    
    // Find the appropriate extractor
    for (const extractor of this.extractors) {
      if (extractor.canHandle(trimmedInput)) {
        try {
          const metadata = await extractor.extract(trimmedInput);
          return {
            success: true,
            metadata,
            source: this.getSourceType(extractor)
          };
        } catch (error) {
          console.error(`Extraction failed with ${extractor.constructor.name}:`, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
            source: this.getSourceType(extractor)
          };
        }
      }
    }
    
    // If no extractor can handle it, use text parser as fallback
    try {
      const textParser = new TextParser();
      const metadata = await textParser.extract(trimmedInput);
      return {
        success: true,
        metadata,
        source: 'text'
      };
    } catch (error) {
      return {
        success: false,
        error: '입력을 분석할 수 없습니다',
        source: 'unknown'
      };
    }
  }
  
  /**
   * Convert metadata to SongQuery for LRC search
   */
  metadataToSongQuery(metadata: SongMetadata): SongQuery {
    return {
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      duration: metadata.duration,
      isrc: metadata.isrc,
      spotifyId: (metadata as any).trackId,
      youtubeId: (metadata as any).videoId,
      audioUrl: metadata.audioUrl || (metadata as any).previewUrl
    };
  }
  
  /**
   * Enhance metadata with additional sources
   */
  async enhanceMetadata(metadata: SongMetadata): Promise<SongMetadata> {
    // If we only have basic info, try to get more from other sources
    if (!metadata.duration || !metadata.thumbnailUrl) {
      // Try to search on YouTube for additional info
      const youtubeQuery = `${metadata.artist} ${metadata.title} official`;
      // Implement YouTube search API call here
      
      // Try to search on Spotify for additional info
      const spotifyQuery = `artist:${metadata.artist} track:${metadata.title}`;
      // Implement Spotify search API call here
    }
    
    return metadata;
  }
  
  private getSourceType(extractor: any): 'youtube' | 'spotify' | 'text' | 'unknown' {
    if (extractor instanceof YouTubeExtractor) return 'youtube';
    if (extractor instanceof SpotifyExtractor) return 'spotify';
    if (extractor instanceof TextParser) return 'text';
    return 'unknown';
  }
  
  /**
   * Search for metadata using multiple sources
   */
  async searchMetadata(query: string): Promise<SongMetadata[]> {
    const results: SongMetadata[] = [];
    
    // Search on different platforms
    const searchPromises = [
      this.searchYouTube(query),
      this.searchSpotify(query),
      // Add more search sources as needed
    ];
    
    const searchResults = await Promise.allSettled(searchPromises);
    
    for (const result of searchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(...result.value);
      }
    }
    
    return results;
  }
  
  private async searchYouTube(query: string): Promise<SongMetadata[]> {
    // Implement YouTube search
    // This would require YouTube Data API
    return [];
  }
  
  private async searchSpotify(query: string): Promise<SongMetadata[]> {
    // Implement Spotify search
    // This would require Spotify Web API
    return [];
  }
}