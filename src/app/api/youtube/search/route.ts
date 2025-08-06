import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const YOUTUBE_PLAYER_API = 'https://www.youtube.com/youtubei/v1/player';

export async function POST(request: NextRequest) {
  try {
    const { videoId, query } = await request.json();

    if (videoId) {
      // Get video info directly
      const videoInfo = await getVideoInfo(videoId);
      return NextResponse.json({ success: true, data: videoInfo });
    }

    if (query) {
      // Search for videos
      const searchResults = await searchVideos(query);
      return NextResponse.json({ success: true, data: searchResults });
    }

    return NextResponse.json(
      { success: false, error: 'Missing videoId or query' },
      { status: 400 }
    );
  } catch (error) {
    console.error('YouTube API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch YouTube data' },
      { status: 500 }
    );
  }
}

async function getVideoInfo(videoId: string) {
  const body = {
    videoId,
    context: {
      client: {
        hl: 'ko',
        gl: 'KR',
        clientName: 'WEB',
        clientVersion: '2.20240101.00.00'
      }
    }
  };

  const response = await fetch(
    `${YOUTUBE_PLAYER_API}?key=${YOUTUBE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    throw new Error('Failed to get video info');
  }

  const data = await response.json();

  return {
    videoId,
    title: data.videoDetails?.title || '',
    author: data.videoDetails?.author || '',
    duration: parseInt(data.videoDetails?.lengthSeconds || '0') * 1000,
    captions: data.captions
  };
}

async function searchVideos(query: { artist?: string; title?: string }) {
  // Use YouTube Search API
  const searchQuery = `${query.artist || ''} ${query.title || ''} official`.trim();
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=5&key=${YOUTUBE_API_KEY}`;

  const response = await fetch(searchUrl);
  
  if (!response.ok) {
    console.error('YouTube search failed');
    return [];
  }

  const data = await response.json();
  
  return data.items?.map((item: any) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    author: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails.default.url,
    description: item.snippet.description
  })) || [];
}