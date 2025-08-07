import { logger, APITimer } from '@/lib/logger';

export async function searchLRCLIB({ artist, title }: { artist: string; title: string }) {
  const timer = new APITimer('LRCLIB');
  
  try {
    // LRCLIB API is free and doesn't require authentication
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title
    });
    
    const response = await fetch(`https://lrclib.net/api/search?${params}`, {
      headers: {
        'User-Agent': 'lyrics-translator/1.0'
      }
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return { success: false };
    }
    
    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
      const best = data[0];
      
      const hasTimestamps = !!best.syncedLyrics;
      const lyrics = best.syncedLyrics || best.plainLyrics || '';
      
      if (lyrics) {
        timer.success(`Found lyrics (${hasTimestamps ? 'synced' : 'plain'})`);
        
        return {
          success: true,
          result: {
            artist: best.artistName || artist,
            title: best.trackName || title,
            album: best.albumName || '',
            lyrics,
            hasTimestamps,
            source: 'lrclib',
            confidence: hasTimestamps ? 0.95 : 0.85
          }
        };
      }
    }
    
    timer.fail('No lyrics found');
    return { success: false };
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return { success: false };
  }
}