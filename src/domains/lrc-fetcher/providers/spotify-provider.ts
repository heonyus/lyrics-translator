/**
 * Spotify Lyrics Provider (Unofficial)
 * Uses the internal Spotify Web API endpoints
 */

import { BaseProvider } from './base-provider';
import { LRCSearchResult, SongQuery } from '../types/provider.types';

interface SpotifyToken {
  accessToken: string;
  expiresAt: number;
}

interface SpotifyLyrics {
  lyrics: {
    syncType: 'LINE_SYNCED' | 'UNSYNCED';
    lines: Array<{
      startTimeMs: string;
      words: string;
      syllables: Array<{
        startTimeMs: string;
        endTimeMs: string;
        text: string;
      }>;
    }>;
    provider: string;
    providerDisplayName: string;
  };
}

export class SpotifyProvider extends BaseProvider {
  name = 'Spotify';
  priority = 2; // High priority due to accuracy
  confidence = 0.95; // Very high confidence when available
  
  private token: SpotifyToken | null = null;
  private readonly tokenUrl = 'https://open.spotify.com/get_access_token';
  private readonly lyricsUrl = 'https://spclient.wg.spotify.com/color-lyrics/v2/track';
  private readonly searchUrl = 'https://api.spotify.com/v1/search';
  
  protected requiresApiKey(): boolean {
    return false; // Uses web player token
  }
  
  protected async checkAvailability(): Promise<boolean> {
    // Spotify provider는 CORS 문제로 인해 일시적으로 비활성화
    return false;
    
    // TODO: API route를 통해 서버사이드에서 호출하도록 수정 필요
    // try {
    //   await this.ensureToken();
    //   return this.token !== null;
    // } catch {
    //   return false;
    // }
  }
  
  async searchLRC(query: SongQuery): Promise<LRCSearchResult[]> {
    this.updateRequestTime();
    
    try {
      await this.ensureToken();
      
      // If we have a Spotify track ID, use it directly
      if (query.spotifyId) {
        const metadata = await this.getTrackMetadata(query.spotifyId);
        return [this.mapToSearchResult(metadata, query)];
      }
      
      // Otherwise, search for the track
      const searchResults = await this.searchTracks(query);
      return searchResults;
    } catch (error) {
      console.error('Spotify search error:', error);
      return [];
    }
  }
  
  async fetchLRC(trackId: string): Promise<string> {
    this.updateRequestTime();
    
    try {
      await this.ensureToken();
      
      const response = await this.fetchWithTimeout(
        `${this.lyricsUrl}/${trackId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.token!.accessToken}`,
            'App-Platform': 'WebPlayer'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch lyrics: ${response.statusText}`);
      }
      
      const data: SpotifyLyrics = await response.json();
      
      if (!data.lyrics) {
        throw new Error('No lyrics available');
      }
      
      return this.convertToLRC(data.lyrics);
    } catch (error) {
      console.error('Spotify fetch error:', error);
      throw error;
    }
  }
  
  private async ensureToken(): Promise<void> {
    if (this.token && Date.now() < this.token.expiresAt) {
      return;
    }
    
    try {
      // Get anonymous token from Spotify Web Player
      const response = await this.fetchWithTimeout(this.tokenUrl, {
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error('Failed to get Spotify token');
      }
      
      const data = await response.json();
      
      this.token = {
        accessToken: data.accessToken,
        expiresAt: Date.now() + (data.accessTokenExpirationTimestampMs - Date.now())
      };
    } catch (error) {
      console.error('Spotify token error:', error);
      throw error;
    }
  }
  
  private async searchTracks(query: SongQuery): Promise<LRCSearchResult[]> {
    if (!this.token) {
      throw new Error('No Spotify token');
    }
    
    const searchQuery = `track:"${query.title}" artist:"${query.artist}"`;
    const params = new URLSearchParams({
      q: searchQuery,
      type: 'track',
      limit: '10'
    });
    
    const response = await this.fetchWithTimeout(
      `${this.searchUrl}?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token.accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Spotify search failed');
    }
    
    const data = await response.json();
    const tracks = data.tracks?.items || [];
    
    return tracks.map((track: any) => this.mapToSearchResult(track, query));
  }
  
  private async getTrackMetadata(trackId: string): Promise<any> {
    if (!this.token) {
      throw new Error('No Spotify token');
    }
    
    const response = await this.fetchWithTimeout(
      `https://api.spotify.com/v1/tracks/${trackId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token.accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to get track metadata');
    }
    
    return response.json();
  }
  
  private mapToSearchResult(track: any, query: SongQuery): LRCSearchResult {
    const title = track.name;
    const artist = track.artists?.map((a: any) => a.name).join(', ') || '';
    const album = track.album?.name;
    const duration = track.duration_ms;
    
    // Calculate confidence
    let confidence = this.confidence;
    
    const titleSimilarity = this.calculateStringSimilarity(title, query.title);
    const artistSimilarity = this.calculateStringSimilarity(artist, query.artist);
    
    confidence *= (titleSimilarity * 0.6 + artistSimilarity * 0.4);
    
    // Duration matching
    if (query.duration && duration) {
      const durationDiff = Math.abs(query.duration - duration);
      if (durationDiff < 3000) { // Within 3 seconds
        confidence *= 1.1;
      }
    }
    
    return {
      id: track.id,
      title,
      artist,
      album,
      duration,
      hasLyrics: true, // Assume true, will verify on fetch
      hasWordTiming: true, // Spotify provides syllable-level timing
      hasSyncedLyrics: true,
      provider: this.name,
      confidence: Math.min(confidence, 1.0),
      metadata: {
        popularity: track.popularity,
        explicit: track.explicit
      }
    };
  }
  
  private convertToLRC(lyrics: SpotifyLyrics['lyrics']): string {
    const lines: string[] = [];
    
    // Add metadata
    lines.push('[by:Spotify]');
    lines.push('[re:lyrics-translator]');
    lines.push('[ve:1.0]');
    lines.push('');
    
    if (lyrics.syncType === 'UNSYNCED') {
      // No timing info, just return plain lyrics
      return lyrics.lines.map(line => line.words).join('\n');
    }
    
    // Convert to LRC format with word timing
    for (const line of lyrics.lines) {
      const lineStartMs = parseInt(line.startTimeMs);
      const lineTimestamp = this.msToLrcTimestamp(lineStartMs);
      
      if (line.syllables && line.syllables.length > 0) {
        // Build line with word-level timing
        let lrcLine = lineTimestamp;
        
        for (const syllable of line.syllables) {
          const wordStartMs = parseInt(syllable.startTimeMs);
          const wordTimestamp = this.msToWordTimestamp(wordStartMs);
          lrcLine += `${wordTimestamp}${syllable.text} `;
        }
        
        lines.push(lrcLine.trim());
      } else {
        // No word timing, just line timing
        lines.push(`${lineTimestamp}${line.words}`);
      }
    }
    
    return lines.join('\n');
  }
  
  private msToLrcTimestamp(ms: number): string {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toFixed(2).padStart(5, '0');
    
    return `[${mm}:${ss}]`;
  }
  
  private msToWordTimestamp(ms: number): string {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toFixed(2).padStart(5, '0');
    
    return `<${mm}:${ss}>`;
  }
}