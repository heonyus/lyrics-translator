import { NextRequest, NextResponse } from 'next/server';
import { consolidateLyrics } from './utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await consolidateLyrics(body);
    
    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}