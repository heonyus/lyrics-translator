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
      // Check if our API endpoint is available
      const response = await fetch('/api/lrclib/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' })
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  async searchLRC(query: SongQuery): Promise<LRCSearchResult[]> {
    this.updateRequestTime();
    
    try {
      // Use server-side API to avoid CORS
      const response = await fetch('/api/lrclib/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: query.artist,
          title: query.title,
          album: query.album
        })
      });
      
      if (!response.ok) {
        console.error('LRClib API error:', response.status);
        return [];
      }
      
      const { success, data } = await response.json();
      
      if (!success || !data) {
        console.error('LRClib search failed');
        return [];
      }
      
      // Map results
      const results: LRCSearchResult[] = data.map((result: LRClibSearchResponse) => 
        this.mapToSearchResult(result, query)
      );
      
      return results;
    } catch (error) {
      console.error('LRClib search error:', error);
      return [];
    }
  }
  
  async fetchLRC(lrcId: string): Promise<string> {
    this.updateRequestTime();
    
    try {
      // Use server-side API to avoid CORS
      const response = await fetch(`/api/lrclib/search?id=${lrcId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`LRC를 가져올 수 없습니다: ${response.statusText}`);
      }
      
      const { success, data } = await response.json();
      
      if (!success || !data) {
        throw new Error('가사를 찾을 수 없습니다');
      }
      
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