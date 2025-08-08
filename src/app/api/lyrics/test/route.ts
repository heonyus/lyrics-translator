import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  console.log('\n===== TEST API CALLED =====');
  console.log('Time:', new Date().toISOString());
  
  return NextResponse.json({
    status: 'ok',
    message: 'Test API is working',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  console.log('\n===== TEST API POST CALLED =====');
  console.log('Time:', new Date().toISOString());
  
  try {
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    
    // Test basic search with LRCLIB only
    const { artist, title } = body;
    
    if (!artist || !title) {
      return NextResponse.json({
        error: 'Artist and title required',
      }, { status: 400 });
    }
    
    console.log(`Testing LRCLIB search for: ${artist} - ${title}`);
    
    // Direct LRCLIB call
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title,
    });
    
    const url = `https://lrclib.net/api/search?${params}`;
    console.log('LRCLIB URL:', url);
    
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'LyricsTranslator/1.0' },
      });
      
      console.log('LRCLIB Status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('LRCLIB Results:', data?.length || 0);
        
        return NextResponse.json({
          source: 'lrclib-test',
          results: data,
          count: data?.length || 0,
        });
      } else {
        return NextResponse.json({
          error: `LRCLIB returned ${response.status}`,
        }, { status: 500 });
      }
    } catch (error) {
      console.error('LRCLIB Error:', error);
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Test API Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}