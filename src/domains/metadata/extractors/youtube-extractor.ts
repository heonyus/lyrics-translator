/**
 * YouTube Metadata Extractor
 */

import { MetadataExtractor, YouTubeMetadata, ExtractorResult } from '../types/metadata.types';

export class YouTubeExtractor implements MetadataExtractor {
  private readonly YOUTUBE_URL_PATTERNS = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];
  
  canHandle(input: string): boolean {
    return this.YOUTUBE_URL_PATTERNS.some(pattern => pattern.test(input));
  }
  
  async extract(input: string): Promise<YouTubeMetadata> {
    const videoId = this.extractVideoId(input);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    // For now, we'll use a simple approach
    // In production, you'd use YouTube Data API v3
    return this.fetchMetadataFromAPI(videoId);
  }
  
  private extractVideoId(url: string): string | null {
    for (const pattern of this.YOUTUBE_URL_PATTERNS) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }
  
  private async fetchMetadataFromAPI(videoId: string): Promise<YouTubeMetadata> {
    // This is a placeholder - implement actual YouTube API call
    // For now, we'll use ytdl-core or youtube-dl as alternative
    
    try {
      // Option 1: Use YouTube Data API (requires API key)
      // const apiKey = process.env.YOUTUBE_API_KEY;
      // const response = await fetch(
      //   `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${apiKey}`
      // );
      
      // Option 2: Use noembed service (no API key required)
      const noembedResponse = await fetch(
        `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
      );
      
      if (!noembedResponse.ok) {
        throw new Error('Failed to fetch YouTube metadata');
      }
      
      const noembedData = await noembedResponse.json();
      
      // Parse duration from ISO 8601 format if available
      const duration = this.parseDuration(noembedData.duration);
      
      // Extract artist and title from video title
      const { artist, title } = this.parseVideoTitle(noembedData.title);
      
      return {
        videoId,
        title: title || noembedData.title,
        artist: artist || noembedData.author_name,
        channelId: '', // Not available from noembed
        channelName: noembedData.author_name,
        thumbnailUrl: noembedData.thumbnail_url,
        uploadDate: noembedData.upload_date || new Date().toISOString(),
        duration,
        description: noembedData.description
      };
    } catch (error) {
      console.error('YouTube metadata extraction failed:', error);
      throw new Error(`Failed to extract YouTube metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private parseVideoTitle(title: string): { artist?: string; title?: string } {
    // Common patterns for music videos
    const patterns = [
      // Artist - Title (Official Video)
      /^(.+?)\s*[-–]\s*(.+?)(?:\s*\(.*?\))*$/,
      // Title by Artist
      /^(.+?)\s+by\s+(.+?)$/i,
      // Artist: Title
      /^(.+?):\s*(.+?)$/,
      // Artist | Title
      /^(.+?)\s*\|\s*(.+?)$/
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return {
          artist: match[1].trim(),
          title: match[2].trim()
        };
      }
    }
    
    // If no pattern matches, return the whole title
    return { title: title.trim() };
  }
  
  private parseDuration(duration?: string | number): number | undefined {
    if (typeof duration === 'number') {
      return duration * 1000; // Convert seconds to milliseconds
    }
    
    if (typeof duration === 'string') {
      // Parse ISO 8601 duration format (PT3M45S)
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        const hours = parseInt(match[1] || '0');
        const minutes = parseInt(match[2] || '0');
        const seconds = parseInt(match[3] || '0');
        return (hours * 3600 + minutes * 60 + seconds) * 1000;
      }
    }
    
    return undefined;
  }
  
  // Alternative implementation using ytdl-core (if available)
  async extractWithYtdl(videoId: string): Promise<YouTubeMetadata> {
    // This would require ytdl-core package
    // const ytdl = require('ytdl-core');
    // const info = await ytdl.getInfo(videoId);
    // return {
    //   videoId,
    //   title: info.videoDetails.title,
    //   artist: info.videoDetails.author.name,
    //   channelId: info.videoDetails.channelId,
    //   channelName: info.videoDetails.author.name,
    //   duration: parseInt(info.videoDetails.lengthSeconds) * 1000,
    //   thumbnailUrl: info.videoDetails.thumbnails[0]?.url,
    //   viewCount: parseInt(info.videoDetails.viewCount),
    //   uploadDate: info.videoDetails.publishDate,
    //   description: info.videoDetails.description
    // };
    throw new Error('ytdl-core not implemented');
  }
}