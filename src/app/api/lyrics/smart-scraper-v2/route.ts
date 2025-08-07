import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';

// Site-specific selectors for better parsing
const SITE_SELECTORS: Record<string, any> = {
  'bugs.co.kr': {
    lyrics: ['div.lyricsContainer', 'pre.lyric-content', 'xmp', 'section.sectionPadding.lyrics'],
    title: ['h1.pgTitle', '.trackInfo .title'],
    artist: ['.artistInfo .name', '.trackInfo .artist']
  },
  'melon.com': {
    lyrics: ['div.lyric', 'div#d_video_summary', 'div.lyric_area'],
    title: ['.song_name'],
    artist: ['.artist']
  },
  'genie.co.kr': {
    lyrics: ['pre#pLyrics', 'div.lyrics-content', 'div#pLyrics'],
    title: ['.info-title'],
    artist: ['.info-artist']
  },
  'music.naver.com': {
    lyrics: ['div.lyrics_txt', 'div#lyricText'],
    title: ['h2.title'],
    artist: ['.artist']
  },
  'genius.com': {
    lyrics: ['div[data-lyrics-container]', 'div.lyrics', 'div.Lyrics__Container'],
    title: ['h1.SongHeader__Title'],
    artist: ['a.SongHeader__Artist']
  },
  'azlyrics.com': {
    lyrics: ['div.col-xs-12.col-lg-8', 'div.ringtone ~ div'],
    title: ['h1'],
    artist: ['.lyricsh h2']
  }
};

// Language detection with better accuracy
function detectLanguage(text: string): 'ko' | 'ja' | 'en' | 'zh' | 'unknown' {
  const totalChars = text.length;
  
  // Count character types
  const koreanChars = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) || []).length;
  const japaneseChars = (text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
  const chineseChars = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  
  // Calculate ratios
  const koreanRatio = koreanChars / totalChars;
  const japaneseRatio = japaneseChars / totalChars;
  const chineseRatio = chineseChars / totalChars;
  const englishRatio = englishChars / totalChars;
  
  // Determine primary language
  if (koreanRatio > 0.3) return 'ko';
  if (japaneseRatio > 0.2) return 'ja';
  if (chineseRatio > 0.3) return 'zh';
  if (englishRatio > 0.5) return 'en';
  
  return 'unknown';
}

// Validate lyrics quality
function validateLyrics(lyrics: string, expectedLang?: string): {
  isValid: boolean;
  confidence: number;
  issues: string[];
} {
  const lines = lyrics.split('\n').filter(l => l.trim());
  const uniqueLines = new Set(lines);
  const issues: string[] = [];
  let confidence = 1.0;
  
  // Check minimum length
  if (lyrics.length < 300) {
    issues.push('Too short (< 300 chars)');
    confidence -= 0.3;
  }
  
  // Check minimum lines
  if (lines.length < 10) {
    issues.push('Too few lines (< 10)');
    confidence -= 0.3;
  }
  
  // Check for too much repetition
  const repetitionRatio = uniqueLines.size / lines.length;
  if (repetitionRatio < 0.3) {
    issues.push('Too repetitive');
    confidence -= 0.2;
  }
  
  // Check for control characters or garbage
  if (/[\x00-\x08\x0B-\x0C\x0E-\x1F]/.test(lyrics)) {
    issues.push('Contains control characters');
    confidence -= 0.4;
  }
  
  // Check for only numbers/symbols
  const hasActualLyrics = lines.some(line => 
    /[a-zA-Z가-힣ぁ-ゔァ-ヴー一-龯]{3,}/.test(line)
  );
  if (!hasActualLyrics) {
    issues.push('No actual lyrics found');
    confidence -= 0.5;
  }
  
  // Language consistency check
  if (expectedLang) {
    const detectedLang = detectLanguage(lyrics);
    if (detectedLang !== expectedLang && detectedLang !== 'unknown') {
      issues.push(`Language mismatch: expected ${expectedLang}, got ${detectedLang}`);
      confidence -= 0.2;
    }
  }
  
  // Check for common error patterns
  if (lyrics.includes('404') || lyrics.includes('Not Found') || lyrics.includes('Error')) {
    issues.push('Contains error messages');
    confidence -= 0.5;
  }
  
  return {
    isValid: confidence > 0.5,
    confidence: Math.max(0, Math.min(1, confidence)),
    issues
  };
}

// Extract text content from HTML
function extractTextFromHTML(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Convert br tags to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ');
  text = text.trim();
  
  return text;
}

// Find longest text block that looks like lyrics
function findLyricsBlock(html: string): string | null {
  // Try to find specific containers first
  const containerPatterns = [
    /<div[^>]*class="[^"]*lyric[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<pre[^>]*>([\s\S]*?)<\/pre>/gi,
    /<xmp[^>]*>([\s\S]*?)<\/xmp>/gi,
    /<p[^>]*>([\s\S]*?)<\/p>/gi
  ];
  
  const blocks: string[] = [];
  
  for (const pattern of containerPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const text = extractTextFromHTML(match[1]);
      if (text.length > 200) {
        blocks.push(text);
      }
    }
  }
  
  // Find the best block
  let bestBlock = '';
  let bestScore = 0;
  
  for (const block of blocks) {
    const lines = block.split('\n').filter(l => l.trim());
    const score = lines.length * 10 + block.length;
    
    // Bonus for Korean/Japanese/Chinese content
    if (/[가-힣ぁ-ゔァ-ヴー一-龯]/.test(block)) {
      score * 1.5;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestBlock = block;
    }
  }
  
  return bestBlock || null;
}

// Multi-source search function
async function searchMultipleSources(artist: string, title: string, language: string) {
  const results: any[] = [];
  
  // 1. Try search engines first (Naver/Google) - highest priority
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/search-engine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, title, engine: 'auto' })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.result) {
        results.push({
          ...data.result,
          priority: 0.98, // Highest priority for search engines
          validation: {
            isValid: true,
            confidence: data.result.confidence,
            issues: []
          }
        });
        logger.success(`Found lyrics from ${data.result.source}`);
      }
    }
  } catch (error) {
    logger.warning('Search engine failed:', error);
  }
  
  // 2. Try Korean scrapers for Korean songs
  if (language === 'ko') {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/korean-scrapers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.results) {
          results.push(...data.results.map((r: any) => ({
            ...r,
            source: `korean-scrapers-${r.source}`,
            priority: 0.95
          })));
        }
      }
    } catch (error) {
      logger.warning('Korean scrapers failed:', error);
    }
  }
  
  // 2. Try LRCLIB (has synced lyrics)
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/lrclib-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, title })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.lyrics) {
        results.push({
          ...data,
          source: 'lrclib',
          priority: 0.9,
          hasTimestamps: true
        });
      }
    }
  } catch (error) {
    logger.warning('LRCLIB failed:', error);
  }
  
  // 3. Try Perplexity search
  try {
    const sites = language === 'ko' 
      ? ['bugs.co.kr', 'melon.com', 'genie.co.kr']
      : ['genius.com', 'azlyrics.com'];
      
    const urls = await searchURLsWithPerplexity(artist, title, sites);
    
    for (const url of urls) {
      try {
        const html = await fetchHTML(url);
        const lyrics = await extractLyricsFromHTML(html, url, artist, title);
        
        if (lyrics) {
          const validation = validateLyrics(lyrics, language);
          if (validation.isValid) {
            results.push({
              lyrics,
              source: new URL(url).hostname,
              url,
              priority: 0.8,
              confidence: validation.confidence,
              hasTimestamps: false
            });
          }
        }
      } catch (error) {
        logger.warning(`Failed to process ${url}:`, error);
      }
    }
  } catch (error) {
    logger.warning('Perplexity search failed:', error);
  }
  
  return results;
}

// Extract lyrics from HTML with site-specific logic
async function extractLyricsFromHTML(html: string, url: string, artist: string, title: string): Promise<string | null> {
  const domain = new URL(url).hostname.replace('www.', '');
  const selectors = SITE_SELECTORS[domain];
  
  // Try site-specific selectors first
  if (selectors) {
    for (const selector of selectors.lyrics) {
      const pattern = new RegExp(`<[^>]*(?:class|id)="[^"]*${selector}[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'gi');
      const match = pattern.exec(html);
      if (match) {
        const text = extractTextFromHTML(match[1]);
        if (text.length > 200) {
          return text;
        }
      }
    }
  }
  
  // Fallback to finding longest text block
  const lyricsBlock = findLyricsBlock(html);
  if (lyricsBlock) {
    return lyricsBlock;
  }
  
  // Last resort: use AI extraction
  try {
    const parsed = await parseLyricsWithGroq(html, artist, title, detectLanguage(`${artist} ${title}`));
    return parsed.lyrics;
  } catch (error) {
    logger.warning('AI extraction failed:', error);
    return null;
  }
}

// Main handler
export async function POST(request: NextRequest) {
  const timer = new APITimer('Smart Scraper V2');
  
  try {
    const { artist, title, language: providedLang, forceRefresh = false } = await request.json();
    
    if (!artist || !title) {
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }
    
    logger.search(`🔍 Smart Scraper V2: "${artist} - ${title}"`);
    
    // Detect language
    const language = providedLang || detectLanguage(`${artist} ${title}`);
    logger.info(`Language: ${language}`);
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cacheResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/lyrics/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `${artist} ${title}` })
        });
        
        if (cacheResponse.ok) {
          const cacheData = await cacheResponse.json();
          if (cacheData.success && cacheData.lyrics) {
            logger.success('Found in cache');
            return NextResponse.json({
              success: true,
              results: [{
                ...cacheData.lyrics,
                source: 'cache',
                fromCache: true
              }]
            });
          }
        }
      } catch (error) {
        logger.warning('Cache check failed:', error);
      }
    }
    
    // Search multiple sources
    const results = await searchMultipleSources(artist, title, language);
    
    if (results.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No lyrics found from any source',
        language
      });
    }
    
    // Sort by priority and confidence
    results.sort((a, b) => {
      // Prioritize synced lyrics
      if (a.hasTimestamps !== b.hasTimestamps) {
        return a.hasTimestamps ? -1 : 1;
      }
      // Then by priority
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Then by confidence
      return (b.confidence || 0) - (a.confidence || 0);
    });
    
    // Validate all results
    const validatedResults = results.map(result => {
      const validation = validateLyrics(result.lyrics, language);
      return {
        ...result,
        validation,
        finalScore: result.priority * validation.confidence
      };
    });
    
    // Log summary
    timer.success(`Found ${validatedResults.length} results`);
    logger.summary(validatedResults.length, validatedResults.filter(r => r.validation.isValid).length, Date.now() - timer['startTime']);
    
    return NextResponse.json({
      success: true,
      results: validatedResults,
      bestResult: validatedResults[0],
      language
    });
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Smart Scraper V2', error);
    
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

// Helper functions from the original file
async function searchURLsWithPerplexity(artist: string, title: string, sites: string[]): Promise<string[]> {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  
  if (!PERPLEXITY_API_KEY) {
    return [];
  }
  
  try {
    const siteQuery = sites.map(site => `site:${site}`).join(' OR ');
    
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
            content: 'Return ONLY direct URLs to lyrics pages, one per line.'
          },
          {
            role: 'user',
            content: `Find lyrics URL for "${title}" by "${artist}" on: ${sites.join(', ')}`
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlRegex) || [];
    
    return urls.slice(0, 3);
    
  } catch (error) {
    return [];
  }
}

async function fetchHTML(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.text();
}

async function parseLyricsWithGroq(html: string, artist: string, title: string, language: string) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key not found');
  }
  
  // Smart truncation
  const MAX_LENGTH = 30000;
  let processedHtml = html;
  
  if (html.length > MAX_LENGTH) {
    const keywords = ['lyrics', '가사', 'lyric-body'];
    let startIndex = 0;
    
    for (const keyword of keywords) {
      const index = html.toLowerCase().indexOf(keyword);
      if (index > 0) {
        startIndex = Math.max(0, index - 2000);
        break;
      }
    }
    
    processedHtml = html.substring(startIndex, Math.min(startIndex + MAX_LENGTH, html.length));
  }
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Extract COMPLETE song lyrics. Return JSON: {"lyrics": "full lyrics", "hasTimestamps": boolean}`
        },
        {
          role: 'user',
          content: `Extract complete lyrics for "${title}" by "${artist}" from HTML:\n${processedHtml}`
        }
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
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
  
  return {
    lyrics: parsed.lyrics || '',
    hasTimestamps: parsed.hasTimestamps || false,
    metadata: {}
  };
}