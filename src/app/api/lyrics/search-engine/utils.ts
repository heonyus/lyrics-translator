import { logger, APITimer } from '@/lib/logger';
import { detectDominantLang } from '../quality';

let PERPLEXITY_API_KEY: string | undefined;
let GROQ_API_KEY: string | undefined;
async function loadKeys() {
  if (typeof window !== 'undefined') return;
  const { getSecret } = await import('@/lib/secure-secrets');
  PERPLEXITY_API_KEY = (await getSecret('perplexity')) || process.env.PERPLEXITY_API_KEY;
  GROQ_API_KEY = (await getSecret('groq')) || process.env.GROQ_API_KEY;
}

// Search for lyrics URLs using Perplexity
async function searchWithPerplexity(artist: string, title: string): Promise<string[]> {
  const timer = new APITimer('Perplexity Search');
  await loadKeys();
  
  try {
    const lang = detectDominantLang(`${artist} ${title}`);
    const providers = (
      lang === 'ko'
        ? ['klyrics.net', 'colorcodedlyrics.com', 'genius.com', 'azlyrics.com', 'lyrics.com', 'musixmatch.com']
        : lang === 'ja'
        ? ['uta-net.com', 'utaten.com', 'mojim.com', 'genius.com', 'lyrics.com']
        : ['genius.com', 'azlyrics.com', 'lyrics.com', 'musixmatch.com', 'lyricstranslate.com']
    );
    const query = `${artist} ${title} lyrics site:${providers.join(' OR site:')}`;
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.PERPLEXITY_MODEL || 'gpt-4.1',
        messages: [
          {
            role: 'user',
            content: `Return only canonical lyrics page URLs for "${artist} - ${title}".\nRules:\n- Providers: ${providers.join(', ')}.\n- One URL per line.\n- No duplicates, no commentary, no markdown.\n- Prefer exact song page (not search pages).\n- Exclude URLs containing ?q=, /search, /tag, /category, or artist hubs.`
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      // retry on 429/400
      if (response.status === 429 || response.status === 400) {
        await new Promise(r => setTimeout(r, 600));
        const retry = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: process.env.PERPLEXITY_MODEL_FALLBACK || 'claude-4.0-sonnet',
            messages: [
              { role: 'user', content: `Only output plain URLs (one per line) for the exact lyrics page of "${artist} - ${title}". Sites: ${providers.join(', ')}. Exclude search pages.` }
            ],
            temperature: 0.1,
            max_tokens: 500
          })
        });
        if (!retry.ok) {
          timer.fail(`HTTP ${retry.status}`);
          return [];
        }
        const retryData = await retry.json();
        const retryContent = retryData.choices?.[0]?.message?.content || '';
        const retryUrls = retryContent.match(/https?:\/\/[^\s]+/g) || [];
        timer.success(`Found ${retryUrls.length} URLs`);
        return retryUrls;
      }
      timer.fail(`HTTP ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract URLs from the response
    const urls = content.match(/https?:\/\/[^\s]+/g) || [];
    
    timer.success(`Found ${urls.length} URLs`);
    return urls;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

// Parse HTML and extract lyrics using Groq
async function extractLyricsWithGroq(html: string, url: string): Promise<string | null> {
  const timer = new APITimer('Groq Extract');
  await loadKeys();
  
  try {
    // Clean HTML to reduce tokens
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .substring(0, 12000); // smaller context for speed
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3-groq-70b-tool-use',
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
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const lyrics = data.choices?.[0]?.message?.content || '';
    
    if (lyrics && lyrics.length > 100) {
      timer.success(`Extracted ${lyrics.length} chars from ${url}`);
      return lyrics;
    }
    
    timer.fail('Lyrics too short');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Fetch page and extract lyrics
async function fetchAndExtractLyrics(url: string): Promise<any | null> {
  try {
    logger.info(`📄 Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US,en;q=0.8'
      }
    });
    
    if (!response.ok) {
      logger.warning(`Failed to fetch ${url}: HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Try to extract lyrics with Groq
    const lyrics = await extractLyricsWithGroq(html, url);
    
    if (lyrics) {
      return {
        lyrics,
        source: new URL(url).hostname.replace('www.', ''),
        url,
        confidence: 0.8
      };
    }
    
    return null;
    
  } catch (error) {
    logger.error(`Error fetching ${url}:`, error);
    return null;
  }
}

// Main search function
export async function searchEngine({ 
  artist, 
  title, 
  engine = 'auto' 
}: { 
  artist: string; 
  title: string; 
  engine?: 'auto' | 'google' | 'naver' | 'perplexity'
}) {
  const timer = new APITimer('Search Engine');
  
  logger.info(`🔍 Search engine (${engine}): ${artist} - ${title}`);
  
  try {
    // Ensure keys are loaded before checks
    await loadKeys();
    // Check if APIs are available
    if (!GROQ_API_KEY) {
      timer.skip('Groq API key missing');
      return {
        success: false,
        message: 'Search engine not configured (Groq missing)'
      };
    }
    
    // Skip Perplexity if not available
    if (!PERPLEXITY_API_KEY) {
      logger.warning('Perplexity API key missing, search engine limited');
      // Continue without Perplexity, just return empty result
      timer.skip('Perplexity not available');
      return {
        success: false,
        message: 'Search engine limited without Perplexity'
      };
    }
    
    // Step 1: Search for URLs with Perplexity
  const urls = await searchWithPerplexity(artist, title);
  await new Promise(r => setTimeout(r, 120));
    
    if (urls.length === 0) {
      timer.fail('No URLs found');
      return {
        success: false,
        error: 'Could not find lyrics URLs'
      };
    }
    
    logger.info(`📍 Found ${urls.length} potential URLs`);
    
    // Step 2: Fetch and extract lyrics from each URL
    const fetchPromises = urls.slice(0, 5).map(url => fetchAndExtractLyrics(url));
  const results = [] as any[];
  for (const p of fetchPromises) {
    results.push(await p);
    await new Promise(r => setTimeout(r, 120));
  }
    
    // Collect valid results
  const validResults = results.filter((r: any) => r).map((r: any) => r);
    
    if (validResults.length === 0) {
      timer.fail('No lyrics extracted from URLs');
      return {
        success: false,
        error: 'Could not extract lyrics from found pages'
      };
    }
    
    // Sort by confidence and length
    validResults.sort((a, b) => {
      const confDiff = b.confidence - a.confidence;
      if (Math.abs(confDiff) > 0.1) return confDiff;
      return b.lyrics.length - a.lyrics.length;
    });
    
    timer.success(`Found lyrics from ${validResults[0].source}`);
    
    return {
      success: true,
      results: validResults,
      result: {
        ...validResults[0],
        artist,
        title,
        source: `search-engine-${validResults[0].source}`,
        hasTimestamps: false,
        searchTime: Date.now() - (timer as any).startTime
      }
    };
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Search Engine error:', error);
    
    return {
      success: false,
      error: 'Search engine failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}