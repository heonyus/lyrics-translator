import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'Missing caption URL' },
        { status: 400 }
      );
    }
    
    // Add format parameter for JSON3
    const captionUrl = `${url}&fmt=json3`;
    
    const response = await fetch(captionUrl);
    
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch captions' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('YouTube captions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch YouTube captions' },
      { status: 500 }
    );
  }
}