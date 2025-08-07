import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { artist, title } = await request.json();
    
    if (!artist || !title) {
      return NextResponse.json(
        { success: false, error: 'Artist and title required' },
        { status: 400 }
      );
    }
    
    logger.info(`🎨 Fetching album info for: "${artist} - ${title}"`);
    
    // Try iTunes Search API first (no key required)
    const albumInfo = await searchITunes(artist, title);
    
    if (albumInfo) {
      // Save to localStorage for caching
      return NextResponse.json({
        success: true,
        albumInfo
      });
    }
    
    // Fallback to mock data if no results
    return NextResponse.json({
      success: true,
      albumInfo: {
        title,
        artist,
        album: '',
        coverUrl: null,
        releaseDate: null,
        genre: 'Music'
      }
    });
    
  } catch (error) {
    logger.error('Album Fetch', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch album info' },
      { status: 500 }
    );
  }
}

async function searchITunes(artist: string, title: string) {
  try {
    // Clean up search query
    const query = encodeURIComponent(`${artist} ${title}`);
    const url = `https://itunes.apple.com/search?term=${query}&media=music&entity=song&limit=5`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // Find best match
      const result = data.results.find((r: any) => 
        r.trackName?.toLowerCase().includes(title.toLowerCase()) ||
        r.artistName?.toLowerCase().includes(artist.toLowerCase())
      ) || data.results[0];
      
      return {
        title: result.trackName || title,
        artist: result.artistName || artist,
        album: result.collectionName || '',
        coverUrl: result.artworkUrl100?.replace('100x100', '600x600') || result.artworkUrl100,
        releaseDate: result.releaseDate,
        genre: result.primaryGenreName,
        previewUrl: result.previewUrl,
        trackTimeMillis: result.trackTimeMillis
      };
    }
    
    return null;
  } catch (error) {
    console.error('iTunes search error:', error);
    return null;
  }
}

// Alternative: Use Last.fm API (requires API key)
async function searchLastFm(artist: string, title: string) {
  const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
  if (!LASTFM_API_KEY) return null;
  
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.track) {
      return {
        title: data.track.name || title,
        artist: data.track.artist?.name || artist,
        album: data.track.album?.title || '',
        coverUrl: data.track.album?.image?.find((img: any) => img.size === 'extralarge')?.['#text'] || null,
        listeners: data.track.listeners,
        playcount: data.track.playcount
      };
    }
    
    return null;
  } catch (error) {
    console.error('Last.fm search error:', error);
    return null;
  }
}