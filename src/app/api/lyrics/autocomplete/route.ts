import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query') || '';
    const type = searchParams.get('type') || 'all'; // 'artist', 'title', or 'all'
    
    if (!query || query.length < 1) {
      return NextResponse.json({
        success: true,
        suggestions: [],
        artists: [],
        titles: []
      });
    }
    
    const supabase = supabaseAdmin();
    const suggestions: { artists: string[], titles: string[] } = {
      artists: [],
      titles: []
    };
    
    // Search artists
    if (type === 'artist' || type === 'all') {
      const { data: artistData } = await supabase
        .from('lyrics')
        .select('artist')
        .ilike('artist', `${query}%`)
        .order('artist')
        .limit(20);
      
      if (artistData) {
        // Remove duplicates and limit to 5
        const uniqueArtists = [...new Set(artistData.map(item => item.artist).filter(Boolean))];
        suggestions.artists = uniqueArtists.slice(0, 5);
      }
    }
    
    // Search titles
    if (type === 'title' || type === 'all') {
      const { data: titleData } = await supabase
        .from('lyrics')
        .select('title, artist')
        .ilike('title', `${query}%`)
        .order('title')
        .limit(20);
      
      if (titleData) {
        // Remove duplicates and include artist info
        const uniqueTitles = titleData
          .filter((item, index, self) => 
            index === self.findIndex(t => t.title === item.title)
          )
          .slice(0, 5)
          .map(item => `${item.title} - ${item.artist}`);
        suggestions.titles = uniqueTitles;
      }
    }
    
    // Combined suggestions for general search
    let combinedSuggestions: string[] = [];
    if (type === 'all') {
      // Search for both artist-title combinations
      const { data: combinedData } = await supabase
        .from('lyrics')
        .select('artist, title')
        .or(`artist.ilike.%${query}%,title.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (combinedData) {
        combinedSuggestions = combinedData
          .map(item => `${item.artist} - ${item.title}`)
          .slice(0, 5);
      }
    }
    
    return NextResponse.json({
      success: true,
      suggestions: combinedSuggestions,
      artists: suggestions.artists,
      titles: suggestions.titles,
      query,
      type
    });
    
  } catch (error) {
    console.error('[Autocomplete] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Autocomplete failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}