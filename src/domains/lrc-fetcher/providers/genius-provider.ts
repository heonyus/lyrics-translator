/**
 * Genius Lyrics Provider
 * Provides lyrics text without timing information
 */

import { BaseProvider } from './base-provider';
import { LRCSearchResult, SongQuery } from '../types/provider.types';

interface GeniusSearchResponse {
  response: {
    hits: Array<{
      type: string;
      result: {
        id: number;
        title: string;
        artist_names: string;
        full_title: string;
        header_image_thumbnail_url: string;
        url: string;
        path: string;
        primary_artist: {
          name: string;
        };
      };
    }>;
  };
}

interface GeniusSongResponse {
  response: {
    song: {
      id: number;
      title: string;
      artist_names: string;
      lyrics_state: string;
      path: string;
      album?: {
        name: string;
      };
      media: Array<{
        provider: string;
        type: string;
        url: string;
      }>;
    };
  };
}

export class GeniusProvider extends BaseProvider {
  name = 'Genius';
  priority = 3; // Lower priority due to lack of timing
  confidence = 0.7; // Lower confidence without timing data
  
  private readonly baseUrl = 'https://api.genius.com';
  private readonly webUrl = 'https://genius.com';
  
  protected requiresApiKey(): boolean {
    return true; // Genius requires API key
  }
  
  protected async checkAvailability(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false;
    }
    
    try {
      // Test API with a simple search
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/search?q=test`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`
          }
        }
      );
      
      return response.ok;
    } catch {
      return false;
    }
  }
  
  async searchLRC(query: SongQuery): Promise<LRCSearchResult[]> {
    this.updateRequestTime();
    
    if (!this.config.apiKey) {
      console.error('Genius API key not configured');
      return [];
    }
    
    try {
      const searchQuery = `${query.artist} ${query.title}`;
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/search?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Genius search failed: ${response.statusText}`);
      }
      
      const data: GeniusSearchResponse = await response.json();
      const hits = data.response?.hits || [];
      
      return hits
        .filter(hit => hit.type === 'song')
        .map(hit => this.mapToSearchResult(hit.result, query));
    } catch (error) {
      console.error('Genius search error:', error);
      return [];
    }
  }
  
  async fetchLRC(songId: string): Promise<string> {
    this.updateRequestTime();
    
    if (!this.config.apiKey) {
      throw new Error('Genius API key not configured');
    }
    
    try {
      // Get song details
      const songResponse = await this.fetchWithTimeout(
        `${this.baseUrl}/songs/${songId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`
          }
        }
      );
      
      if (!songResponse.ok) {
        throw new Error(`Failed to fetch song details: ${songResponse.statusText}`);
      }
      
      const songData: GeniusSongResponse = await songResponse.json();
      const song = songData.response.song;
      
      // Scrape lyrics from web page (API doesn't provide lyrics directly)
      const lyricsText = await this.scrapeLyrics(song.path);
      
      if (!lyricsText) {
        throw new Error('No lyrics found');
      }
      
      // Convert to basic LRC format without timing
      return this.convertToBasicLRC(lyricsText, song);
    } catch (error) {
      console.error('Genius fetch error:', error);
      throw error;
    }
  }
  
  private mapToSearchResult(song: any, query: SongQuery): LRCSearchResult {
    const title = song.title;
    const artist = song.primary_artist?.name || song.artist_names;
    
    // Calculate confidence
    let confidence = this.confidence;
    
    const titleSimilarity = this.calculateStringSimilarity(title, query.title);
    const artistSimilarity = this.calculateStringSimilarity(artist, query.artist);
    
    confidence *= (titleSimilarity * 0.6 + artistSimilarity * 0.4);
    
    return {
      id: song.id.toString(),
      title,
      artist,
      album: undefined, // Not available in search results
      duration: undefined, // Genius doesn't provide duration
      hasLyrics: true,
      hasWordTiming: false, // Genius doesn't provide timing
      hasSyncedLyrics: false,
      provider: this.name,
      confidence: Math.min(confidence, 1.0),
      metadata: {
        url: song.url,
        thumbnailUrl: song.header_image_thumbnail_url
      }
    };
  }
  
  private async scrapeLyrics(path: string): Promise<string | null> {
    try {
      // In a real implementation, you would:
      // 1. Fetch the HTML page from genius.com
      // 2. Parse the HTML to extract lyrics
      // 3. Clean up the text
      
      // For now, we'll return a placeholder
      // In production, use a proper HTML parser like cheerio or playwright
      console.warn('Genius lyrics scraping not implemented. Implement HTML parsing.');
      
      // Placeholder implementation
      const response = await this.fetchWithTimeout(`${this.webUrl}${path}`);
      if (!response.ok) {
        return null;
      }
      
      const html = await response.text();
      
      // Very basic extraction - in production use proper HTML parsing
      const lyricsMatch = html.match(/<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (lyricsMatch) {
        return this.cleanLyricsText(lyricsMatch[1]);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to scrape lyrics:', error);
      return null;
    }
  }
  
  private cleanLyricsText(html: string): string {
    // Remove HTML tags and clean up text
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  
  private convertToBasicLRC(lyrics: string, song: any): string {
    const lines: string[] = [];
    
    // Add metadata
    lines.push(`[ti:${song.title}]`);
    lines.push(`[ar:${song.artist_names}]`);
    if (song.album?.name) {
      lines.push(`[al:${song.album.name}]`);
    }
    lines.push('[by:Genius]');
    lines.push('[re:lyrics-translator]');
    lines.push('[ve:1.0]');
    lines.push('');
    
    // Add lyrics without timing
    // This is a placeholder - in real use, AI timing generation would be applied
    const lyricLines = lyrics.split('\n').filter(line => line.trim());
    
    // Add basic timing (evenly distributed - not accurate)
    const timePerLine = 3000; // 3 seconds per line as default
    
    lyricLines.forEach((line, index) => {
      const timestamp = this.msToLrcTimestamp(index * timePerLine);
      lines.push(`${timestamp}${line}`);
    });
    
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
}