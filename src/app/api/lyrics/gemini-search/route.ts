import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Google API Key
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE || ''
);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { artist, title } = await request.json();
    
    if (!artist || !title) {
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }

    console.log(`[Gemini Search] Searching for: ${artist} - ${title}`);
    const startTime = Date.now();

    // Check cache first
    const cacheKey = `${artist}_${title}`.toLowerCase().replace(/\s+/g, '_');
    const cached = await checkCache(cacheKey);
    if (cached) {
      console.log('✅ Cache hit');
      return NextResponse.json({
        success: true,
        lyrics: cached.lyrics,
        source: 'Gemini (Cached)',
        confidence: cached.confidence || 0.95,
        searchTime: (Date.now() - startTime) / 1000
      });
    }

    // Search with Gemini - Updated model name for 2025
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
You are a lyrics database. Your ONLY job is to return the EXACT, COMPLETE lyrics for songs.

Song Information:
- Artist: ${artist}
- Title: ${title}

CRITICAL INSTRUCTIONS:
1. Return ONLY the complete lyrics text - no introductions, no explanations
2. Include EVERY verse, chorus, bridge, outro - the ENTIRE song
3. Preserve the original language (Korean songs in Korean, English in English, etc.)
4. Maintain exact line breaks and formatting as in the original
5. If you cannot find the exact lyrics, return only: "LYRICS_NOT_FOUND"
6. DO NOT add markers like [Verse 1], [Chorus] unless they are part of the original lyrics
7. DO NOT translate or modify the lyrics in any way

IMPORTANT: This is for a karaoke/streaming application where accuracy is critical.
Users need the COMPLETE lyrics to sing along.

Now, return the complete lyrics for "${artist} - ${title}":`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const lyrics = response.text().trim();

    // Check if lyrics were found
    if (!lyrics || lyrics === 'LYRICS_NOT_FOUND' || lyrics.length < 50) {
      // Try alternative search with more context
      const altPrompt = `
Find the complete lyrics for this song. This might be a Korean, Japanese, or English song.

Artist variations to consider:
- ${artist}
- Korean artists often have English stage names (샘킴=Sam Kim, 아이유=IU, 방탄소년단=BTS)

Title variations to consider:
- ${title}
- Could be romanized Korean or translated

Return the COMPLETE lyrics if found, or "LYRICS_NOT_FOUND" if not available.
No explanations, just the lyrics text:`;

      const altResult = await model.generateContent(altPrompt);
      const altResponse = await altResult.response;
      const altLyrics = altResponse.text().trim();

      if (!altLyrics || altLyrics === 'LYRICS_NOT_FOUND' || altLyrics.length < 50) {
        return NextResponse.json({
          success: false,
          error: 'Lyrics not found',
          searchTime: (Date.now() - startTime) / 1000
        });
      }

      // Save to cache
      await saveToCache(cacheKey, altLyrics, artist, title, 0.8);

      return NextResponse.json({
        success: true,
        lyrics: altLyrics,
        source: 'Gemini (Alternative)',
        confidence: 0.8,
        searchTime: (Date.now() - startTime) / 1000
      });
    }

    // Clean up the lyrics
    let cleanedLyrics = lyrics;
    
    // Remove common AI additions
    cleanedLyrics = cleanedLyrics.replace(/^.*?here are the lyrics.*?:\s*/gi, '');
    cleanedLyrics = cleanedLyrics.replace(/^.*?lyrics for.*?:\s*/gi, '');
    cleanedLyrics = cleanedLyrics.replace(/^#+\s+.*$/gm, ''); // Remove markdown headers
    cleanedLyrics = cleanedLyrics.trim();

    // Calculate confidence
    const confidence = calculateConfidence(cleanedLyrics, artist, title);

    // Save to cache
    await saveToCache(cacheKey, cleanedLyrics, artist, title, confidence);

    return NextResponse.json({
      success: true,
      lyrics: cleanedLyrics,
      source: 'Gemini',
      confidence,
      searchTime: (Date.now() - startTime) / 1000,
      cached: false
    });

  } catch (error) {
    console.error('Gemini search error:', error);
    
    // Provide fallback demo lyrics for testing
    if (error instanceof Error && error.message.includes('model')) {
      return NextResponse.json({
        success: true,
        lyrics: `[Demo Lyrics - API Currently Unavailable]\n\n${title} by ${artist}\n\nThis is a demo response\nWhile the API is being fixed\nYou can still test the interface\nWith these placeholder lyrics\n\nLa la la la\nMusic plays on\nIn our hearts forever\nThis beautiful song`,
        source: 'Demo (API Error)',
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
        source: 'Gemini',
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
  
  // Check for Korean/English/Japanese characters
  const hasKorean = /[가-힣]/.test(lyrics);
  const hasEnglish = /[a-zA-Z]/.test(lyrics);
  const hasJapanese = /[ぁ-んァ-ン]/.test(lyrics);
  
  if (hasKorean || hasEnglish || hasJapanese) confidence += 0.1;
  
  // Check for repetitive structure (chorus)
  const uniqueLines = new Set(lines);
  if (uniqueLines.size < lines.length * 0.8) confidence += 0.1;
  
  return Math.min(confidence, 0.95);
}