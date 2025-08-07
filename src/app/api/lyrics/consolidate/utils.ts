import { logger } from '@/lib/logger';

export async function consolidateLyrics({ 
  results, 
  artist, 
  title 
}: { 
  results: any[]; 
  artist: string; 
  title: string;
}) {
  logger.info(`🔀 Consolidating ${results.length} results for ${artist} - ${title}`);
  
  if (!results || results.length === 0) {
    return {
      success: false,
      message: 'No results to consolidate'
    };
  }
  
  // Simple consolidation logic:
  // 1. Prefer results with timestamps
  // 2. Prefer longer lyrics
  // 3. Merge unique lines from multiple sources
  
  const withTimestamps = results.filter(r => r.hasTimestamps);
  const withoutTimestamps = results.filter(r => !r.hasTimestamps);
  
  let bestResult = withTimestamps[0] || withoutTimestamps[0];
  
  // If we have multiple results, try to find the most complete one
  if (results.length > 1) {
    let longestLyrics = bestResult.lyrics || '';
    let bestSource = bestResult.source;
    
    for (const result of results) {
      if (result.lyrics && result.lyrics.length > longestLyrics.length) {
        longestLyrics = result.lyrics;
        bestSource = result.source;
        bestResult = result;
      }
    }
    
    // Merge unique lines from all results
    const allLines = new Set<string>();
    for (const result of results) {
      if (result.lyrics) {
        const lines = result.lyrics.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
        lines.forEach((line: string) => {
          // Skip timestamp lines for now
          if (!line.match(/^\[\d{2}:\d{2}.\d{2,3}\]/)) {
            allLines.add(line);
          }
        });
      }
    }
    
    // If we got more lines from merging, use that
    if (allLines.size > longestLyrics.split('\n').length) {
      longestLyrics = Array.from(allLines).join('\n');
      bestSource = 'consolidated';
    }
    
    logger.success(`Consolidated from ${results.length} sources (${longestLyrics.length} chars)`);
    
    return {
      success: true,
      lyrics: longestLyrics,
      artist: bestResult.artist || artist,
      title: bestResult.title || title,
      source: bestSource,
      confidence: 0.9
    };
  }
  
  return {
    success: true,
    ...bestResult
  };
}