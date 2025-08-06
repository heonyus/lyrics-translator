import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { artist, title, album, query } = await request.json();
    
    // Build search URL
    const baseUrl = 'https://lrclib.net/api/search';
    const searchParams = new URLSearchParams();
    
    // Use specific parameters if available
    if (title && artist) {
      searchParams.append('track_name', title);
      searchParams.append('artist_name', artist);
      if (album) {
        searchParams.append('album_name', album);
      }
    } else if (query) {
      // Use general query
      searchParams.append('q', query);
    } else {
      // Fallback to combined search
      const searchText = `${artist || ''} ${title || ''}`.trim();
      if (searchText) {
        searchParams.append('q', searchText);
      }
    }
    
    const searchUrl = `${baseUrl}?${searchParams.toString()}`;
    console.log('LRClib search URL:', searchUrl);
    
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LyricsTranslator/1.0'
      }
    });
    
    if (!response.ok) {
      console.error('LRClib API error:', response.status, response.statusText);
      return NextResponse.json(
        { success: false, error: `LRClib API error: ${response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log(`LRClib found ${data.length} results`);
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('LRClib search error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search LRClib' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Missing id parameter' },
      { status: 400 }
    );
  }
  
  try {
    const response = await fetch(`https://lrclib.net/api/get/${id}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LyricsTranslator/1.0'
      }
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `LRClib API error: ${response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('LRClib fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch from LRClib' },
      { status: 500 }
    );
  }
}