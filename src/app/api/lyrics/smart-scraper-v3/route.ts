import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';

// Main handler
export async function POST(request: NextRequest) {
  const timer = new APITimer('Smart Scraper V3');
  
  try {
    const { query, artist: providedArtist, title: providedTitle, forceRefresh = false } = await request.json();
    
    logger.search(`🚀 Smart Scraper V3: "${query || `${providedArtist} - ${providedTitle}`}"`);
    
    // Step 1: Parse query with LLM if needed
    let artist = providedArtist;
    let title = providedTitle;
    let parseSource = 'provided';
    
    if (!artist || !title) {
      if (query) {
        logger.info('📝 Parsing query with LLM...');
        
        try {
          // Import and call the parse-query handler directly
          const { parseQuery } = await import('../parse-query/utils');
          const parseResult = await parseQuery(query);
          
          if (parseResult && parseResult.parsed) {
            artist = parseResult.parsed.artist;
            title = parseResult.parsed.title;
            parseSource = parseResult.source;
            logger.success(`✅ Parsed with ${parseSource}: ${artist} - ${title}`);
          }
        } catch (error) {
          logger.warning('Failed to parse with LLM, using fallback');
        }
      }
      
      // Fallback parsing
      if (!artist || !title) {
        if (query) {
          const parts = query.split(/\s*[-–]\s*/);
          if (parts.length >= 2) {
            artist = parts[0].trim();
            title = parts[1].trim();
          } else {
            artist = query;
            title = query;
          }
          parseSource = 'fallback';
        } else {
          return NextResponse.json(
            { success: false, error: 'Artist and title are required' },
            { status: 400 }
          );
        }
      }
    }
    
    logger.info(`🎵 Searching for: "${artist} - ${title}"`);
    
    // Detect language
    const language = detectLanguage(`${artist} ${title}`);
    logger.info(`🌐 Language: ${language}`);
    
    // Step 2: Check cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        // Import and call the search handler directly
        const { searchLyrics } = await import('../search/utils');
        const cacheResult = await searchLyrics({ query: `${artist} ${title}` });
        
        if (cacheResult && cacheResult.success && cacheResult.lyrics) {
          logger.success('✅ Found in cache');
          return NextResponse.json({
            success: true,
            results: [{
              ...cacheResult.lyrics,
              source: 'cache',
              fromCache: true,
              confidence: 1.0
            }],
            bestResult: cacheResult.lyrics,
            parseInfo: { source: parseSource, artist, title }
          });
        }
      } catch (error) {
        logger.warning('Cache check failed');
      }
    }
    
    // Step 3: Search all sources in parallel
    const searchPromises = [];
    
    // 1. LRCLIB (for synced lyrics) - Most reliable
    searchPromises.push(
      import('../lrclib-search/utils').then(mod => 
        mod.searchLRCLIB({ artist, title })
      ).catch(() => null)
    );
    
    // 2. Korean sites if Korean - Very reliable for Korean songs
    if (language === 'ko') {
      searchPromises.push(
        import('../korean-scrapers/utils').then(mod => 
          mod.searchKoreanSites({ artist, title })
        ).catch(() => null)
      );
    }
    
    // 3. Gemini Search - Working well
    searchPromises.push(
      import('../gemini-search/utils').then(mod => 
        mod.geminiSearch({ artist, title })
      ).catch(() => null)
    );
    
    // 4. LLM Direct Search (Groq working, others may fail)
    searchPromises.push(
      import('../llm-search/utils').then(mod => 
        mod.llmSearch({ artist, title })
      ).catch(() => null)
    );
    
    // 5. Search Engine (May fail due to API issues)
    if (language !== 'ko') {  // Skip for Korean, we have better sources
      searchPromises.push(
        import('../search-engine/utils').then(mod => 
          mod.searchEngine({ artist, title, engine: 'auto' })
        ).catch(() => null)
      );
    }
    
    // 6. Smart scraper V2 as fallback (May fail due to API issues)
    if (!forceRefresh) {  // Skip if not needed to reduce API calls
      searchPromises.push(
        import('../smart-scraper-v2/utils').then(mod => 
          mod.smartScraperV2({ artist, title, forceRefresh })
        ).catch(() => null)
      );
    }
    
    // Execute all searches
    const searchResults = await Promise.allSettled(searchPromises);
    
    // Collect all valid results
    const allResults: any[] = [];
    const sourceNames = language === 'ko' 
      ? ['lrclib', 'korean-scrapers', 'gemini-search', 'llm-search']
      : (forceRefresh 
        ? ['lrclib', 'gemini-search', 'llm-search', 'search-engine']
        : ['lrclib', 'gemini-search', 'llm-search', 'search-engine', 'smart-scraper-v2']);
    
    searchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const data: any = result.value;
        
        // Handle different response formats
        if (data && data.success) {
          if (data.results && Array.isArray(data.results)) {
            // Multiple results
            data.results.forEach((r: any) => {
              allResults.push({
                ...r,
                source: r.source || sourceNames[index],
                artist: r.artist || artist,
                title: r.title || title
              });
            });
          } else if (data.result) {
            // Single result
            allResults.push({
              ...data.result,
              source: data.result.source || sourceNames[index],
              artist: data.result.artist || artist,
              title: data.result.title || title
            });
          } else if (data.bestResult) {
            // Best result
            allResults.push({
              ...data.bestResult,
              source: data.bestResult.source || sourceNames[index],
              artist: data.bestResult.artist || artist,
              title: data.bestResult.title || title
            });
          } else if (data.lyrics) {
            // Direct lyrics result
            allResults.push({
              ...data,
              source: data.source || sourceNames[index],
              artist: data.artist || artist,
              title: data.title || title
            });
          }
        }
      }
    });
    
    if (allResults.length === 0) {
      timer.fail('No results from any source');
      return NextResponse.json({
        success: false,
        error: 'Could not find lyrics from any source',
        parseInfo: { source: parseSource, artist, title }
      });
    }
    
    // Sort results by quality
    allResults.sort((a, b) => {
      // Priority by source (adjusted for current working APIs)
      const sourcePriority: Record<string, number> = {
        'lrclib': 10,           // Most reliable, has timestamps
        'bugs': 10,             // Korean site, very accurate
        'melon': 9,             // Korean site
        'genie': 9,             // Korean site
        'gemini-direct': 8,     // Gemini 2.5 working well
        'groq': 7,              // Groq working
        'search-engine-genius.com': 6,
        'search-engine-azlyrics.com': 6,
        'llm-search': 5,
        'smart-scraper-v2-groq': 4,
        'smart-scraper-v2-perplexity': 3,
        'smart-scraper-v2-claude': 3,
        'claude': 2,            // Often fails
        'gpt': 2,               // Often fails
        'perplexity': 2,        // Often fails
        'smart-scraper': 1
      };
      
      const aPriority = sourcePriority[a.source] || 0;
      const bPriority = sourcePriority[b.source] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // Then by synced lyrics
      if (a.hasTimestamps !== b.hasTimestamps) {
        return a.hasTimestamps ? -1 : 1;
      }
      
      // Then by confidence
      const aConf = a.confidence || a.finalScore || 0;
      const bConf = b.confidence || b.finalScore || 0;
      if (Math.abs(aConf - bConf) > 0.1) {
        return bConf - aConf;
      }
      
      // Then by length
      return (b.lyrics?.length || 0) - (a.lyrics?.length || 0);
    });
    
    timer.success(`Found ${allResults.length} results`);
    
    // Safe summary logging
    try {
      const successfulSources = allResults.filter(r => r.confidence > 0.5).length;
      logger.summary(searchPromises.length, successfulSources, Date.now() - (timer as any).startTime);
    } catch (summaryError) {
      // Ignore summary error and continue
      console.log(`Found ${allResults.length} results from ${searchPromises.length} sources`);
    }
    
    // Try to consolidate results for better quality
    let finalResult = allResults[0];
    let wasConsolidated = false;
    
    if (allResults.length >= 2) {
      try {
        logger.info('🔀 Attempting to consolidate multiple results...');
        
        // Import and call consolidate directly
        const { consolidateLyrics } = await import('../consolidate/utils');
        const consolidatedData = await consolidateLyrics({
          results: allResults.slice(0, 5), // Top 5 results
          artist,
          title
        });
        
        if (consolidatedData && consolidatedData.success && consolidatedData.lyrics) {
          logger.success('✨ Successfully consolidated lyrics');
          finalResult = {
            ...consolidatedData,
            artist: consolidatedData.artist || artist,
            title: consolidatedData.title || title,
            hasTimestamps: false
          };
          wasConsolidated = true;
          
          // Add consolidated result to the beginning
          allResults.unshift(finalResult);
        }
      } catch (error) {
        logger.warning('Consolidation failed, using best individual result');
      }
    }
    
    // Save best result to cache if good quality
    const bestResult = finalResult;
    if (bestResult && bestResult.confidence > 0.7 && bestResult.lyrics) {
      try {
        // Import and call save directly
        const { saveLyrics } = await import('../save/utils');
        await saveLyrics({
          title: bestResult.title || title,
          artist: bestResult.artist || artist,
          lrc_content: bestResult.lyrics,
          metadata: {
            source: bestResult.source,
            language,
            confidence: bestResult.confidence,
            hasTimestamps: bestResult.hasTimestamps || false,
            wasConsolidated
          }
        });
        logger.success('💾 Saved to cache');
      } catch (error) {
        logger.warning('Failed to save to cache');
      }
    }
    
    return NextResponse.json({
      success: true,
      results: allResults,
      bestResult: finalResult,
      language,
      wasConsolidated,
      parseInfo: {
        source: parseSource,
        original: query || `${providedArtist} - ${providedTitle}`,
        parsed: { artist, title }
      },
      searchTime: Date.now() - (timer as any).startTime
    });
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Smart Scraper V3 error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Language detection
function detectLanguage(text: string): 'ko' | 'ja' | 'en' | 'zh' | 'unknown' {
  const totalChars = text.length;
  if (totalChars === 0) return 'unknown';
  
  const koreanChars = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) || []).length;
  const japaneseChars = (text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
  const chineseChars = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  
  const koreanRatio = koreanChars / totalChars;
  const japaneseRatio = japaneseChars / totalChars;
  const chineseRatio = chineseChars / totalChars;
  const englishRatio = englishChars / totalChars;
  
  if (koreanRatio > 0.3) return 'ko';
  if (japaneseRatio > 0.2) return 'ja';
  if (chineseRatio > 0.3) return 'zh';
  if (englishRatio > 0.5) return 'en';
  
  return 'unknown';
}