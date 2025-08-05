/**
 * Metadata Types for Song Information Extraction
 */

export interface SongMetadata {
  title: string;
  artist: string;
  album?: string;
  duration?: number; // in milliseconds
  releaseDate?: string;
  genre?: string[];
  isrc?: string;
  thumbnailUrl?: string;
  audioUrl?: string;
}

export interface YouTubeMetadata extends SongMetadata {
  videoId: string;
  channelId: string;
  channelName: string;
  viewCount?: number;
  likeCount?: number;
  description?: string;
  uploadDate: string;
}

export interface SpotifyMetadata extends SongMetadata {
  trackId: string;
  albumId?: string;
  artistIds: string[];
  popularity?: number;
  previewUrl?: string;
  explicit: boolean;
  availableMarkets?: string[];
}

export interface MetadataExtractor {
  canHandle(input: string): boolean;
  extract(input: string): Promise<SongMetadata>;
}

export interface ExtractorResult {
  success: boolean;
  metadata?: SongMetadata;
  error?: string;
  source: 'youtube' | 'spotify' | 'text' | 'unknown';
}