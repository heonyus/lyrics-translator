import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// OpenAI API Key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

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

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    console.log(`[GPT Search] Searching for: ${artist} - ${title}`);
    const startTime = Date.now();

    // Check cache first
    const cacheKey = `${artist}_${title}`.toLowerCase().replace(/\s+/g, '_');
    const cached = await checkCache(cacheKey);
    if (cached) {
      console.log('✅ Cache hit');
      return NextResponse.json({
        success: true,
        lyrics: cached.lyrics,
        source: 'GPT-4 (Cached)',
        confidence: cached.confidence || 0.9,
        searchTime: (Date.now() - startTime) / 1000
      });
    }

    // Search with GPT-4
    const systemPrompt = `You are a lyrics database expert. Return ONLY the complete, original lyrics.

CRITICAL RULES:
1. Korean songs: Return in 한글
2. Japanese songs: Return in 日本語 (ひらがな/カタカナ/漢字)
3. Chinese songs: Return in 中文
4. English songs: Return in English
5. NEVER romanize (no "nado moreuge" for Korean)
6. Include ALL verses, choruses, bridges
7. If unknown: Return "LYRICS_NOT_FOUND"`;

    const userPrompt = `Find the complete lyrics for:
Artist: ${artist}
Title: ${title}

Return ONLY the lyrics text, no explanations.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json({
        success: false,
        error: 'OpenAI API request failed',
        searchTime: (Date.now() - startTime) / 1000
      });
    }

    const data = await response.json();
    const lyrics = data.choices[0]?.message?.content?.trim();

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
    cleanedLyrics = cleanedLyrics.replace(/^.*?here are the lyrics.*?:?\s*/gi, '');
    cleanedLyrics = cleanedLyrics.replace(/^#+\s+.*$/gm, '');
    cleanedLyrics = cleanedLyrics.trim();

    // Calculate confidence
    const confidence = calculateConfidence(cleanedLyrics, artist, title);

    // Save to cache
    await saveToCache(cacheKey, cleanedLyrics, artist, title, confidence);

    return NextResponse.json({
      success: true,
      lyrics: cleanedLyrics,
      source: 'GPT-4',
      confidence,
      searchTime: (Date.now() - startTime) / 1000,
      cached: false
    });

  } catch (error) {
    console.error('GPT search error:', error);
    
    // Provide fallback demo lyrics when API fails
    if (error instanceof Error && (error.message.includes('quota') || error.message.includes('limit'))) {
      return NextResponse.json({
        success: true,
        lyrics: `[Demo Lyrics - OpenAI API Unavailable]

${title} by ${artist}

This is a demo response
While the API quota is exceeded
You can still test the interface
With these placeholder lyrics

Verse 1
Dreaming of tomorrow
Music in my soul

Chorus
Sing along with me
Feel the rhythm flow
Let the music take you
Wherever you want to go`,
        source: 'Demo (OpenAI API Error)',
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
        source: 'GPT-4',
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Cache save error:', error);
  }
}

function calculateConfidence(lyrics: string, artist: string, title: string): number {
  let confidence = 0.5;
  
  const lines = lyrics.split('\n').filter(l => l.trim());
  
  if (lines.length > 10) confidence += 0.2;
  if (lines.length > 20) confidence += 0.1;
  
  const hasKorean = /[가-힣]/.test(lyrics);
  const hasEnglish = /[a-zA-Z]/.test(lyrics);
  const hasJapanese = /[ぁ-んァ-ン一-龯]/.test(lyrics);
  
  if (hasKorean || hasEnglish || hasJapanese) confidence += 0.1;
  
  const uniqueLines = new Set(lines);
  if (uniqueLines.size < lines.length * 0.8) confidence += 0.1;
  
  return Math.min(confidence, 0.9);
}