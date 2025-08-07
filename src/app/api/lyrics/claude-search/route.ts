import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Claude API Key
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.claude_api_key || '';

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE || ''
);

export async function POST(request: NextRequest) {
  try {
    const { artist, title } = await request.json();
    
    if (!artist || !title) {
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Claude API key not configured' },
        { status: 500 }
      );
    }

    console.log(`[Claude Search] Searching for: ${artist} - ${title}`);
    const startTime = Date.now();

    // Check cache first
    const cacheKey = `${artist}_${title}`.toLowerCase().replace(/\s+/g, '_');
    const cached = await checkCache(cacheKey);
    if (cached) {
      console.log('✅ Cache hit');
      return NextResponse.json({
        success: true,
        lyrics: cached.lyrics,
        source: 'Claude (Cached)',
        confidence: cached.confidence || 0.95,
        searchTime: (Date.now() - startTime) / 1000
      });
    }

    // Search with Claude
    const prompt = `
You are a professional lyrics database assistant. Your task is to provide the EXACT, COMPLETE lyrics for songs.

## CRITICAL CONTEXT:
I am searching for: "${artist}" - "${title}"

## CHAIN OF THOUGHT:
1. Identify the language/origin:
   - Is this a Korean artist/song? (Must return in 한글)
   - Is this a Japanese artist/song? (Must return in 日本語)
   - Is this a Chinese artist/song? (Must return in 中文)
   - Is this an English artist/song? (Must return in English)

2. Recall the complete lyrics:
   - Include ALL verses, choruses, bridges, outros
   - Maintain original language and script
   - Keep exact line breaks and formatting

## EXAMPLES:

Korean Song Example:
Artist: 샘킴 / Title: Make Up
→ Return in 한글:
나도 모르게 시작된 내 마음이
[complete lyrics in Korean]

Japanese Song Example:
Artist: YOASOBI / Title: 夜に駆ける
→ Return in 日本語:
沈むように溶けてゆくように
[complete lyrics in Japanese]

## ABSOLUTE RULES:
1. NEVER romanize or transliterate (no "nado moreuge")
2. Use ORIGINAL script (한글/日本語/中文/English)
3. Return COMPLETE lyrics (every single line)
4. If you don't know the exact lyrics: Return "LYRICS_NOT_FOUND"
5. NO explanations, NO markdown, ONLY the lyrics text

Now, provide the complete lyrics for "${artist}" - "${title}":`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Claude API error:', errorData);
      return NextResponse.json({
        success: false,
        error: 'Claude API request failed',
        searchTime: (Date.now() - startTime) / 1000
      });
    }

    const data = await response.json();
    const lyrics = data.content[0]?.text?.trim();

    // Check if lyrics were found
    if (!lyrics || lyrics === 'LYRICS_NOT_FOUND' || lyrics.length < 50) {
      return NextResponse.json({
        success: false,
        error: 'Lyrics not found',
        searchTime: (Date.now() - startTime) / 1000
      });
    }

    // Clean up the lyrics
    let cleanedLyrics = lyrics;
    
    // Remove any AI explanations
    cleanedLyrics = cleanedLyrics.replace(/^.*?here are the lyrics.*?:?\s*/gi, '');
    cleanedLyrics = cleanedLyrics.replace(/^.*?lyrics for.*?:?\s*/gi, '');
    cleanedLyrics = cleanedLyrics.replace(/^I apologize.*$/gm, '');
    cleanedLyrics = cleanedLyrics.replace(/^Unfortunately.*$/gm, '');
    cleanedLyrics = cleanedLyrics.trim();

    // Calculate confidence
    const confidence = calculateConfidence(cleanedLyrics, artist, title);

    // Save to cache
    await saveToCache(cacheKey, cleanedLyrics, artist, title, confidence);

    return NextResponse.json({
      success: true,
      lyrics: cleanedLyrics,
      source: 'Claude',
      confidence,
      searchTime: (Date.now() - startTime) / 1000,
      cached: false
    });

  } catch (error) {
    console.error('Claude search error:', error);
    
    // Provide fallback demo lyrics when API fails
    if (error instanceof Error && (error.message.includes('credits') || error.message.includes('quota'))) {
      return NextResponse.json({
        success: true,
        lyrics: `[Demo Lyrics - Claude API Unavailable]

${title} by ${artist}

This is a demo response
While the API credits are low
You can still test the interface
With these placeholder lyrics

Verse 1
Singing through the night
Music fills the air

Chorus
La la la la
Music plays on
In our hearts forever
This beautiful song`,
        source: 'Demo (Claude API Error)',
        confidence: 0.5,
        searchTime: 0.1,
        cached: false
      });
    }
    
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

async function checkCache(cacheKey: string) {
  try {
    const { data, error } = await supabase
      .from('ai_lyrics_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .single();

    if (error || !data) return null;

    // Check if cache is still valid (7 days)
    const cacheAge = Date.now() - new Date(data.created_at).getTime();
    if (cacheAge > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Cache check error:', error);
    return null;
  }
}

async function saveToCache(cacheKey: string, lyrics: string, artist: string, title: string, confidence: number) {
  try {
    await supabase
      .from('ai_lyrics_cache')
      .upsert({
        cache_key: cacheKey,
        artist,
        title,
        lyrics,
        confidence,
        source: 'Claude',
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Cache save error:', error);
  }
}

function calculateConfidence(lyrics: string, artist: string, title: string): number {
  let confidence = 0.5;
  
  // Check lyrics quality
  const lines = lyrics.split('\n').filter(l => l.trim());
  
  if (lines.length > 10) confidence += 0.2;
  if (lines.length > 20) confidence += 0.1;
  
  // Check for language consistency
  const hasKorean = /[가-힣]/.test(lyrics);
  const hasEnglish = /[a-zA-Z]/.test(lyrics);
  const hasJapanese = /[ぁ-んァ-ン一-龯]/.test(lyrics);
  const hasChinese = /[\u4e00-\u9fff]/.test(lyrics);
  
  // Language detection bonus
  if (hasKorean || hasEnglish || hasJapanese || hasChinese) confidence += 0.1;
  
  // Check for repetitive structure (chorus)
  const uniqueLines = new Set(lines);
  if (uniqueLines.size < lines.length * 0.8) confidence += 0.1;
  
  // Artist/title mention
  if (lyrics.toLowerCase().includes(artist.toLowerCase())) confidence += 0.05;
  if (lyrics.toLowerCase().includes(title.toLowerCase())) confidence += 0.05;
  
  return Math.min(confidence, 0.95);
}