import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';

// Language detection based on character sets
function detectLanguage(text: string): 'ko' | 'ja' | 'en' | 'unknown' {
  // Korean characters (Hangul)
  if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text)) {
    return 'ko';
  }
  // Japanese characters (Hiragana, Katakana, Kanji)
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
    return 'ja';
  }
  // Default to English for Latin characters
  if (/[a-zA-Z]/.test(text)) {
    return 'en';
  }
  return 'unknown';
}

// Get appropriate search sites based on language
function getSitesByLanguage(language: string) {
  switch (language) {
    case 'ko':
      return ['melon.com', 'bugs.co.kr', 'genie.co.kr', 'music.naver.com'];
    case 'ja':
      return ['uta-net.com', 'j-lyric.net', 'utaten.com', 'petitlyrics.com'];
    case 'en':
    default:
      return ['genius.com', 'azlyrics.com', 'metrolyrics.com', 'songlyrics.com'];
  }
}

export async function POST(request: NextRequest) {
  const timer = new APITimer('Smart Scraper');
  
  try {
    const { artist, title, language: providedLang } = await request.json();
    
    if (!artist || !title) {
      timer.fail('Missing parameters');
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }
    
    logger.search(`🔍 Smart Scraper: "${artist} - ${title}"`);
    
    // Detect language if not provided
    const detectedLang = providedLang || detectLanguage(`${artist} ${title}`);
    logger.info(`Detected language: ${detectedLang}`);
    
    // Get appropriate sites
    const sites = getSitesByLanguage(detectedLang);
    logger.info(`Target sites: ${sites.join(', ')}`);
    
    // Step 1: Use Perplexity to find the best URL
    const urlTimer = new APITimer('URL Search (Perplexity)');
    const urls = await searchURLsWithPerplexity(artist, title, sites);
    
    if (!urls || urls.length === 0) {
      urlTimer.fail('No URLs found');
      return NextResponse.json({
        success: false,
        error: 'Could not find lyrics URL',
        language: detectedLang
      });
    }
    
    urlTimer.success(`Found ${urls.length} URL(s)`);
    logger.info(`URLs found: ${urls.join(', ')}`);
    
    // Step 2: Fetch HTML content
    const htmlTimer = new APITimer('HTML Fetch');
    let html = null;
    let successUrl = null;
    
    for (const url of urls) {
      try {
        html = await fetchHTML(url);
        if (html && html.length > 1000) {
          successUrl = url;
          break;
        }
      } catch (error) {
        console.warn(`Failed to fetch ${url}:`, error);
        continue;
      }
    }
    
    if (!html) {
      htmlTimer.fail('Could not fetch HTML');
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch lyrics page',
        urls: urls
      });
    }
    
    htmlTimer.success(`Fetched ${html.length} chars from ${successUrl}`);
    
    // Step 3: Parse lyrics with Groq (most cost-effective)
    const parseTimer = new APITimer('Parse (Groq)');
    const parsedLyrics = await parseLyricsWithGroq(html, artist, title, detectedLang);
    
    if (!parsedLyrics || parsedLyrics.lyrics.length < 100) {
      parseTimer.fail('Parsing failed or incomplete');
      return NextResponse.json({
        success: false,
        error: 'Could not extract lyrics from page',
        url: successUrl
      });
    }
    
    parseTimer.success(`Parsed ${parsedLyrics.lyrics.length} chars`);
    
    // Calculate confidence score
    const confidence = calculateConfidence(parsedLyrics, detectedLang);
    
    // Log results
    const totalTime = Date.now() - timer['startTime'];
    logger.result('Smart Scraper', confidence, parsedLyrics.lyrics.length);
    logger.summary(1, 1, totalTime);
    
    // Save to database if good quality
    if (confidence > 0.7) {
      try {
        await saveLyricsToDatabase({
          artist,
          title,
          lyrics: parsedLyrics.lyrics,
          language: detectedLang,
          source: successUrl,
          confidence
        });
        logger.success('Saved to database');
      } catch (error) {
        console.warn('Failed to save to database:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      result: {
        artist,
        title,
        lyrics: parsedLyrics.lyrics,
        language: detectedLang,
        source: 'Smart Scraper',
        url: successUrl,
        confidence,
        hasTimestamps: parsedLyrics.hasTimestamps,
        metadata: parsedLyrics.metadata,
        searchTime: totalTime
      }
    });
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Smart Scraper', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Smart scraping failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Search for URLs using Perplexity
async function searchURLsWithPerplexity(artist: string, title: string, sites: string[]): Promise<string[]> {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  
  if (!PERPLEXITY_API_KEY) {
    console.warn('Perplexity API key not found');
    return [];
  }
  
  try {
    // Create site-specific search query
    const siteQuery = sites.map(site => `site:${site}`).join(' OR ');
    const searchQuery = `"${artist}" "${title}" lyrics (${siteQuery})`;
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a URL finder. Return ONLY the direct URLs to lyrics pages, one per line. No explanations.'
          },
          {
            role: 'user',
            content: `Find the direct URL for the lyrics of "${title}" by "${artist}". Search on: ${sites.join(', ')}. Return only URLs, max 3.`
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      console.error('Perplexity API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract URLs from response
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlRegex) || [];
    
    return urls.slice(0, 3); // Return max 3 URLs
    
  } catch (error) {
    console.error('Perplexity search error:', error);
    return [];
  }
}

// Fetch HTML content from URL
async function fetchHTML(url: string): Promise<string> {
  try {
    // Simple fetch for now, can be enhanced with Puppeteer for dynamic content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    return html;
    
  } catch (error) {
    console.error('HTML fetch error:', error);
    throw error;
  }
}

// Parse lyrics from HTML using Groq (most cost-effective)
async function parseLyricsWithGroq(html: string, artist: string, title: string, language: string) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key not found');
  }
  
  try {
    // Truncate HTML if too long (keep relevant parts)
    const truncatedHtml = html.length > 50000 
      ? html.substring(0, 25000) + '...[truncated]...' + html.substring(html.length - 25000)
      : html;
    
    const systemPrompt = `You are a lyrics extractor. Extract ONLY the song lyrics from HTML.
Rules:
1. Return COMPLETE lyrics - every line from start to end
2. Keep original language (${language === 'ko' ? 'Korean/한글' : language === 'ja' ? 'Japanese/日本語' : 'English'})
3. Preserve line breaks and structure
4. Remove any annotations, ads, or non-lyric content
5. If timestamps exist (like [00:00.00]), keep them
6. Return JSON: { "lyrics": "full lyrics here", "hasTimestamps": boolean, "metadata": {} }`;
    
    const userPrompt = `Extract the complete lyrics for "${title}" by "${artist}" from this HTML:\n\n${truncatedHtml}`;
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 8000,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content from Groq');
    }
    
    try {
      const parsed = JSON.parse(content);
      return {
        lyrics: parsed.lyrics || '',
        hasTimestamps: parsed.hasTimestamps || false,
        metadata: parsed.metadata || {}
      };
    } catch (parseError) {
      // Fallback: treat as plain text
      return {
        lyrics: content,
        hasTimestamps: false,
        metadata: {}
      };
    }
    
  } catch (error) {
    console.error('Groq parsing error:', error);
    throw error;
  }
}

// Calculate confidence score
function calculateConfidence(parsedLyrics: any, language: string): number {
  let confidence = 0.5; // Base score
  
  // Check lyrics length
  if (parsedLyrics.lyrics.length > 500) confidence += 0.2;
  if (parsedLyrics.lyrics.length > 1000) confidence += 0.1;
  
  // Check for timestamps
  if (parsedLyrics.hasTimestamps) confidence += 0.2;
  
  // Check language consistency
  const detectedLang = detectLanguage(parsedLyrics.lyrics);
  if (detectedLang === language) confidence += 0.1;
  
  // Check for structure (verses, chorus, etc.)
  const lines = parsedLyrics.lyrics.split('\n').filter((l: string) => l.trim());
  if (lines.length > 20) confidence += 0.1;
  
  return Math.min(confidence, 0.95); // Cap at 0.95
}

// Save to database
async function saveLyricsToDatabase(data: {
  artist: string;
  title: string;
  lyrics: string;
  language: string;
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
        lrc_content: data.lyrics,
        metadata: {
          language: data.language,
          source: 'smart-scraper',
          sourceUrl: data.source,
          confidence: data.confidence,
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