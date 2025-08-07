import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';

interface LRCLIBSearchResult {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

interface SearchParams {
  artist?: string;
  track?: string;
  album?: string;
  q?: string;
}

export async function POST(request: NextRequest) {
  const timer = new APITimer('LRCLIB');
  
  try {
    const { artist, title, query } = await request.json();
    
    // Parse search parameters
    let searchArtist = artist;
    let searchTitle = title;
    
    if (!searchArtist || !searchTitle) {
      if (query) {
        // Try to parse from query
        const parts = query.split(' - ');
        if (parts.length >= 2) {
          searchArtist = parts[0].trim();
          searchTitle = parts.slice(1).join(' ').trim();
        } else {
          // Use query as both artist and title for broader search
          searchArtist = query;
          searchTitle = query;
        }
      }
    }
    
    if (!searchArtist && !searchTitle) {
      timer.fail('Missing search parameters');
      return NextResponse.json(
        { success: false, error: 'Artist or title required' },
        { status: 400 }
      );
    }
    
    logger.search(`🎵 LRCLIB Search: "${searchArtist} - ${searchTitle}"`);
    
    // Try different search strategies
    const searchStrategies = [
      // Strategy 1: Search with both artist and track name
      async () => {
        const params = new URLSearchParams();
        if (searchArtist) params.append('artist_name', searchArtist);
        if (searchTitle) params.append('track_name', searchTitle);
        return await fetchFromLRCLIB(`/api/search?${params.toString()}`);
      },
      
      // Strategy 2: Search with query parameter (more flexible)
      async () => {
        const query = `${searchArtist} ${searchTitle}`.trim();
        const params = new URLSearchParams({ q: query });
        return await fetchFromLRCLIB(`/api/search?${params.toString()}`);
      },
      
      // Strategy 3: Get specific track (if we have exact match)
      async () => {
        if (!searchArtist || !searchTitle) return null;
        const params = new URLSearchParams({
          artist_name: searchArtist,
          track_name: searchTitle
        });
        return await fetchFromLRCLIB(`/api/get?${params.toString()}`);
      }
    ];
    
    let bestResult: LRCLIBSearchResult | null = null;
    let allResults: LRCLIBSearchResult[] = [];
    
    // Try each strategy
    for (const strategy of searchStrategies) {
      try {
        const result = await strategy();
        
        if (result) {
          if (Array.isArray(result)) {
            // Search endpoint returns array
            allResults.push(...result);
            
            // Find best match
            const exactMatch = result.find(
              (r: LRCLIBSearchResult) => 
                r.artistName?.toLowerCase() === searchArtist?.toLowerCase() &&
                r.trackName?.toLowerCase() === searchTitle?.toLowerCase()
            );
            
            if (exactMatch) {
              bestResult = exactMatch;
              break;
            }
            
            // Find close match
            const closeMatch = result.find(
              (r: LRCLIBSearchResult) => 
                r.artistName?.toLowerCase().includes(searchArtist?.toLowerCase() || '') ||
                r.trackName?.toLowerCase().includes(searchTitle?.toLowerCase() || '')
            );
            
            if (closeMatch && !bestResult) {
              bestResult = closeMatch;
            }
          } else {
            // Get endpoint returns single object
            bestResult = result;
            break;
          }
        }
      } catch (error) {
        console.warn('Strategy failed:', error);
        continue;
      }
    }
    
    // Remove duplicates from allResults
    const uniqueResults = Array.from(
      new Map(allResults.map(r => [`${r.artistName}-${r.trackName}`, r])).values()
    );
    
    if (!bestResult && uniqueResults.length === 0) {
      timer.fail('No lyrics found');
      return NextResponse.json({
        success: false,
        error: 'No lyrics found',
        searched: {
          artist: searchArtist,
          title: searchTitle
        }
      });
    }
    
    // Use best result or first result
    const finalResult = bestResult || uniqueResults[0];
    
    // Check if we have lyrics
    const hasLyrics = finalResult.syncedLyrics || finalResult.plainLyrics;
    const isInstrumental = finalResult.instrumental;
    
    if (!hasLyrics && !isInstrumental) {
      timer.fail('No lyrics available');
      return NextResponse.json({
        success: false,
        error: 'No lyrics available for this track',
        result: finalResult,
        allResults: uniqueResults.slice(0, 5) // Return top 5 alternatives
      });
    }
    
    // Calculate confidence based on match quality
    let confidence = 0.5; // Base confidence for LRCLIB
    
    if (finalResult.syncedLyrics) {
      confidence += 0.3; // Bonus for having synced lyrics
    }
    
    if (
      finalResult.artistName?.toLowerCase() === searchArtist?.toLowerCase() &&
      finalResult.trackName?.toLowerCase() === searchTitle?.toLowerCase()
    ) {
      confidence += 0.2; // Bonus for exact match
    }
    
    const lyricsLength = (finalResult.syncedLyrics || finalResult.plainLyrics || '').length;
    timer.success(`Found lyrics (${lyricsLength} chars, synced: ${!!finalResult.syncedLyrics})`);
    
    logger.result('LRCLIB', confidence, lyricsLength);
    
    // Prepare response
    const response = {
      success: true,
      result: {
        id: finalResult.id,
        artist: finalResult.artistName,
        title: finalResult.trackName,
        album: finalResult.albumName,
        duration: finalResult.duration,
        instrumental: finalResult.instrumental,
        lyrics: finalResult.plainLyrics || extractPlainFromSynced(finalResult.syncedLyrics),
        syncedLyrics: finalResult.syncedLyrics,
        hasSyncedLyrics: !!finalResult.syncedLyrics,
        source: 'LRCLIB',
        confidence,
        searchTime: Date.now() - timer['startTime']
      },
      alternatives: uniqueResults.slice(0, 5).filter(r => r.id !== finalResult.id)
    };
    
    // Save to database if we have good lyrics
    if (hasLyrics && confidence > 0.7) {
      try {
        await saveLyricsToDatabase({
          artist: finalResult.artistName,
          title: finalResult.trackName,
          album: finalResult.albumName,
          plainLyrics: finalResult.plainLyrics,
          syncedLyrics: finalResult.syncedLyrics,
          source: 'lrclib',
          confidence
        });
        logger.success('Saved to database');
      } catch (error) {
        console.warn('Failed to save to database:', error);
      }
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('LRCLIB Search', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'LRCLIB search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to fetch from LRCLIB API
async function fetchFromLRCLIB(endpoint: string) {
  const baseURL = 'https://lrclib.net';
  const url = `${baseURL}${endpoint}`;
  
  logger.api('LRCLIB', 'fetch', `GET ${endpoint}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'LyricsTranslator/1.0 (https://github.com/yourusername/lyrics-translator)'
    }
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return null; // Not found is not an error
    }
    throw new Error(`LRCLIB API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}

// Helper function to extract plain lyrics from synced lyrics
function extractPlainFromSynced(syncedLyrics: string | null): string | null {
  if (!syncedLyrics) return null;
  
  // Remove timestamps [00:00.00] format
  const lines = syncedLyrics.split('\n');
  const plainLines = lines.map(line => {
    // Remove timestamp at the beginning of the line
    return line.replace(/^\[\d{2}:\d{2}\.\d{2}\]\s*/, '').trim();
  }).filter(line => line.length > 0);
  
  return plainLines.join('\n');
}

// Helper function to save lyrics to database
async function saveLyricsToDatabase(data: {
  artist: string;
  title: string;
  album?: string;
  plainLyrics: string | null;
  syncedLyrics: string | null;
  source: string;
  confidence: number;
}) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        artist: data.artist,
        album: data.album,
        lrc_content: data.syncedLyrics || data.plainLyrics,
        lines: parseLyricsToLines(data.syncedLyrics || data.plainLyrics),
        metadata: {
          source: data.source,
          confidence: data.confidence,
          hasSyncedLyrics: !!data.syncedLyrics,
          savedAt: new Date().toISOString()
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Save failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Database save error:', error);
    throw error;
  }
}

// Helper function to parse lyrics into lines with timing
function parseLyricsToLines(lyrics: string | null) {
  if (!lyrics) return [];
  
  const lines = lyrics.split('\n');
  const parsed = [];
  
  for (const line of lines) {
    const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.*)$/);
    if (match) {
      const [, minutes, seconds, centiseconds, text] = match;
      const timestamp = parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100;
      parsed.push({
        timestamp,
        text: text.trim(),
        duration: 0 // Will be calculated based on next line
      });
    } else if (line.trim()) {
      // Plain text line without timestamp
      parsed.push({
        timestamp: 0,
        text: line.trim(),
        duration: 0
      });
    }
  }
  
  // Calculate durations
  for (let i = 0; i < parsed.length - 1; i++) {
    if (parsed[i].timestamp > 0 && parsed[i + 1].timestamp > 0) {
      parsed[i].duration = parsed[i + 1].timestamp - parsed[i].timestamp;
    }
  }
  
  return parsed;
}