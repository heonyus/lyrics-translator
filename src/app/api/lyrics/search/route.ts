import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Search in Supabase
    const { data, error } = await supabase
      .from('lyrics')
      .select('*')
      .or(`title.ilike.%${query}%,artist.ilike.%${query}%,album.ilike.%${query}%`)
      .range(offset, offset + limit - 1)
      .order('view_count', { ascending: false });

    if (error) {
      console.error('Supabase search error:', error);
      return NextResponse.json(
        { error: 'Failed to search lyrics' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      results: data || [],
      query,
      limit,
      offset,
      total: data?.length || 0
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, artist, album, lrc_content, metadata, source, source_id } = body;

    if (!title || !artist) {
      return NextResponse.json(
        { error: 'Title and artist are required' },
        { status: 400 }
      );
    }

    // Check if lyrics already exist
    const { data: existing } = await supabase
      .from('lyrics')
      .select('id')
      .eq('title', title)
      .eq('artist', artist)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Lyrics already exist', id: existing.id },
        { status: 409 }
      );
    }

    // Insert new lyrics
    const { data, error } = await supabase
      .from('lyrics')
      .insert({
        title,
        artist,
        album,
        lrc_content,
        metadata: metadata || {},
        source: source || 'user',
        source_id
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create lyrics' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Create lyrics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}