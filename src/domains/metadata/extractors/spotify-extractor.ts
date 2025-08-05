/**
 * Spotify Metadata Extractor
 */

import { MetadataExtractor, SpotifyMetadata, ExtractorResult } from '../types/metadata.types';

export class SpotifyExtractor implements MetadataExtractor {
  private readonly SPOTIFY_URL_PATTERNS = [
    /spotify\.com\/track\/([a-zA-Z0-9]{22})/,
    /spotify\.com\/intl-[a-z]+\/track\/([a-zA-Z0-9]{22})/,
    /open\.spotify\.com\/track\/([a-zA-Z0-9]{22})/,
    /spotify:track:([a-zA-Z0-9]{22})/
  ];
  
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  
  canHandle(input: string): boolean {
    return this.SPOTIFY_URL_PATTERNS.some(pattern => pattern.test(input));
  }
  
  async extract(input: string): Promise<SpotifyMetadata> {
    const trackId = this.extractTrackId(input);
    if (!trackId) {
      throw new Error('Invalid Spotify URL');
    }
    
    // Get access token if needed
    await this.ensureAccessToken();
    
    return this.fetchMetadataFromAPI(trackId);
  }
  
  private extractTrackId(url: string): string | null {
    for (const pattern of this.SPOTIFY_URL_PATTERNS) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }
  
  private async ensureAccessToken(): Promise<void> {
    // Check if token is still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return;
    }
    
    // For client-side usage, we'll use the Implicit Grant flow
    // In production, use Client Credentials flow on the server
    await this.getClientCredentialsToken();
  }
  
  private async getClientCredentialsToken(): Promise<void> {
    // This should be done server-side in production
    const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Spotify credentials not configured');
    }
    
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        },
        body: 'grant_type=client_credentials'
      });
      
      if (!response.ok) {
        throw new Error('Failed to get Spotify access token');
      }
      
      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    } catch (error) {
      console.error('Spotify authentication failed:', error);
      throw error;
    }
  }
  
  private async fetchMetadataFromAPI(trackId: string): Promise<SpotifyMetadata> {
    if (!this.accessToken) {
      throw new Error('No Spotify access token');
    }
    
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/tracks/${trackId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, retry
          this.accessToken = null;
          await this.ensureAccessToken();
          return this.fetchMetadataFromAPI(trackId);
        }
        throw new Error(`Spotify API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        trackId: data.id,
        title: data.name,
        artist: data.artists.map((a: any) => a.name).join(', '),
        artistIds: data.artists.map((a: any) => a.id),
        album: data.album.name,
        albumId: data.album.id,
        duration: data.duration_ms,
        releaseDate: data.album.release_date,
        popularity: data.popularity,
        previewUrl: data.preview_url,
        explicit: data.explicit,
        isrc: data.external_ids?.isrc,
        thumbnailUrl: data.album.images[0]?.url,
        availableMarkets: data.available_markets
      };
    } catch (error) {
      console.error('Spotify metadata extraction failed:', error);
      throw error;
    }
  }
  
  // Alternative: Use Spotify oEmbed (no auth required but limited data)
  async extractWithOEmbed(trackId: string): Promise<Partial<SpotifyMetadata>> {
    try {
      const response = await fetch(
        `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch Spotify oEmbed data');
      }
      
      const data = await response.json();
      
      // oEmbed provides limited data
      // Parse title to extract artist and track name
      const titleParts = data.title?.split(' · ') || [];
      
      return {
        trackId,
        title: titleParts[0] || data.title,
        artist: titleParts[1] || 'Unknown Artist',
        thumbnailUrl: data.thumbnail_url
      };
    } catch (error) {
      console.error('Spotify oEmbed extraction failed:', error);
      throw error;
    }
  }
}