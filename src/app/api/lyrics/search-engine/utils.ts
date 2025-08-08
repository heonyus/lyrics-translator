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
        ? ['klyrics.net', 'colorcodedlyrics.com', 'blog.naver.com', 'm.blog.naver.com', 'tistory.com', 'genius.com', 'azlyrics.com', 'lyrics.com', 'musixmatch.com']
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
      // retry on 429/400 with fallback model and jitter
      if (response.status === 429 || response.status === 400) {
        await new Promise(r => setTimeout(r, 400 + Math.floor(Math.random() * 400)));
        const retry = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: process.env.PERPLEXITY_MODEL_FALLBACK || 'sonar-reasoning-pro',
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
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting song lyrics from HTML pages. Follow this exact process:

STEP-BY-STEP THINKING:
1. First, identify the main lyrics container (usually <div>, <p>, or <pre> tags with lyrics-related classes)
2. Look for patterns: repeated verse/chorus structures, line breaks, rhyming patterns
3. Exclude: navigation, ads, comments, metadata, copyright notices, social media buttons
4. Preserve: original line breaks, verse markers (if any), language-specific characters

FEW-SHOT EXAMPLES:

Example 1 - Korean lyrics:
Input HTML: <div class="lyrics_box">너를 만나고<br/>세상이 달라졌어<br/><br/>[Chorus]<br/>사랑해 너만을</div>
Output:
너를 만나고
세상이 달라졌어

[Chorus]
사랑해 너만을

Example 2 - English with metadata to ignore:
Input HTML: <div>Posted by admin<div class="lyric-text">Hello from the other side<br>I must've called a thousand times</div><span>5 likes</span></div>
Output:
Hello from the other side
I must've called a thousand times

Example 3 - Mixed content:
Input HTML: <article><h1>Song Title</h1><div id="lyrics">첫눈에 반했어<br/>First sight, I fell for you<br/><br/>너무 아름다워</div><div class="ads">Advertisement</div></article>
Output:
첫눈에 반했어
First sight, I fell for you

너무 아름다워

CRITICAL RULES:
- Return ONLY the lyrics text, no HTML tags
- Preserve empty lines between verses/sections
- Keep [Verse], [Chorus], [Bridge] markers if present in the original
- Do NOT add any explanations, titles, or "Here are the lyrics:" type prefaces
- Do NOT include "Written by", "Produced by", copyright text
- If no clear lyrics found, return exactly: "NO_LYRICS_FOUND"`
          },
          {
            role: 'user',
            content: `Extract the song lyrics from this HTML. Think step-by-step:
1. Identify the lyrics container
2. Extract only the song text
3. Clean and format properly

HTML:
${cleanedHtml}`
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