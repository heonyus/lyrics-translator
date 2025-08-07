import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function searchLyrics({ query, artist, title }: { 
  query?: string; 
  artist?: string; 
  title?: string;
}) {
  try {
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
      return { success: false, error: 'No search parameters provided' };
    }
    
    // Order by source priority: user_verified > ai > scrape
    dbQuery = dbQuery.order('created_at', { ascending: false });
    
    const { data, error } = await dbQuery.limit(10);
    
    if (error) {
      logger.error('Database search', error);
      return { success: false, error: 'Database search failed' };
    }
    
    // Prioritize user_verified sources
    const sortedData = data?.sort((a, b) => {
      const sourceOrder = { 'user_verified': 0, 'ai': 1, 'scrape': 2 };
      const aOrder = sourceOrder[a.metadata?.source as keyof typeof sourceOrder] ?? 3;
      const bOrder = sourceOrder[b.metadata?.source as keyof typeof sourceOrder] ?? 3;
      return aOrder - bOrder;
    });
    
    if (sortedData && sortedData.length > 0) {
      logger.success(`Found ${sortedData.length} results in database`);
      return {
        success: true,
        lyrics: sortedData[0],
        results: sortedData
      };
    }
    
    return {
      success: false,
      message: 'No lyrics found in database'
    };
    
  } catch (error) {
    logger.error('Search lyrics error:', error);
    return {
      success: false,
      error: 'Search failed'
    };
  }
}