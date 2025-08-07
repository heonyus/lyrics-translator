import { logger, APITimer } from '@/lib/logger';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Search for lyrics URLs using Perplexity
async function searchWithPerplexity(artist: string, title: string): Promise<string[]> {
  const timer = new APITimer('Perplexity Search');
  
  try {
    const query = `${artist} ${title} lyrics site:genius.com OR site:azlyrics.com OR site:lyrics.com OR site:musixmatch.com`;
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-small-online',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that finds lyrics URLs. Return only URLs, one per line.'
          },
          {
            role: 'user',
            content: `Find the lyrics page URL for "${artist} - ${title}". Search on Genius, AZLyrics, LyricFind, or other lyrics sites. Return only the direct URLs to the lyrics pages.`
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
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
  
  try {
    // Clean HTML to reduce tokens
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .substring(0, 15000); // Limit to 15k chars
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Extract only the song lyrics from the HTML. Return ONLY the lyrics text, no explanations or metadata. Preserve line breaks.'
          },
          {
            role: 'user',
            content: `Extract the lyrics from this HTML:\n\n${cleanedHtml}`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
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
        'Accept-Language': 'en-US,en;q=0.9'
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
    
    if (urls.length === 0) {
      timer.fail('No URLs found');
      return {
        success: false,
        error: 'Could not find lyrics URLs'
      };
    }
    
    logger.info(`📍 Found ${urls.length} potential URLs`);
    
    // Step 2: Fetch and extract lyrics from each URL
    const fetchPromises = urls.slice(0, 3).map(url => fetchAndExtractLyrics(url));
    const results = await Promise.allSettled(fetchPromises);
    
    // Collect valid results
    const validResults = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<any>).value);
    
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