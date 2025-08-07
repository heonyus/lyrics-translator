import { NextRequest, NextResponse } from 'next/server';
import { searchLyrics } from './utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await searchLyrics(body);
    
    if (!result.success) {
      return NextResponse.json(result, { status: result.error ? 500 : 404 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}