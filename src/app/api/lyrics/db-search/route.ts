import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { artist, title, query } = await request.json();
    
    const supabase = supabaseAdmin();
    
    // Build search query
    let dbQuery = supabase.from('lyrics').select('*');
    
    if (artist && title) {
      // Exact match search
      dbQuery = dbQuery
        .ilike('artist', `%${artist}%`)
        .ilike('title', `%${title}%`);
    } else if (artist) {
      // Search by artist only
      dbQuery = dbQuery.ilike('artist', `%${artist}%`);
    } else if (title) {
      // Search by title only
      dbQuery = dbQuery.ilike('title', `%${title}%`);
    } else if (query) {
      // General search
      dbQuery = dbQuery.or(`artist.ilike.%${query}%,title.ilike.%${query}%`);
    } else {
      return NextResponse.json(
        { success: false, error: 'No search parameters provided' },
        { status: 400 }
      );
    }
    
    // Order by source priority: user_verified > ai > scrape
    dbQuery = dbQuery.order('created_at', { ascending: false });
    
    const { data, error } = await dbQuery.limit(10);
    
    if (error) {
      logger.error('Database search', error);
      return NextResponse.json(
        { success: false, error: 'Database search failed' },
        { status: 500 }
      );
    }
    
    // Prioritize user_verified sources
    const sortedData = data?.sort((a, b) => {
      const sourceOrder = { 'user_verified': 0, 'ai': 1, 'scrape': 2 };
      const aOrder = sourceOrder[a.source as keyof typeof sourceOrder] ?? 3;
      const bOrder = sourceOrder[b.source as keyof typeof sourceOrder] ?? 3;
      return aOrder - bOrder;
    });
    
    if (sortedData && sortedData.length > 0) {
      logger.db('fetch', `Found ${sortedData.length} result(s) for "${artist || query} - ${title || ''}"`);
    }
    
    return NextResponse.json({
      success: true,
      results: sortedData || [],
      count: sortedData?.length || 0,
      source: 'database'
    });
    
  } catch (error) {
    logger.error('DB Search', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET method for autocomplete
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const field = searchParams.get('field'); // 'artist' or 'title'
    const query = searchParams.get('query') || '';
    
    if (!field || !query) {
      return NextResponse.json(
        { success: false, error: 'Field and query are required' },
        { status: 400 }
      );
    }
    
    const supabase = supabaseAdmin();
    
    // Get unique values for autocomplete
    const { data, error } = await supabase
      .from('lyrics')
      .select(field)
      .ilike(field, `${query}%`)
      .order(field)
      .limit(10);
    
    if (error) {
      console.error('Autocomplete error:', error);
      return NextResponse.json(
        { success: false, error: 'Autocomplete failed' },
        { status: 500 }
      );
    }
    
    // Remove duplicates
    const uniqueValues = [...new Set(data?.map((item: any) => item[field]).filter(Boolean))];
    
    return NextResponse.json({
      success: true,
      suggestions: uniqueValues.slice(0, 5),
      field,
      query
    });
    
  } catch (error) {
    console.error('[Autocomplete] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}