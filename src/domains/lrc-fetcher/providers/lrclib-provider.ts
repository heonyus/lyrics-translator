/**
 * LRClib.net Provider - Free open source LRC database
 */

import { BaseProvider } from './base-provider';
import { LRCSearchResult, SongQuery } from '../types/provider.types';

interface LRClibSearchResponse {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration: number;
  instrumental: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

export class LRClibProvider extends BaseProvider {
  name = 'LRClib.net';
  priority = 1; // High priority as it's free and reliable
  confidence = 0.8;
  
  private baseUrl = 'https://lrclib.net/api';
  
  protected requiresApiKey(): boolean {
    return false; // LRClib is free and doesn't require API key
  }
  
  protected async checkAvailability(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/search?q=test`, {
        method: 'GET'
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  async searchLRC(query: SongQuery): Promise<LRCSearchResult[]> {
    this.updateRequestTime();
    
    // Build search query
    const searchParams = new URLSearchParams();
    
    // Primary search with track name and artist
    if (query.title) {
      searchParams.append('track_name', query.title);
    }
    if (query.artist) {
      searchParams.append('artist_name', query.artist);
    }
    if (query.album) {
      searchParams.append('album_name', query.album);
    }
    
    // If no specific fields, use general search
    if (!searchParams.toString()) {
      const searchText = `${query.artist} ${query.title}`.trim();
      searchParams.append('q', searchText);
    }
    
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/search?${searchParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'LyricsTranslator/1.0'
          }
        }
      );
      
      if (!response.ok) {
        console.error('LRClib search failed:', response.statusText);
        return [];
      }
      
      const results: LRClibSearchResponse[] = await response.json();
      
      return results.map(result => this.mapToSearchResult(result, query));
    } catch (error) {
      console.error('LRClib search error:', error);
      return [];
    }
  }
  
  async fetchLRC(lrcId: string): Promise<string> {
    this.updateRequestTime();
    
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/get/${lrcId}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'LyricsTranslator/1.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`LRC를 가져올 수 없습니다: ${response.statusText}`);
      }
      
      const data: LRClibSearchResponse = await response.json();
      
      // Prefer synced lyrics over plain lyrics
      if (data.syncedLyrics) {
        return data.syncedLyrics;
      } else if (data.plainLyrics) {
        // Convert plain lyrics to basic LRC format
        return this.convertPlainToLRC(data.plainLyrics, data.duration);
      }
      
      throw new Error('가사를 찾을 수 없습니다');
    } catch (error) {
      console.error('LRClib fetch error:', error);
      throw error;
    }
  }
  
  private mapToSearchResult(response: LRClibSearchResponse, query: SongQuery): LRCSearchResult {
    // Calculate base confidence
    let confidence = this.confidence;
    
    // Adjust confidence based on matching
    const titleSimilarity = this.calculateStringSimilarity(
      response.trackName || response.name,
      query.title
    );
    const artistSimilarity = this.calculateStringSimilarity(
      response.artistName,
      query.artist
    );
    
    confidence *= (titleSimilarity * 0.6 + artistSimilarity * 0.4);
    
    // Boost confidence if has synced lyrics
    if (response.syncedLyrics) {
      confidence *= 1.2;
    }
    
    // Duration matching
    if (query.duration && response.duration) {
      const durationDiff = Math.abs(query.duration - response.duration * 1000);
      if (durationDiff < 5000) { // Within 5 seconds
        confidence *= 1.1;
      } else if (durationDiff > 30000) { // More than 30 seconds
        confidence *= 0.8;
      }
    }
    
    return {
      id: response.id.toString(),
      title: response.trackName || response.name,
      artist: response.artistName,
      album: response.albumName,
      duration: response.duration * 1000, // Convert to milliseconds
      hasLyrics: !response.instrumental && (!!response.plainLyrics || !!response.syncedLyrics),
      hasWordTiming: false, // LRClib doesn't provide word-level timing
      hasSyncedLyrics: !!response.syncedLyrics,
      provider: this.name,
      confidence: Math.min(confidence, 1.0),
      metadata: {
        instrumental: response.instrumental
      }
    };
  }
  
  private convertPlainToLRC(plainLyrics: string, durationSeconds: number): string {
    const lines = plainLyrics.split('\n').filter(line => line.trim());
    if (lines.length === 0) return '';
    
    // Simple timing: distribute duration evenly across lines
    const timePerLine = durationSeconds / lines.length;
    
    return lines.map((line, index) => {
      const seconds = index * timePerLine;
      const minutes = Math.floor(seconds / 60);
      const secs = (seconds % 60).toFixed(2).padStart(5, '0');
      const timestamp = `[${minutes.toString().padStart(2, '0')}:${secs}]`;
      return `${timestamp}${line}`;
    }).join('\n');
  }
}