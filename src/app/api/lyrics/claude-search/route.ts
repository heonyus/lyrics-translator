import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { artist, title } = await request.json();
    
    // Claude API는 현재 비활성화 - 다른 API로 폴백
    console.log(`[Claude Search] Currently disabled - ${artist} - ${title}`);
    
    return NextResponse.json({
      success: false,
      error: 'Claude API temporarily disabled',
      fallback: true
    });
    
  } catch (error) {
    console.error('Claude search error:', error);
    return NextResponse.json(
      { success: false, error: 'Claude search failed' },
      { status: 500 }
    );
  }
}