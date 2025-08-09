import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';
import { runUltimateEngine } from './engine';
import { getSecret } from '@/lib/secure-secrets';
import { searchEngine } from '../search-engine/utils';
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
// Compute simple normalized length score (0..1)
function computeLengthScore(text: string): number {
  const len = (text || '').length;
  // 0 at 100, 1 at 1200+ (smooth ramp)
  const min = 100;
  const max = 1200;
  if (len <= min) return 0;
  if (len >= max) return 1;
  return (len - min) / (max - min);
}

// Lightweight similarity between two lyrics (0..1) using line shingling
function computeSimilarity(a: string, b: string): number {
  const norm = (t: string) => t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\n ]+/gu, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  const la = new Set(norm(a));
  const lb = new Set(norm(b));
  if (la.size === 0 || lb.size === 0) return 0;
  let inter = 0;
  la.forEach(line => { if (lb.has(line)) inter++; });
  const union = la.size + lb.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Source weight by reliability
function getSourceWeight(source: string): number {
  const s = (source || '').toLowerCase();
  if (s.includes('bugs')) return 1.0;
  if (s.includes('melon')) return 0.98;
  if (s.includes('genie')) return 0.96;
  if (s.includes('lrclib')) return 0.9;
  if (s.includes('search-engine-mw.genie') || s.includes('search-engine-bugs') || s.includes('search-engine-melon')) return 0.94;
  // LLM direct
  if (s.includes('perplexity') || s.includes('gemini') || s.includes('gpt')) return 0.5;
  return 0.6;
}


interface SearchStrategy {
  name: string;
  search: (artist: string, title: string) => Promise<SearchResult | null>;
  priority: number;
}

// AI 메타 텍스트 감지 함수
function detectAIMetaText(text: string): boolean {
  // AI가 생성한 설명/안내 텍스트 패턴
  const aiPatterns = [
    /I cannot access/i,
    /I don't have.*real-time/i,
    /real-time web content/i,
    /search directly/i,
    /I'd recommend/i,
    /To find.*lyrics/i,
    /actual current URLs/i,
    /I cannot provide/i,
    /I'm unable to/i,
    /please check/i,
    /you can search/i,
    /visit.*website/i,
    /try searching/i
  ];
  
  // 패턴 매치 확인
  const hasAIPattern = aiPatterns.some(pattern => pattern.test(text));
  
  // 가사 형태(줄바꿈이 많은 다행식 텍스트)는 대화체 휴리스틱을 적용하지 않음(오탐 방지)
  const lineCount = text.split('\n').filter(l => l.trim()).length;
  if (lineCount >= 5) {
    return hasAIPattern;
  }
  
  // 추가 휴리스틱: "I", "you" 등 대화체 비율이 매우 높은 짧은 단락만 의심 (임계치 상향)
  const conversationalWords = (text.match(/\b(I|you|your|we|our|please|would|could|should)\b/gi) || []).length;
  const totalWords = text.split(/\s+/).length;
  const conversationalRatio = conversationalWords / Math.max(totalWords, 1);
  
  return hasAIPattern || conversationalRatio > 0.25;
}

// Enhanced quality validation - 완전한 가사인지 엄격하게 검증
function validateLyrics(lyrics: string, strict: boolean = true): boolean {
  if (!lyrics || lyrics.length < 200) return false;
  if (lyrics.includes('404') || lyrics.includes('not found')) return false;
  if (lyrics.includes('<html') || lyrics.includes('<!DOCTYPE')) return false;
  
  // AI 메타 텍스트면 즉시 거부
  if (detectAIMetaText(lyrics)) {
    console.log(`⚠️ AI meta text detected, rejecting`);
    return false;
  }
  
  // Check for actual lyric patterns
  const lines = lyrics.split('\n').filter(l => l.trim());
  if (lines.length < 5) return false;
  
  // Strict validation for completeness
  if (strict) {
    // 한국 노래인 경우 더 관대한 기준 적용
    const isKorean = /[가-힣]/.test(lyrics);
    
    if (isKorean) {
      // 한국 노래는 300자 이상이면 통과 (많은 한국 노래가 짧음)
      if (lyrics.length < 300) {
        console.log(`⚠️ Korean lyrics too short: ${lyrics.length} chars`);
        return false;
      }
      // 한국 노래는 구조 체크 안함 (발라드 등은 단순 구조)
      console.log(`✅ Korean lyrics validated: ${lyrics.length} chars`);
      return true;
    }
    
    // 영어/기타 노래는 기존 기준
    if (lyrics.length < 400) {
      console.log(`⚠️ Lyrics too short: ${lyrics.length} chars`);
      return false;
    }
    
    // 구조 확인 - 여러 절이 있는지
    const hasMultipleVerses = 
      (lyrics.includes('Verse 2') || lyrics.includes('[Verse 2]')) ||
      (lyrics.includes('Chorus') && lyrics.split('Chorus').length > 2) ||
      (lines.length > 20); // 최소 20줄 이상
    
    // 반복 구조 감지
    const paragraphs = lyrics.split('\n\n').filter(p => p.trim().length > 20);
    if (paragraphs.length < 2 && lyrics.length < 600) {
      console.log(`⚠️ Not enough paragraphs: ${paragraphs.length}`);
      return false;
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

// Search Engine with Perplexity + Groq
async function searchWithEngine(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('Search Engine');
  try {
    const result = await searchEngine({ artist, title });
    if (result.success && result.result) {
      timer.success(`Found lyrics from ${result.result.source}`);
      return {
        source: result.result.source,
        lyrics: result.result.lyrics,
        confidence: result.result.confidence || 0.85,
        hasTimestamps: false,
        metadata: result.result
      };
    }
    timer.skip('No results');
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
  }
  return null;
}

// Perplexity Pro Search (Latest model)
async function searchPerplexityPro(artist: string, title: string): Promise<SearchResult | null> {
  const timer = new APITimer('Perplexity Pro');
  console.log(`[Perplexity] Starting search for: ${artist} - ${title}`);
  
  try {
    const apiKey = await getSecret('perplexity') || process.env.PERPLEXITY_API_KEY;
    console.log(`[Perplexity] API Key exists: ${!!apiKey}`);
    logger.debug(`[Perplexity] API Key exists: ${!!apiKey}`);
    
    if (!apiKey) {
      console.log('[Perplexity] No API key available');
      timer.skip('No API key');
      return null;
    }
    
    const { artistDisplay, titleDisplay } = await formatMultilingualDisplay(artist, title);
    
    const prompt = `Find actual lyrics websites for "${titleDisplay}" by "${artistDisplay}".

IMPORTANT REQUIREMENTS:
- EXCLUDE: YouTube, Spotify, Apple Music, SoundCloud, video/streaming sites
- ONLY include dedicated lyrics websites with full text lyrics
- Priority sites: Genius.com, AZLyrics.com, Lyrics.com, Musixmatch.com
- Korean: Bugs.co.kr/track/*, Melon.com, Genie.co.kr, ColorCodedLyrics.com
- Japanese: Uta-net.com, Utaten.com, J-Lyric.net
- Return ONLY direct lyrics page URLs (not search results)
- Format: One URL per line, no descriptions or markdown`;
    
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
        
        // If we got URLs in search results, try to fetch from them via shared search-engine extractor
        if (searchResults && searchResults.length > 0) {
          console.log(`[Perplexity] Found ${searchResults.length} URLs, attempting to fetch content...`);
          // Import shared extractor to avoid duplicating Groq logic and rate-limits
          const { searchEngine } = await import('../search-engine/utils');
          // Choose best candidate URL by allowlist + priority handled in searchEngine
          const engineResult = await searchEngine({ artist, title, engine: 'perplexity' });
          if (engineResult.success && engineResult.result?.lyrics) {
            const best = engineResult.result;
            timer.success(`Extracted via search-engine (${best.source})`);
            return {
              source: best.source,
              lyrics: best.lyrics,
              confidence: best.confidence || 0.8,
              hasTimestamps: false,
              metadata: { citations, searchResults, scrapedFrom: best.url }
            };
          }
          // Fallback: return the sources list for UI
          const sourcesInfo = searchResults.map((r: any) => `• ${r.title}\n  ${r.url}`).join('\n\n');
          timer.success(`Found ${searchResults.length} potential sources`);
          return {
            source: 'perplexity-sources',
            lyrics: `Perplexity found these sources but couldn't extract content. You may need to visit them directly:\n\n${sourcesInfo}`,
            confidence: 0.5,
            hasTimestamps: false,
            metadata: { citations, searchResults }
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
    const apiKey = await getSecret('anthropic') || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
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
    const apiKey = await getSecret('openai') || process.env.OPENAI_API_KEY;
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
    const apiKey = await getSecret('google') || process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
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
    const models = ['gemini-2.0-flash-exp', 'gemini-exp-1206', 'gemini-1.5-flash-latest']; // Use working Gemini models
    
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
    { name: 'Search Engine', search: searchWithEngine, priority: 8 },
    { name: 'Perplexity Pro', search: searchPerplexityPro, priority: 7 },
    { name: 'GPT-5', search: searchGPT5, priority: 6 },
    { name: 'Claude 3.5', search: searchClaude35, priority: 5 },
    { name: 'Gemini 1.5', search: searchGemini15, priority: 4 },
  ];
  
  console.log(`Running ${strategies.length} search strategies...`);
  
  // Group strategies by priority for controlled execution
  const priorityGroups = {
    high: strategies.filter(s => s.priority >= 8),     // LRCLIB, Korean, Search Engine
    medium: strategies.filter(s => s.priority >= 6 && s.priority < 8), // Perplexity, GPT
    low: strategies.filter(s => s.priority < 6)        // Claude, Gemini
  };
  
  const allResults: (SearchResult & { priority: number })[] = [];
  
  // Execute high priority group first (fast, reliable sources)
  console.log(`
🚀 Executing HIGH priority group (${priorityGroups.high.length} strategies)...`);
  const highPromises = priorityGroups.high.map(async (strategy) => {
    console.log(`Starting ${strategy.name} search...`);
    try {
      const timeoutMs = strategy.name === 'Search Engine' ? 60000 : 5000; // 60s for Search Engine to allow Perplexity + Groq
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
  
  const highResults = await Promise.allSettled(highPromises);
  highResults.forEach(r => {
    if (r.status === 'fulfilled' && r.value) {
      allResults.push(r.value);
    }
  });
  
  // Only skip other groups if we have REALLY good results
  const hasExcellentResult = allResults.some(r => r.lyrics.length > 800 && r.confidence > 0.9);
  
  // Always try medium priority unless we have excellent results
  if (!hasExcellentResult) {
    // Execute medium priority group
    console.log(`
⚡ Executing MEDIUM priority group (${priorityGroups.medium.length} strategies)...`);
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 350));
    
    const mediumPromises = priorityGroups.medium.map(async (strategy) => {
      console.log(`Starting ${strategy.name} search...`);
      try {
        const timeoutMs = strategy.name === 'Perplexity Pro' ? 25000 : 10000;
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
    
    const mediumResults = await Promise.allSettled(mediumPromises);
    mediumResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        allResults.push(r.value);
      }
    });
  }
  
  // Run low priority to get more sources for comparison
  const hasEnoughSources = allResults.filter(r => r.lyrics.length > 400).length >= 3;
  
  if (!hasEnoughSources) {
    console.log(`
🔍 Executing LOW priority group (${priorityGroups.low.length} strategies)...`);
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const lowPromises = priorityGroups.low.map(async (strategy) => {
      console.log(`Starting ${strategy.name} search...`);
      try {
        const timeoutMs = 10000;
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
    
    const lowResults = await Promise.allSettled(lowPromises);
    lowResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        allResults.push(r.value);
      }
    });
  }
  
  console.log(`
📊 Total results collected: ${allResults.length}`);
  
  // Sort results by quality
  const successful = allResults
    .filter(r => r !== null)
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
  
  // No need for Promise.race since we're already handling timeouts in groups
  
  console.log(`Successful results after all groups: ${successful.length}`);
  
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
    const { query, artist: providedArtist, title: providedTitle } = body;
    
    // IMMEDIATE CONSOLE LOG - DO NOT REMOVE
    console.log('Request body:', JSON.stringify(body));
    
    // Parse query if needed
    let artist = providedArtist;
    let title = providedTitle;
    
    if (!artist || !title) {
      if (query) {
        console.log(`🔍 Parsing query: "${query}"`);
        try {
          // Call parse-query API
          const parseResponse = await fetch(`${req.url.replace('/ultimate-search', '/parse-query')}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
          });
          
          if (parseResponse.ok) {
            const parseData = await parseResponse.json();
            if (parseData.success && parseData.parsed) {
              artist = parseData.parsed.artist || '';
              title = parseData.parsed.title || query;
              console.log(`✅ Parsed: Artist="${artist}" Title="${title}"`);
            } else {
              // Fallback parsing
              const parts = query.split(/[-–—]/).map((p: string) => p.trim());
              if (parts.length === 2) {
                artist = parts[0];
                title = parts[1];
              } else {
                artist = '';
                title = query;
              }
              console.log(`⚠️ Fallback parse: Artist="${artist}" Title="${title}"`);
            }
          }
        } catch (parseError) {
          console.error('Parse error:', parseError);
          // Simple fallback
          artist = '';
          title = query;
        }
      } else {
        console.error('ERROR: No query, artist, or title provided');
        return NextResponse.json(
          { error: 'Either query or artist+title are required' },
          { status: 400 }
        );
      }
    }
    
    // IMMEDIATE CONSOLE LOG - DO NOT REMOVE
    console.log(`Search Request: ${artist} - ${title}`);
    
    logger.info(`[Ultimate Search API] Request received`);
    logger.info(`[Ultimate Search API] Searching for: ${artist} - ${title}`);
    
    // Try exact match first (no global timeout to avoid premature cutoff)
    console.log('\nPhase 1: Exact match search...');
    let results: SearchResult[] = [];
    try {
      const engineResults = await runUltimateEngine({ artist, title });
      results = engineResults.map(r => ({
        source: r.source,
        lyrics: r.lyrics,
        confidence: r.confidence,
        hasTimestamps: r.hasTimestamps,
        metadata: r.metadata
      }));
      console.log(`Phase 1 complete. Found ${results.length} results`);
    } catch (error) {
      console.error('ERROR in engine search:', error);
      results = [];
    }
    
    // If no results, try with title variants
    if (results.length === 0) {
      console.log('\nPhase 2: Trying title variants...');
      logger.info('Trying title variants...');
      const variants = buildGenericTitleVariants(title);
      console.log('Title variants:', variants);
      for (const variant of variants) {
        if (variant !== title) {
          const variantResults = await ultimateSearch(artist, variant);
          results = results.concat(variantResults);
          if (results.length > 0) break;
        }
      }
    }
    
    // If still no results, try with multilingual display format
    if (results.length === 0) {
      console.log('\nPhase 3: Trying multilingual format...');
      logger.info('Trying multilingual format...');
      const { artistDisplay, titleDisplay } = await formatMultilingualDisplay(artist, title);
      if (artistDisplay !== artist || titleDisplay !== title) {
        const multiResults = await ultimateSearch(artistDisplay, titleDisplay);
        results = results.concat(multiResults);
      }
    }
    
    if (results.length === 0) {
      return NextResponse.json(
        { error: 'No lyrics found after exhaustive search' },
        { status: 404 }
      );
    }
    
    // 가사 검증 및 AI 텍스트 필터링
    type AugmentedResult = SearchResult & {
      rejected?: boolean;
      reason?: string;
      verified?: boolean;
      verifyConfidence?: number;
    };

    const verifiedResults: AugmentedResult[] = await Promise.all(
      results.map(async (result): Promise<AugmentedResult> => {
        // AI 메타 텍스트 감지
        if (detectAIMetaText(result.lyrics)) {
          console.log(`⚠️ [Ultimate] AI meta text detected in ${result.source}, rejecting`);
          return { ...result, rejected: true, reason: 'AI meta text' };
        }
        
        // LLM 검증 (옵션)
        try {
          const verifyResponse = await fetch(`${req.url.replace('/ultimate-search', '/verify')}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              artist,
              title,
              lyrics: result.lyrics
            })
          });
          
          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            if (verifyData.success && verifyData.verification) {
              const { isCorrect, confidence, isAIText } = verifyData.verification;
              
              if (isAIText) {
                console.log(`⚠️ [Ultimate] LLM detected AI text in ${result.source}`);
                return { ...result, rejected: true, reason: 'LLM detected AI text' };
              }
              
              return {
                ...result,
                verified: isCorrect,
                verifyConfidence: confidence
              };
            }
          }
        } catch (verifyError) {
          console.log(`⚠️ [Ultimate] Verification failed for ${result.source}`);
        }
        
        return result;
      })
    );
    
    // 거부된 결과 제외
    const validResults = verifiedResults.filter((r) => !r.rejected);
    
    if (validResults.length === 0) {
      // 결과가 모두 AI 텍스트로 의심되더라도, 사용자가 확인할 수 있도록 후보 URL/요약을 반환
      const fallback = results[0];
      return NextResponse.json(
        {
          error: 'All results were flagged as AI text',
          hint: '검증을 통과하지 못했지만, 아래 후보를 직접 확인해보세요.',
          candidate: fallback ? {
            source: fallback.source,
            preview: fallback.lyrics.substring(0, 200) + '...'
          } : null
        },
        { status: 200 }
      );
    }
    
    // 고품질 스코어링 기반 선택 (길이/출처/교차일치/검증 가중치)
    const withScores = validResults.map((r, idx, arr) => {
      const lengthScore = computeLengthScore(r.lyrics); // 0..1
      const sourceWeight = getSourceWeight(r.source);   // 0.5..1.0
      const verifiedBonus = (r.verified ? 0.1 : 0) + (r.verifyConfidence ? Math.min(r.verifyConfidence / 100, 0.1) : 0);
      // 교차 일치: 다른 결과들과의 평균 유사도
      let sim = 0;
      if (arr.length > 1) {
        let sum = 0, cnt = 0;
        for (let i = 0; i < arr.length; i++) {
          if (i === idx) continue;
          sum += computeSimilarity(r.lyrics, arr[i].lyrics);
          cnt++;
        }
        sim = cnt > 0 ? sum / cnt : 0;
      }
      const composite = 0.45 * lengthScore + 0.35 * sourceWeight + 0.2 * sim + verifiedBonus;
      return { r, composite };
    });
    withScores.sort((a, b) => b.composite - a.composite);
    const sortedResults = withScores.map(x => x.r);
    
    const bestCandidate = sortedResults[0];
    
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
    
    // Get alternatives with quality ordering
    const alternatives = sortedResults
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
      artist: artist || bestCandidate.metadata?.artist || '',
      title: title || bestCandidate.metadata?.title || '',
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