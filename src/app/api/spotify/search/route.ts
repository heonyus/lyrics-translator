import { NextRequest, NextResponse } from 'next/server';

// Spotify Web API credentials (you'll need to add these to .env.local)
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Cache for access token
let accessToken: string | null = null;
let tokenExpiry: number = 0;

// Get Spotify access token
async function getSpotifyToken(): Promise<string> {
  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  // Get new token
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error('Failed to get Spotify access token');
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Subtract 1 minute for safety

  return accessToken;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'track';
    const limit = searchParams.get('limit') || '10';

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    // Get access token
    const token = await getSpotifyToken();

    // Search Spotify
    const searchUrl = new URL('https://api.spotify.com/v1/search');
    searchUrl.searchParams.append('q', query);
    searchUrl.searchParams.append('type', type);
    searchUrl.searchParams.append('limit', limit);

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const data = await response.json();

    // Format response for our lyrics fetcher
    const formattedResults = data.tracks?.items?.map((track: any) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map((a: any) => a.name).join(', '),
      album: track.album.name,
      duration: track.duration_ms,
      provider: 'spotify',
      metadata: {
        spotify_uri: track.uri,
        preview_url: track.preview_url,
        album_image: track.album.images[0]?.url,
        release_date: track.album.release_date,
        popularity: track.popularity
      }
    })) || [];

    return NextResponse.json({ results: formattedResults });
  } catch (error) {
    console.error('Spotify search error:', error);
    return NextResponse.json(
      { error: 'Failed to search Spotify', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Alternative endpoint for POST requests
  return GET(request);
}