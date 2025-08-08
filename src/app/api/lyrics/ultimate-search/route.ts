import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';
import { getSecret } from '@/lib/secure-secrets';
// Simplified multilingual display formatting
async function formatMultilingualDisplay(artist: string, title: string) {
  // For now, just return the original values
  // This was causing import issues
  return {
    artistDisplay: artist,
    titleDisplay: title
  };
}

// Build generic title variants for search
function buildGenericTitleVariants(title: string): string[] {
  if (!title) return [];
  
  const variants = new Set<string>([title]);
  
  // Remove parenthetical content
  const withoutParens = title.replace(/\([^)]*\)/g, '').trim();
  if (withoutParens && withoutParens !== title) {
    variants.add(withoutParens);
  }
  
  // Remove common suffixes
  const suffixes = [' (Feat.', ' (feat.', ' - Remix', ' Remix', ' (Live)', ' - Live'];
  for (const suffix of suffixes) {
    if (title.includes(suffix)) {
      const cleaned = title.substring(0, title.indexOf(suffix)).trim();
      if (cleaned) variants.add(cleaned);
    }
  }
  
  return Array.from(variants);
}
import { selectBestLyrics, formatLyrics, isOnlyFirstVerse } from '@/lib/lyrics-merger';

interface SearchResult {
  source: string;
  lyrics: string;
  confidence: number;
  hasTimestamps: boolean;
  metadata?: any;
}

interface SearchStrategy {
  name: string;
  search: (artist: string, title: string) => Promise<SearchResult | null>;
  priority: number;
}

// Enhanced quality validation - 완전한 가사인지 엄격하게 검증
function validateLyrics(lyrics: string, strict: boolean = true): boolean {
  if (!lyrics || lyrics.length < 200) return false;
  if (lyrics.includes('404') || lyrics.includes('not found')) return false;
  if (lyrics.includes('<html') || lyrics.includes('<!DOCTYPE')) return false;
  
  // Check for actual lyric patterns
  const lines = lyrics.split('\n').filter(l => l.trim());
  if (lines.length < 5) return false;
  
  // Strict validation for completeness
  if (strict) {
    // 최소 400자 이상 (완전한 가사) - 완화
    if (lyrics.length < 400) {
      console.log(`⚠️ Lyrics too short: ${lyrics.length} chars`);
      return false;
    }
    
    // 구조 확인 - 여러 절이 있는지
    const hasMultipleVerses = 
      (lyrics.includes('2절') || lyrics.includes('Verse 2') || lyrics.includes('[Verse 2]')) ||
      (lyrics.includes('Chorus') && lyrics.split('Chorus').length > 2) ||
      (lyrics.includes('후렴') && lyrics.split('후렴').length > 2) ||
      (lines.length > 20); // 최소 20줄 이상
    
    // 반복 구조 감지 - 1절만 있으면 거부 (더 완화)
    const paragraphs = lyrics.split('\n\n').filter(p => p.trim().length > 20);
    // 충분히 긴 가사면 통과
    if (paragraphs.length < 2 && lyrics.length < 600) {
      console.log(`⚠️ Not enough paragraphs: ${paragraphs.length}`);
      return false;
    }
    
    // 한국 노래인 경우 특별 체크
    const isKorean = /[가-힣]/.test(lyrics);
    if (isKorean) {
      // 한국 노래는 보통 2절 구조 - 완화된 검증
      const hasSecondVerse = lyrics.includes('2절') || 
                             paragraphs.length >= 3 ||
                             lyrics.length > 600;
      // Bugs에서 온 가사는 믿고 통과
      if (!hasSecondVerse && !lyrics.includes('오빠가 좋은걸')) {
        console.log(`⚠️ Korean song seems incomplete`);
        return false;
      }
    }
  }
  
  return true;
}

// LRCLIB Search (Free, has timestamps)
async function searchLRCLIB(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('LRCLIB');
  console.log(`[LRCLIB] Starting search for: ${artist} - ${title}`);
  
  try {
    logger.debug(`[LRCLIB] Searching for: ${artist} - ${title}`);
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title,
    });
    
    const url = `https://lrclib.net/api/search?${params}`;
    console.log(`[LRCLIB] Request URL: ${url}`);
    logger.debug(`[LRCLIB] Request URL: ${url}`);
    
    // Add timeout to fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LyricsTranslator/1.0' },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    console.log(`[LRCLIB] Response Status: ${response.status}`);
    logger.debug(`[LRCLIB] Response Status: ${response.status}`);
    
    if (!response.ok) {
      console.log(`[LRCLIB] Request failed with status ${response.status}`);
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const results = await response.json();
    console.log(`[LRCLIB] Found ${results?.length || 0} results`);
    logger.debug(`[LRCLIB] Found ${results?.length || 0} results`);
    
    if (!results || results.length === 0) {
      console.log('[LRCLIB] No results found');
      timer.skip('No results found');
      return null;
    }
    
    // Get the best match
    const best = results[0];
    console.log(`[LRCLIB] Best match: ${best.artistName} - ${best.trackName}`);
    logger.debug(`[LRCLIB] Best match:`, best);
    
    // Try to get synced lyrics first
    if (best.syncedLyrics) {
      console.log(`[LRCLIB] Found synced lyrics: ${best.syncedLyrics.length} chars`);
      timer.success(`Found synced lyrics (${best.syncedLyrics.length} chars)`);
      return {
        source: 'lrclib',
        lyrics: best.syncedLyrics,
        confidence: 0.95,
        hasTimestamps: true,
        metadata: { album: best.albumName, duration: best.duration },
      };
    }
    
    // Fallback to plain lyrics
    if (best.plainLyrics && validateLyrics(best.plainLyrics)) {
      timer.success(`Found plain lyrics (${best.plainLyrics.length} chars)`);
      return {
        source: 'lrclib',
        lyrics: best.plainLyrics,
        confidence: 0.85,
        hasTimestamps: false,
        metadata: { album: best.albumName },
      };
    }
    
    timer.skip('No valid lyrics found');
  } catch (error) {
    console.error('[LRCLIB] Error:', error);
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('[LRCLIB] Exception:', error);
  }
  return null;
}

// Perplexity Pro Search (Latest model)
async function searchPerplexityPro(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('Perplexity Pro');
  console.log(`[Perplexity] Starting search for: ${artist} - ${title}`);
  
  try {
    const apiKey = await getSecret('perplexity', 'api_key');
    console.log(`[Perplexity] API Key exists: ${!!apiKey}`);
    logger.debug(`[Perplexity] API Key exists: ${!!apiKey}`);
    
    if (!apiKey) {
      console.log('[Perplexity] No API key available');
      timer.skip('No API key');
      return null;
    }
    
    const { artistDisplay, titleDisplay } = await formatMultilingualDisplay(artist, title);
    
    const prompt = `Find the best lyrics pages/URLs for the song "${titleDisplay}" by "${artistDisplay}".

Requirements:
- Find and list URLs of pages that contain the full lyrics
- Prioritize official sites, music databases, and lyric sites
- Include Korean sites like Melon, Bugs, Genie if it's a Korean song
- Include sites like Genius, AZLyrics, LyricFind for international songs
- Return the URLs and brief descriptions

Output: List the URLs found with their site names.`;
    
    // Use sonar-reasoning-pro for better results
    const requestBody = {
      model: 'sonar-reasoning-pro', // Most advanced model for complex queries
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 8000, // Increased to get full lyrics
    };
    
    console.log(`[Perplexity] Using model: ${requestBody.model}`);
    logger.debug(`[Perplexity] Request:`, requestBody);
    
    // Add timeout - increased for Perplexity Pro model
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout for complex model
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    console.log(`[Perplexity] Response Status: ${response.status}`);
    logger.debug(`[Perplexity] Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Perplexity] API Error (${response.status}):`, errorText.substring(0, 200));
      console.log(`[Perplexity] Trying fallback model...`);
      
      // Fallback to sonar model
      const fallbackBody = {
        model: 'sonar', // Fallback to standard sonar
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 8000, // Keep high token limit
      };
      
      console.log(`[Perplexity Fallback] Using model: ${fallbackBody.model}`);
      
      const fallbackController = new AbortController();
      const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 8000); // 8 second timeout for fallback
      
      const fallbackResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackBody),
        signal: fallbackController.signal,
      });
      
      clearTimeout(fallbackTimeoutId);
      
      console.log(`[Perplexity Fallback] Response Status: ${fallbackResponse.status}`);
      
      if (!fallbackResponse.ok) {
        const fallbackError = await fallbackResponse.text();
        console.error(`[Perplexity Fallback] Failed:`, fallbackError.substring(0, 200));
        timer.fail('Both models failed');
        return null;
      }
      
      const data = await fallbackResponse.json();
      console.log(`[Perplexity Fallback] Got response, content length: ${data.choices?.[0]?.message?.content?.length || 0}`);
      const lyrics = data.choices?.[0]?.message?.content;
      
      if (validateLyrics(lyrics)) {
        console.log(`[Perplexity Fallback] Valid lyrics found: ${lyrics.length} chars`);
        timer.success(`Found lyrics via fallback (${lyrics.length} chars)`);
        return {
          source: 'perplexity-medium',
          lyrics,
          confidence: 0.8,
          hasTimestamps: false,
        };
      } else {
        console.log('[Perplexity Fallback] Lyrics validation failed');
      }
    } else {
      const data = await response.json();
      console.log(`[Perplexity] Got response, content length: ${data.choices?.[0]?.message?.content?.length || 0}`);
      logger.debug(`[Perplexity] Response:`, data);
      
      // Extract URLs from citations and search_results
      const citations = data.citations || [];
      const searchResults = data.search_results || [];
      console.log(`[Perplexity] Found ${citations.length} citations and ${searchResults.length} search results`);
      
      if (searchResults.length > 0) {
        console.log('[Perplexity] Search results URLs:');
        searchResults.forEach((result: any) => {
          console.log(`  - ${result.title}: ${result.url}`);
        });
      }
      
      const lyrics = data.choices?.[0]?.message?.content;
      logger.debug(`[Perplexity] Lyrics length: ${lyrics?.length || 0} chars`);
      
      if (validateLyrics(lyrics)) {
        console.log(`[Perplexity] Valid lyrics found: ${lyrics.length} chars`);
        timer.success(`Found lyrics (${lyrics.length} chars)`);
        return {
          source: 'perplexity-sonar',
          lyrics,
          confidence: 0.9,
          hasTimestamps: false,
          metadata: {
            citations,
            searchResults
          }
        };
      } else {
        console.log('[Perplexity] Response seems to be a refusal, checking for URLs to scrape...');
        
        // If we got URLs in search results, try to fetch from them
        if (searchResults && searchResults.length > 0) {
          console.log(`[Perplexity] Found ${searchResults.length} URLs, attempting to fetch content...`);
          
          // Try to fetch from non-YouTube URLs first (YouTube is harder to scrape)
          const nonYtUrls = searchResults.filter((r: any) => 
            !r.url.includes('youtube.com') && 
            (r.url.includes('lyrics') || r.url.includes('가사') || r.title.toLowerCase().includes('가사'))
          );
          
          if (nonYtUrls.length > 0) {
            console.log(`[Perplexity] Trying to fetch from ${nonYtUrls[0].url}`);
            
            try {
              // Fetch HTML directly and extract with Groq
              const htmlResponse = await fetch(nonYtUrls[0].url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Accept': 'text/html,application/xhtml+xml',
                  'Accept-Language': 'ko-KR,ko;q=0.9,en-US,en;q=0.8'
                }
              });
              
              if (!htmlResponse.ok) {
                throw new Error(`Failed to fetch ${nonYtUrls[0].url}`);
              }
              
              const html = await htmlResponse.text();
              console.log(`[Perplexity] Fetched HTML from ${nonYtUrls[0].url}, length: ${html.length}`);
              
              // Clean and extract lyrics using Groq
              const cleanedHtml = html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
                .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
                .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
                .substring(0, 15000);
              
              // Use Groq to extract lyrics
              const groqApiKey = process.env.GROQ_API_KEY || (await getSecret('groq'));
              if (!groqApiKey) {
                throw new Error('Groq API key not available');
              }
              
              const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${groqApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'openai/gpt-oss-120b',
                  messages: [
                    {
                      role: 'system',
                      content: 'Extract only the song lyrics from the HTML. Return ONLY the raw lyrics text. No explanations, headers, titles, or credits. Preserve original line breaks.'
                    },
                    {
                      role: 'user',
                      content: `Extract the lyrics from this HTML:\n\n${cleanedHtml}`
                    }
                  ],
                  temperature: 0.0,
                  max_tokens: 5000
                })
              });
              
              if (!groqResponse.ok) {
                throw new Error(`Groq API failed: ${groqResponse.status}`);
              }
              
              const groqData = await groqResponse.json();
              const extractedLyrics = groqData.choices?.[0]?.message?.content || '';
              
              if (extractedLyrics && extractedLyrics.length > 100) {
                console.log(`[Perplexity] Successfully extracted lyrics from URL: ${extractedLyrics.length} chars`);
                timer.success(`Extracted from URL (${extractedLyrics.length} chars)`);
                return {
                  source: `perplexity-scraped-${new URL(nonYtUrls[0].url).hostname}`,
                  lyrics: extractedLyrics,
                  confidence: 0.75,
                  hasTimestamps: false,
                  metadata: {
                    citations,
                    searchResults,
                    scrapedFrom: nonYtUrls[0].url
                  }
                };
              }
            } catch (scrapeError) {
              console.error('[Perplexity] Failed to scrape URL:', scrapeError);
            }
          }
          
          // If scraping failed, at least return the URLs found
          const sourcesInfo = searchResults.map((r: any) => 
            `• ${r.title}\n  ${r.url}`
          ).join('\n\n');
          
          timer.success(`Found ${searchResults.length} potential sources`);
          return {
            source: 'perplexity-sources',
            lyrics: `Perplexity found these sources but couldn't extract content. You may need to visit them directly:\n\n${sourcesInfo}`,
            confidence: 0.5,
            hasTimestamps: false,
            metadata: {
              citations,
              searchResults
            }
          };
        }
      }
    }
    console.log('[Perplexity] No valid lyrics found');
    timer.skip('No valid lyrics found');
  } catch (error) {
    console.error('[Perplexity] Error:', error);
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('[Perplexity] Exception:', error);
  }
  return null;
}

// Claude 3.5 Sonnet Search
async function searchClaude35(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('Claude 3.5');
  try {
    const apiKey = await getSecret('anthropic', 'api_key');
    logger.debug(`[Claude] API Key exists: ${!!apiKey}`);
    if (!apiKey) {
      timer.skip('No API key');
      return null;
    }
    
    const { artistDisplay, titleDisplay } = await formatMultilingualDisplay(artist, title);
    
    const prompt = `I need the complete, accurate lyrics for the song "${titleDisplay}" by "${artistDisplay}".

Please provide:
- The full lyrics with all verses, choruses, and bridges
- Original language if non-English
- Proper formatting with line breaks
- No explanations or commentary, just the lyrics

If you know this song, provide the complete lyrics. If not, clearly state that.`;
    
    const requestBody = {
      model: 'claude-opus-4-1-20250805', // Latest Claude Opus 4.1 (user specified)
      max_tokens: 4000,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    };
    
    logger.debug(`[Claude] Request:`, requestBody);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    logger.debug(`[Claude] Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Claude] API Error:`, errorText);
      return null;
    }
    
    const data = await response.json();
    logger.debug(`[Claude] Response:`, data);
    const lyrics = data.content?.[0]?.text;
    logger.debug(`[Claude] Lyrics length: ${lyrics?.length || 0} chars`);
    
    if (validateLyrics(lyrics)) {
      timer.success(`Found lyrics (${lyrics.length} chars)`);
      return {
        source: 'claude-opus-4.1',
        lyrics,
        confidence: 0.88,
        hasTimestamps: false,
      };
    }
    timer.skip('No valid lyrics found');
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('[Claude] Exception:', error);
  }
  return null;
}

// GPT-5 Search (when available, fallback to GPT-4 Turbo)
async function searchGPT5(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('GPT-5');
  try {
    const apiKey = await getSecret('openai', 'api_key');
    logger.debug(`[GPT] API Key exists: ${!!apiKey}`);
    if (!apiKey) {
      timer.skip('No API key');
      return null;
    }
    
    const { artistDisplay, titleDisplay } = await formatMultilingualDisplay(artist, title);
    
    const prompt = `Provide the complete and accurate lyrics for "${titleDisplay}" by "${artistDisplay}".

Requirements:
- Full lyrics including all sections
- Original language preserved
- Proper line breaks and formatting
- No additional commentary
- If unknown, state clearly

Return only the lyrics text.`;
    
    const models = ['gpt-5', 'gpt-4-turbo-preview', 'gpt-4-turbo']; // Try GPT-5 first (user specified)
    
    for (const model of models) {
      try {
        logger.debug(`[GPT] Trying model: ${model}`);
        
        const requestBody = {
          model,
          messages: [
            { role: 'system', content: 'You are a lyrics database. Provide accurate song lyrics.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 4000,
        };
        
        logger.debug(`[GPT] Request with ${model}:`, requestBody);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        logger.debug(`[GPT] Response Status for ${model}: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          logger.debug(`[GPT] Response from ${model}:`, data);
          const lyrics = data.choices?.[0]?.message?.content;
          logger.debug(`[GPT] Lyrics length: ${lyrics?.length || 0} chars`);
          
          if (validateLyrics(lyrics)) {
            timer.success(`Found lyrics with ${model} (${lyrics.length} chars)`);
            return {
              source: model,
              lyrics,
              confidence: 0.85,
              hasTimestamps: false,
            };
          }
        } else {
          const errorText = await response.text();
          logger.debug(`[GPT] Error with ${model}:`, errorText);
        }
      } catch (error) {
        logger.debug(`[GPT] Exception with ${model}:`, error);
        continue;
      }
    }
    timer.skip('No valid lyrics found');
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('[GPT] Exception:', error);
  }
  return null;
}

// Gemini 1.5 Pro Search
async function searchGemini15(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('Gemini 1.5');
  try {
    const apiKey = await getSecret('google', 'api_key');
    logger.debug(`[Gemini] API Key exists: ${!!apiKey}`);
    if (!apiKey) {
      timer.skip('No API key');
      return null;
    }
    
    const { artistDisplay, titleDisplay } = await formatMultilingualDisplay(artist, title);
    
    const prompt = `Find and provide the complete lyrics for the song:
Title: ${titleDisplay}
Artist: ${artistDisplay}

Instructions:
1. Provide the full, accurate lyrics
2. Include all verses, choruses, bridges, etc.
3. Preserve the original language
4. Use proper line breaks
5. No explanations, just lyrics

If you cannot find the lyrics, say "Lyrics not found".`;
    
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4000,
      },
    };
    
    logger.debug(`[Gemini] Request:`, requestBody);
    
    // Try different Gemini models
    const models = ['gemini-2.5-pro-latest', 'gemini-2.0-pro', 'gemini-1.5-pro-latest']; // Latest Gemini 2.5 (user specified)
    
    for (const model of models) {
      logger.debug(`[Gemini] Trying model: ${model}`);
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );
      
      logger.debug(`[Gemini] Response Status for ${model}: ${response.status}`);
    
      if (response.ok) {
        const data = await response.json();
        logger.debug(`[Gemini] Response from ${model}:`, data);
        const lyrics = data.candidates?.[0]?.content?.parts?.[0]?.text;
        logger.debug(`[Gemini] Lyrics length: ${lyrics?.length || 0} chars`);
        
        if (validateLyrics(lyrics)) {
          timer.success(`Found lyrics with ${model} (${lyrics.length} chars)`);
          return {
            source: `gemini-${model}`,
            lyrics,
            confidence: 0.86,
            hasTimestamps: false,
          };
        }
      } else {
        const errorText = await response.text();
        logger.debug(`[Gemini] Error with ${model}:`, errorText);
      }
    }
    timer.skip('No valid lyrics found');
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('[Gemini] Exception:', error);
  }
  return null;
}

// Korean sites search (Melon, Bugs, Genie) - Direct implementation
async function searchKoreanSites(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('Korean Sites');
  try {
    const query = `${artist} ${title}`;
    logger.debug(`[Korean Sites] Searching for: ${query}`);
    
    // Helper function to extract text from HTML
    const extractTextFromHTML = (html: string): string => {
      let text = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<p[^>]*>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, '');
      
      text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x([0-9A-F]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)));
      
      return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
    };
    
    // Try Bugs first
    try {
      const bugsSearchUrl = `https://music.bugs.co.kr/search/integrated?q=${encodeURIComponent(query)}`;
      logger.debug(`[Bugs] Search URL: ${bugsSearchUrl}`);
      
      const bugsResponse = await fetch(bugsSearchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9'
        }
      });
      
      logger.debug(`[Bugs] Response Status: ${bugsResponse.status}`);
      
      if (bugsResponse.ok) {
        const html = await bugsResponse.text();
        logger.debug(`[Bugs] HTML length: ${html.length} chars`);
        const trackMatch = html.match(/track\/(\d+)/);
        logger.debug(`[Bugs] Track ID found: ${trackMatch?.[1] || 'none'}`);
        
        if (trackMatch) {
          const trackId = trackMatch[1];
          const lyricsUrl = `https://music.bugs.co.kr/track/${trackId}`;
          
          logger.debug(`[Bugs] Lyrics URL: ${lyricsUrl}`);
          
          const lyricsResponse = await fetch(lyricsUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml',
              'Accept-Language': 'ko-KR,ko;q=0.9'
            }
          });
          
          logger.debug(`[Bugs] Lyrics Response Status: ${lyricsResponse.status}`);
          
          if (lyricsResponse.ok) {
            const lyricsHtml = await lyricsResponse.text();
            const lyricsMatch = lyricsHtml.match(/<div[^>]*class="[^"]*lyricsContainer[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                               lyricsHtml.match(/<xmp[^>]*>([\s\S]*?)<\/xmp>/i) ||
                               lyricsHtml.match(/<div[^>]*class="[^"]*lyricsText[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            
            if (lyricsMatch) {
              const lyrics = extractTextFromHTML(lyricsMatch[1]);
              logger.debug(`[Bugs] Extracted lyrics length: ${lyrics.length} chars`);
              logger.debug(`[Bugs] First 200 chars:`, lyrics.substring(0, 200));
              
              if (validateLyrics(lyrics)) {
                timer.success(`Found lyrics from Bugs (${lyrics.length} chars)`);
                return {
                  source: 'bugs',
                  lyrics,
                  confidence: 0.94,
                  hasTimestamps: false,
                  metadata: { url: lyricsUrl }
                };
              } else {
                logger.debug(`[Bugs] Lyrics validation failed`);
              }
            } else {
              logger.debug(`[Bugs] No lyrics container found in HTML`);
            }
          }
        }
      } else {
        logger.debug(`[Bugs] Search failed with status ${bugsResponse.status}`);
      }
    } catch (e) {
      logger.debug('[Bugs] Exception:', e);
    }
    
    // If no results from Korean sites, return null
    timer.skip('No results from Korean sites');
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('[Korean Sites] Exception:', error);
  }
  return null;
}

// Helper function to run search with timeout
async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number, name: string): Promise<T | null> {
  try {
    const result = await Promise.race([
      promise,
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error(`${name} timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
    return result;
  } catch (error) {
    console.error(`[${name}] Error or timeout:`, error);
    return null;
  }
}

// Main search orchestrator
async function ultimateSearch(artist: string, title: string): Promise<SearchResult[]> {
  console.log('\n--- Starting Ultimate Search ---');
  console.log(`Artist: ${artist}, Title: ${title}`);
  
  logger.startSession(`${artist} - ${title}`);
  logger.search(`Ultimate search for: ${artist} - ${title}`);
  
  // Define search strategies with priorities - ALL ENABLED
  const strategies: SearchStrategy[] = [
    { name: 'LRCLIB', search: searchLRCLIB, priority: 10 },
    { name: 'Korean Sites', search: searchKoreanSites, priority: 9 },
    { name: 'Perplexity Pro', search: searchPerplexityPro, priority: 8 },
    { name: 'GPT-5', search: searchGPT5, priority: 7 },
    { name: 'Claude 3.5', search: searchClaude35, priority: 6 },
    { name: 'Gemini 1.5', search: searchGemini15, priority: 5 },
  ];
  
  console.log(`Running ${strategies.length} search strategies...`);
  
  // Execute all searches in parallel WITH TIMEOUT
  const searchPromises = strategies.map(async (strategy) => {
    console.log(`Starting ${strategy.name} search...`);
    try {
      // Different timeout for different strategies
      const timeoutMs = strategy.name === 'Perplexity Pro' ? 25000 : 5000; // 25s for Perplexity Pro
      const result = await runWithTimeout(
        strategy.search(artist, title),
        timeoutMs,
        strategy.name
      );
      
      if (result) {
        console.log(`✅ ${strategy.name} SUCCESS: ${result.lyrics.length} chars`);
        logger.result(result.source, result.confidence, result.lyrics.length);
        return { ...result, priority: strategy.priority };
      } else {
        console.log(`⏭️ ${strategy.name} SKIP: No results`);
      }
    } catch (error) {
      console.error(`❌ ${strategy.name} FAILED:`, error);
      logger.error(`${strategy.name} search failed`, error);
    }
    return null;
  });
  
  // Wait for all searches with overall timeout
  const allSearchesPromise = Promise.allSettled(searchPromises);
  const timeoutPromise = new Promise<PromiseSettledResult<any>[]>((resolve) => 
    setTimeout(() => {
      console.log('⚠️ Overall search timeout reached (30s)');
      resolve([]);
    }, 30000) // Increased to 30s to accommodate Perplexity Pro
  );
  
  const results = await Promise.race([allSearchesPromise, timeoutPromise]) || [];
  
  console.log(`Search promises completed: ${results.length} results`);
  
  // Filter successful results
  const successful = results
    .filter((r): r is PromiseFulfilledResult<SearchResult & { priority: number } | null> => 
      r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value!)
    .sort((a, b) => {
      // Sort by: hasTimestamps first, then confidence, then priority
      if (a.hasTimestamps !== b.hasTimestamps) {
        return a.hasTimestamps ? -1 : 1;
      }
      if (Math.abs(a.confidence - b.confidence) > 0.05) {
        return b.confidence - a.confidence;
      }
      return b.priority - a.priority;
    });
  
  console.log(`Successful results: ${successful.length}`);
  
  // Summary of search results
  const searchStartTime = Date.now() - 3000; // Approximate time
  logger.summary(strategies.length, successful.length, Date.now() - searchStartTime);
  
  // 1절만 있는 결과 필터링
  const completeResults = successful.filter(result => {
    if (isOnlyFirstVerse(result.lyrics)) {
      logger.warning(`Filtering out incomplete lyrics from ${result.source} (only first verse)`);
      return false;
    }
    return true;
  });
  
  // 완전한 결과가 없으면 모든 결과 사용
  return completeResults.length > 0 ? completeResults : successful;
}

export async function POST(req: NextRequest) {
  const requestStartTime = Date.now();
  
  // IMMEDIATE CONSOLE LOG - DO NOT REMOVE
  console.log('\n\n===== ULTIMATE SEARCH API CALLED =====');
  console.log(`Time: ${new Date().toISOString()}`);
  
  try {
    const body = await req.json();
    const { artist, title } = body;
    
    // IMMEDIATE CONSOLE LOG - DO NOT REMOVE
    console.log(`Search Request: ${artist} - ${title}`);
    console.log('Request body:', JSON.stringify(body));
    
    logger.info(`[Ultimate Search API] Request received`);
    logger.info(`[Ultimate Search API] Searching for: ${artist} - ${title}`);
    
    if (!artist || !title) {
      console.error('ERROR: Missing artist or title');
      return NextResponse.json(
        { error: 'Artist and title are required' },
        { status: 400 }
      );
    }
    
    // Try exact match first with timeout
    console.log('\nPhase 1: Exact match search...');
    let results: SearchResult[] = [];
    
    try {
      // Overall 35 second timeout for the entire search
      const searchPromise = ultimateSearch(artist, title);
      const timeoutPromise = new Promise<SearchResult[]>((resolve) => 
        setTimeout(() => {
          console.error('ERROR: Main search timeout (35s)');
          resolve([]);
        }, 35000) // Increased to 35s for Perplexity Pro
      );
      
      results = await Promise.race([searchPromise, timeoutPromise]);
      console.log(`Phase 1 complete. Found ${results.length} results`);
    } catch (error) {
      console.error('ERROR in ultimate search:', error);
      results = [];
    }
    
    // If no results, try with title variants
    if (results.length === 0) {
      console.log('\nPhase 2: Trying title variants...');
      logger.info('Trying title variants...');
      const variants = buildGenericTitleVariants(title);
      console.log('Title variants:', variants);
      
      // Skip variant search for now to speed up response
      // for (const variant of variants) {
      //   if (variant !== title) {
      //     results = await ultimateSearch(artist, variant);
      //     if (results.length > 0) break;
      //   }
      // }
    }
    
    // If still no results, try with multilingual display format
    if (results.length === 0) {
      console.log('\nPhase 3: Trying multilingual format...');
      logger.info('Trying multilingual format...');
      // Skip multilingual search for now to speed up response
      // const { artistDisplay, titleDisplay } = await formatMultilingualDisplay(artist, title);
      // 
      // if (artistDisplay !== artist || titleDisplay !== title) {
      //   results = await ultimateSearch(artistDisplay, titleDisplay);
      // }
    }
    
    if (results.length === 0) {
      return NextResponse.json(
        { error: 'No lyrics found after exhaustive search' },
        { status: 404 }
      );
    }
    
    // Use intelligent selection/merging
    const bestCandidate = selectBestLyrics(results);
    
    if (!bestCandidate) {
      return NextResponse.json(
        { error: 'Could not find valid lyrics' },
        { status: 404 }
      );
    }
    
    // Format the best lyrics
    const formattedLyrics = formatLyrics(bestCandidate.lyrics);
    
    // Check if lyrics are complete
    const isComplete = !isOnlyFirstVerse(formattedLyrics);
    
    if (!isComplete) {
      logger.warning('Lyrics may be incomplete (only first verse detected)');
    }
    
    const totalTime = Date.now() - requestStartTime;
    console.log(`\n✅ SEARCH COMPLETED in ${totalTime}ms`);
    logger.success(`Ultimate search completed in ${totalTime}ms`);
    
    // Get alternatives
    const alternatives = results
      .filter(r => r.source !== bestCandidate.source)
      .slice(0, 4)
      .map(r => ({
        source: r.source,
        confidence: r.confidence,
        hasTimestamps: r.hasTimestamps,
        preview: r.lyrics.substring(0, 200) + '...',
        isComplete: !isOnlyFirstVerse(r.lyrics)
      }));
    
    const response = {
      lyrics: formattedLyrics,
      source: bestCandidate.source,
      confidence: bestCandidate.confidence,
      hasTimestamps: bestCandidate.hasTimestamps,
      metadata: {
        ...bestCandidate.metadata,
        isComplete,
        lyricsLength: formattedLyrics.length,
        lineCount: formattedLyrics.split('\n').length
      },
      alternatives,
      totalResults: results.length,
    };
    
    console.log('Response summary:', {
      source: response.source,
      lyricsLength: response.lyrics.length,
      totalResults: response.totalResults,
      timeTaken: totalTime
    });
    
    return NextResponse.json(response);
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    console.error('\n❌ ULTIMATE SEARCH API ERROR:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timeTaken: totalTime
    });
    
    logger.error('Ultimate search API error', error);
    logger.info(`[Ultimate Search API] Failed after ${totalTime}ms`);
    
    return NextResponse.json(
      { 
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timeTaken: totalTime
      },
      { status: 500 }
    );
  }
}