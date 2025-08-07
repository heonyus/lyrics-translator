import { NextRequest, NextResponse } from 'next/server';
import { smartScraperV2 } from './utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await smartScraperV2(body);
    
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