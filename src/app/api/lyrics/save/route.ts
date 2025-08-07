import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Support both formats: legacy (lyrics) and new (lrc_content)
    const artist = body.artist;
    const title = body.title;
    const lyrics = body.lyrics || body.lrc_content;
    const album = body.album;
    const metadata = body.metadata;
    
    if (!artist || !title || !lyrics) {
      logger.error('Save Lyrics', `Missing required fields - artist: ${!!artist}, title: ${!!title}, lyrics: ${!!lyrics}`);
      return NextResponse.json(
        { success: false, error: 'Artist, title, and lyrics are required', received: { artist: !!artist, title: !!title, lyrics: !!lyrics } },
        { status: 400 }
      );
    }
    
    const supabase = supabaseAdmin();
    
    // Check if the lyrics already exist
    const { data: existing } = await supabase
      .from('lyrics')
      .select('id')
      .eq('artist', artist)
      .eq('title', title)
      .single();
    
    let result;
    
    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('lyrics')
        .update({
          lrc_content: lyrics,
          album: album || null,
          metadata: metadata || {},
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) {
        logger.error('Update lyrics', error);
        return NextResponse.json(
          { success: false, error: 'Failed to update lyrics', details: error.message },
          { status: 500 }
        );
      }
      
      result = data;
      logger.db('update', `"${artist} - ${title}" (${lyrics.length} chars)`);
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('lyrics')
        .insert({
          artist,
          title,
          album: album || null,
          lrc_content: lyrics,
          metadata: metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        logger.error('Insert lyrics', error);
        return NextResponse.json(
          { success: false, error: 'Failed to save lyrics', details: error.message },
          { status: 500 }
        );
      }
      
      result = data;
      logger.db('save', `"${artist} - ${title}" (${lyrics.length} chars)`);
    }
    
    return NextResponse.json({
      success: true,
      data: result,
      message: existing ? 'Lyrics updated successfully' : 'Lyrics saved successfully',
      action: existing ? 'updated' : 'created'
    });
    
  } catch (error) {
    logger.error('Save Lyrics', error);
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

// DELETE method to remove lyrics
export async function DELETE(request: NextRequest) {
  try {
    const { id, artist, title } = await request.json();
    
    const supabase = supabaseAdmin();
    
    let deleteQuery = supabase.from('lyrics').delete();
    
    if (id) {
      deleteQuery = deleteQuery.eq('id', id);
    } else if (artist && title) {
      deleteQuery = deleteQuery.eq('artist', artist).eq('title', title);
    } else {
      return NextResponse.json(
        { success: false, error: 'ID or artist/title required' },
        { status: 400 }
      );
    }
    
    const { error } = await deleteQuery;
    
    if (error) {
      logger.error('Delete lyrics', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete lyrics' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Lyrics deleted successfully'
    });
    
  } catch (error) {
    logger.error('Delete Lyrics', error);
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