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
        model: process.env.PERPLEXITY_MODEL || 'sonar-reasoning-pro',
        messages: [
          {
            role: 'system',
            content: `You are a lyrics URL finder expert.

## CHAIN OF THOUGHT PROCESS:
Step 1: Identify the language of the artist/song (Korean/Japanese/English)
Step 2: Search for LYRICS pages, NOT video/streaming platforms
Step 3: Prioritize official lyrics sites for the identified language
Step 4: Find direct song pages with complete lyrics
Step 5: Return only clean, canonical URLs

## PRIORITY SITES BY LANGUAGE:
Korean: bugs.co.kr, melon.com, genie.co.kr, flo.co.kr
Japanese: uta-net.com, utaten.com, j-lyric.net
English: genius.com, azlyrics.com, lyrics.com
Blogs: blog.naver.com, tistory.com (Korean lyrics often posted here)

## FORBIDDEN SITES:
- youtube.com, youtu.be (video platform)
- spotify.com, apple.com (streaming)
- soundcloud.com, music.amazon.com (streaming)
- wikipedia.org (not lyrics)`
          },
          {
            role: 'user',
            content: `## FEW-SHOT EXAMPLES:

Example 1 - Korean:
Query: "폴킴 - 커피한잔할래요"
GOOD URLs:
- https://music.bugs.co.kr/track/31651797
- https://www.melon.com/song/detail.htm?songId=31651797
- https://blog.naver.com/username/221234567890 (if contains full lyrics)
BAD URLs:
- https://www.youtube.com/watch?v=abc123
- https://open.spotify.com/track/xyz

Example 2 - English:
Query: "Ed Sheeran - Perfect"
GOOD URLs:
- https://genius.com/Ed-sheeran-perfect-lyrics
- https://www.azlyrics.com/lyrics/edsheeran/perfect.html
BAD URLs:
- https://www.youtube.com/results?search_query=ed+sheeran
- https://en.wikipedia.org/wiki/Perfect_(Ed_Sheeran_song)

Example 3 - Japanese:
Query: "米津玄師 - Lemon"
GOOD URLs:
- https://www.uta-net.com/song/255974/
- https://utaten.com/lyric/ja19021801/
BAD URLs:
- https://www.youtube.com/watch?v=SX_ViT4Ra7k

## YOUR TASK:
Find lyrics page URLs for: "${artist} - ${title}"

CRITICAL: ABSOLUTELY NO YouTube, Spotify, Apple Music, SoundCloud URLs!

Search query structure:
"${artist} ${title}" lyrics -site:youtube.com -site:youtu.be -site:spotify.com
site:bugs.co.kr OR site:melon.com OR site:genie.co.kr OR site:${providers.slice(0,3).join(' OR site:')}

RULES:
1. MUST search in: ${providers.join(', ')}
2. MUST EXCLUDE: youtube.com, youtu.be, spotify.com, apple.com, soundcloud.com
3. Return ONLY direct lyrics pages (not search results)
4. One URL per line, no commentary
5. If you return ANY YouTube/streaming URLs, the search fails completely`
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
            model: 'sonar-medium-online',
            messages: [
              { 
                role: 'user', 
                content: `Find LYRICS pages (NOT YouTube/Spotify) for "${artist} - ${title}".
Prioritize: ${providers.slice(0, 5).join(', ')}
Return only direct song URLs, one per line.` 
              }
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
async function extractLyricsWithGroq(html: string, url: string, retryCount = 0): Promise<{ lyrics: string; metadata?: any } | null> {
  const timer = new APITimer('Groq Extract');
  await loadKeys();
  
  console.log(`\n🔍 [Groq Extract] Starting extraction from ${url}`);
  console.log(`📝 [Groq Extract] HTML length: ${html.length} bytes`);
  
  try {
    // Rate limiting: wait before making request (exponential backoff on retries)
    const delay = retryCount > 0 ? Math.min(1000 * Math.pow(2, retryCount), 8000) : 0;
    if (delay > 0) {
      console.log(`⏳ [Groq Extract] Waiting ${delay}ms before retry attempt ${retryCount}...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Clean HTML to reduce tokens
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .substring(0, 12000); // smaller context for speed
    
    console.log(`🧹 [Groq Extract] Cleaned HTML: ${cleanedHtml.length} bytes (reduced by ${html.length - cleanedHtml.length} bytes)`);
    console.log(`🚀 [Groq Extract] Sending request to Groq API...`);
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting complete song lyrics AND metadata from HTML pages.

## CHAIN OF THOUGHT PROCESS:
Step 1: Scan HTML for title, artist, album metadata (h1, title tags, meta tags)
Step 2: Identify lyrics containers (divs, p, pre tags)
Step 3: Recognize patterns - verses, choruses, bridges, repeated sections
Step 4: Extract all lyrics preserving structure and line breaks
Step 5: Validate completeness - ensure multiple verses, not just snippets
Step 6: Clean formatting - remove HTML but keep verse markers

## FEW-SHOT EXAMPLES:

### Example 1 - Korean (Bugs/Melon style):
Input HTML:
<div class="lyrics"><p>Breeze<br/>가벼운 바람이 깨우는 Oh breeze<br/>너의 생각으로 시작하는<br/>My everyday<br/><br/>Breath<br/>뭔가 좋은 일이 생길 것 같은<br/>절로 콧노래가 흘러나오는<br/>그런 상상을 하게 해</p></div>

Output:
Breeze
가벼운 바람이 깨우는 Oh breeze
너의 생각으로 시작하는
My everyday

Breath
뭔가 좋은 일이 생길 것 같은
절로 콧노래가 흘러나오는
그런 상상을 하게 해

### Example 2 - English (Genius style):
Input HTML:
<div data-lyrics="true">[Verse 1]<br/>Hello, it's me<br/>I was wondering if after all these years<br/><br/>[Chorus]<br/>Hello from the other side<br/>I must've called a thousand times</div>

Output:
[Verse 1]
Hello, it's me
I was wondering if after all these years

[Chorus]
Hello from the other side
I must've called a thousand times

### Example 3 - Japanese (Uta-net style):
Input HTML:
<div id="kashi_area">君の名前を<br>呼んでいる<br><br>どこにいても<br>君を探してる</div>

Output:
君の名前を
呼んでいる

どこにいても
君を探してる

### Example 4 - Mixed with ads to ignore:
Input HTML:
<article><div class="ad">Buy Premium!</div><div class="lyrics-body"><p>첫눈에 반했어<br/>너무 아름다워<br/><br/>매일 꿈꾸는<br/>너와의 미래</p></div><footer>Share on Facebook</footer></article>

Output:
첫눈에 반했어
너무 아름다워

매일 꿈꾸는
너와의 미래

## CRITICAL EXTRACTION RULES:
- Extract COMPLETE lyrics (ALL verses, choruses, bridges)
- Lyrics characteristics:
  * Multiple paragraphs/sections
  * Emotional/poetic language
  * Line breaks between verses
  * Repetition (chorus repeated)
  * May have [Verse], [Chorus] markers
- Combine ALL text blocks that look like lyrics
- Remove HTML but preserve structure
- Exclude: navigation, ads, comments, share buttons
- Extract metadata when visible (artist, title, album)
- Return JSON format with lyrics and metadata fields
- If lyrics seem incomplete (only 1 verse), set lyrics field to "INCOMPLETE_LYRICS"
- If no lyrics found, set lyrics field to "NO_LYRICS_FOUND"
- IMPORTANT: Collect ALL lyric sections, not just the first block`
          },
          {
            role: 'user',
            content: `Extract the complete song lyrics AND metadata from this HTML.

IMPORTANT: Think through the chain of thought INTERNALLY but output ONLY a JSON object.
Do NOT output your thinking process, steps, or any analysis.

Return a JSON object with this EXACT structure:
{
  "lyrics": "[complete lyrics text or NO_LYRICS_FOUND]",
  "metadata": {
    "artist": "[artist name if found, or null]",
    "title": "[song title if found, or null]",
    "album": "[album name if found, or null]"
  }
}

HTML to process:
${cleanedHtml}`
          }
        ],
        temperature: 0.0,
        max_tokens: 5000
      })
    });
    
    console.log(`📡 [Groq Extract] Response status: ${response.status} ${response.statusText}`);
    
    if (response.status === 429) {
      console.log(`⚠️ [Groq Extract] Rate limit hit (429)`);
      timer.fail(`Rate limit (attempt ${retryCount + 1})`);
      
      // Retry with exponential backoff
      if (retryCount < 3) {
        console.log(`🔄 [Groq Extract] Retrying... (attempt ${retryCount + 2}/4)`);
        return extractLyricsWithGroq(html, url, retryCount + 1);
      } else {
        console.log(`❌ [Groq Extract] Max retries reached, giving up`);
        return null;
      }
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ [Groq Extract] API error: ${errorText.substring(0, 200)}`);
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log(`📄 [Groq Extract] Raw response length: ${content.length} chars`);
    
    // Try to parse as JSON
    let parsedResult;
    try {
      parsedResult = JSON.parse(content);
    } catch (e) {
      // If not JSON, treat as plain lyrics for backward compatibility
      console.log(`⚠️ [Groq Extract] Response is not JSON, treating as plain lyrics`);
      parsedResult = {
        lyrics: content,
        metadata: { artist: null, title: null, album: null }
      };
    }
    
    const lyrics = parsedResult.lyrics || '';
    const metadata = parsedResult.metadata || {};
    
    console.log(`📄 [Groq Extract] Extracted lyrics length: ${lyrics.length} chars`);
    if (metadata.artist || metadata.title) {
      console.log(`📄 [Groq Extract] Metadata: Artist="${metadata.artist}" Title="${metadata.title}"`);
    }
    
    // Check if Groq returned debug text instead of lyrics
    if (lyrics.includes('Step 1:') || lyrics.includes('## Step') || lyrics.includes('main lyrics container')) {
      console.log(`⚠️ [Groq Extract] Debug text detected, not actual lyrics`);
      timer.fail('Debug text instead of lyrics');
      return null;
    }
    
    if (lyrics === 'NO_LYRICS_FOUND' || lyrics === 'INCOMPLETE_LYRICS') {
      console.log(`⚠️ [Groq Extract] ${lyrics}`);
      timer.fail(lyrics);
      return null;
    }
    
    if (lyrics && lyrics.length > 100) {
      console.log(`✅ [Groq Extract] Successfully extracted ${lyrics.length} chars from ${new URL(url).hostname}`);
      timer.success(`Extracted ${lyrics.length} chars from ${url}`);
      return { lyrics, metadata };
    }
    
    console.log(`⚠️ [Groq Extract] Lyrics too short: ${lyrics.length} chars`);
    timer.fail('Lyrics too short');
    return null;
    
  } catch (error) {
    console.log(`💥 [Groq Extract] Exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Fetch page and extract lyrics
async function fetchAndExtractLyrics(url: string): Promise<any | null> {
  try {
    console.log(`
🌐 [URL Fetch] Starting fetch for: ${url}`);
    console.log(`🌐 [URL Fetch] Domain: ${new URL(url).hostname}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US,en;q=0.8'
      }
    });
    
    console.log(`📡 [URL Fetch] Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.log(`❌ [URL Fetch] Failed to fetch ${url}: HTTP ${response.status}`);
      logger.warning(`Failed to fetch ${url}: HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    console.log(`📄 [URL Fetch] HTML received: ${html.length} bytes`);
    console.log(`📄 [URL Fetch] HTML snippet: "${html.substring(0, 100).replace(/\n/g, ' ')}..."`);
    
    // Check if this is actually a lyrics page
    const looksLikeLyrics = html.includes('lyrics') || 
                           html.includes('가사') || 
                           html.includes('歌詞') ||
                           html.includes('verse') ||
                           html.includes('chorus');
    
    if (!looksLikeLyrics) {
      console.log(`⚠️ [URL Fetch] Page doesn't look like a lyrics page, skipping extraction`);
      return null;
    }
    
    console.log(`✅ [URL Fetch] Page appears to contain lyrics, proceeding with extraction`);
    
    // Try to extract lyrics with Groq
    const result = await extractLyricsWithGroq(html, url);
    
    if (result) {
      console.log(`🎯 [URL Fetch] Successfully extracted ${result.lyrics.length} chars from ${url}`);
      return {
        lyrics: result.lyrics,
        metadata: result.metadata,
        source: new URL(url).hostname.replace('www.', ''),
        url,
        confidence: 0.8
      };
    }
    
    console.log(`⚠️ [URL Fetch] No lyrics extracted from ${url}`);
    return null;
    
  } catch (error) {
    console.log(`💥 [URL Fetch] Error fetching ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  
  // Filter out non-lyrics URLs
  const filteredUrls = urls.filter(url => {
    const urlLower = url.toLowerCase();
    const hostname = new URL(url).hostname.toLowerCase();
    
    // Exclude video/streaming platforms
    if (hostname.includes('youtube.com') || 
        hostname.includes('spotify.com') || 
        hostname.includes('apple.com') ||
        hostname.includes('soundcloud.com') ||
        hostname.includes('music.amazon.com')) {
      console.log(`🚫 [URL Filter] Excluded streaming platform: ${url}`);
      return false;
    }
    
    // Exclude search/tag/category pages
    if (urlLower.includes('?q=') || 
        urlLower.includes('/search') || 
        urlLower.includes('/tag/') ||
        urlLower.includes('/category/') ||
        urlLower.includes('/artist/')) {
      console.log(`🚫 [URL Filter] Excluded search/category page: ${url}`);
      return false;
    }
    
    console.log(`✅ [URL Filter] Accepted: ${url}`);
    return true;
  });
  
  // Prioritize known good lyrics sites
  const prioritizedUrls = filteredUrls.sort((a, b) => {
    const getPriority = (url: string) => {
      const hostname = new URL(url).hostname.toLowerCase();
      if (hostname.includes('bugs.co.kr')) return 0;
      if (hostname.includes('melon.com')) return 1;
      if (hostname.includes('genie.co.kr')) return 2;
      if (hostname.includes('genius.com')) return 3;
      if (hostname.includes('azlyrics.com')) return 4;
      if (hostname.includes('lyrics.com')) return 5;
      if (hostname.includes('colorcodedlyrics.com')) return 6;
      return 10;
    };
    return getPriority(a) - getPriority(b);
  });
  
  console.log(`📊 [URL Filter] Filtered: ${filteredUrls.length}/${urls.length} URLs`);
  if (prioritizedUrls.length > 0) {
    console.log(`🎯 [URL Filter] Top priority URL: ${prioritizedUrls[0]}`);
  }
  
  if (prioritizedUrls.length === 0) {
    timer.fail('No valid lyrics URLs after filtering');
    return {
      success: false,
      error: 'All found URLs were filtered out (streaming/search pages)'
    };
  }
  
  // Step 2: Fetch and extract lyrics from each URL SEQUENTIALLY
  console.log(`
🔄 [Sequential Processing] Starting to process ${Math.min(prioritizedUrls.length, 5)} URLs sequentially...`);
  
  const results = [];
  for (let i = 0; i < Math.min(prioritizedUrls.length, 5); i++) {
    const url = prioritizedUrls[i];
    console.log(`
📍 [Sequential ${i+1}/5] Processing: ${url}`);
    
    // Wait 1 second between each URL to avoid rate limiting
    if (i > 0) {
      console.log(`⏳ [Sequential] Waiting 1s before next URL...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    
    const result = await fetchAndExtractLyrics(url);
    if (result) {
      results.push(result);
      console.log(`✅ [Sequential ${i+1}/5] Success: extracted ${result.lyrics.length} chars`);
      
      // If we got good lyrics, we can stop early
      if (result.lyrics.length > 500) {
        console.log(`🎯 [Sequential] Found good lyrics (${result.lyrics.length} chars), stopping early`);
        break;
      }
    } else {
      console.log(`❌ [Sequential ${i+1}/5] Failed to extract from ${url}`);
    }
  }
  
  console.log(`
📊 [Sequential Complete] Extracted lyrics from ${results.length}/${Math.min(prioritizedUrls.length, 5)} URLs`);
  
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
        artist: validResults[0].metadata?.artist || artist,
        title: validResults[0].metadata?.title || title,
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