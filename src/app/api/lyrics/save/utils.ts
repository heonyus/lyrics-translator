import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function saveLyrics(data: {
  title: string;
  artist: string;
  lrc_content: string;
  metadata?: any;
}) {
  try {
    const supabase = supabaseAdmin();
    
    // Check if lyrics already exist
    const { data: existing } = await supabase
      .from('lyrics')
      .select('id')
      .eq('artist', data.artist)
      .eq('title', data.title)
      .single();
    
    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('lyrics')
        .update({
          lrc_content: data.lrc_content,
          metadata: data.metadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      if (error) {
        logger.error('Update lyrics error:', error);
        return { success: false, error: 'Failed to update lyrics' };
      }
      
      logger.success(`Updated lyrics for ${data.artist} - ${data.title}`);
      return { success: true, action: 'updated', id: existing.id };
    } else {
      // Insert new
      const { data: inserted, error } = await supabase
        .from('lyrics')
        .insert({
          title: data.title,
          artist: data.artist,
          lrc_content: data.lrc_content,
          metadata: data.metadata
        })
        .select()
        .single();
      
      if (error) {
        logger.error('Insert lyrics error:', error);
        return { success: false, error: 'Failed to save lyrics' };
      }
      
      logger.success(`Saved new lyrics for ${data.artist} - ${data.title}`);
      return { success: true, action: 'created', id: inserted.id };
    }
  } catch (error) {
    logger.error('Save lyrics error:', error);
    return { success: false, error: 'Save failed' };
  }
}