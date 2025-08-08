import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSecret } from '@/lib/secure-secrets';

interface MultilingualResponse {
  artistDisplay: string;
  titleDisplay: string;
  artistOriginal: string;
  titleOriginal: string;
  language: string;
}

// Language detection helper
function detectLanguage(text: string): string {
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko'; // Korean
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja'; // Japanese
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh'; // Chinese
  if (/[\u0600-\u06FF]/.test(text)) return 'ar'; // Arabic
  if (/[\u0E00-\u0E7F]/.test(text)) return 'th'; // Thai
  if (/^[a-zA-Z\s\d\-.,!?'"]+$/.test(text)) return 'en'; // English
  return 'unknown';
}

// Call multiple LLMs for best result
async function getMultilingualDisplay(
  artist: string,
  title: string
): Promise<MultilingualResponse> {
  const artistLang = detectLanguage(artist);
  const titleLang = detectLanguage(title);
  
  // If already English, just uppercase
  if (artistLang === 'en' && titleLang === 'en') {
    return {
      artistDisplay: artist,
      titleDisplay: title,
      artistOriginal: artist,
      titleOriginal: title,
      language: 'en',
    };
  }
  
  // Try multiple LLMs in parallel for best accuracy
  const results = await Promise.allSettled([
    callPerplexity(artist, title),
    callClaude(artist, title),
    callGemini(artist, title),
  ]);
  
  // Get first successful result
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      return result.value;
    }
  }
  
  // Fallback: simple uppercase
  return {
    artistDisplay: `${artist} (${artist.toUpperCase().replace(/[^A-Z0-9\s]/g, '')})`,
    titleDisplay: `${title} (${title.toUpperCase().replace(/[^A-Z0-9\s]/g, '')})`,
    artistOriginal: artist,
    titleOriginal: title,
    language: artistLang || titleLang || 'unknown',
  };
}

// Perplexity API call
async function callPerplexity(artist: string, title: string): Promise<MultilingualResponse | null> {
  try {
    const apiKey = await getSecret('perplexity', 'api_key');
    if (!apiKey) return null;
    
    const prompt = `Convert artist and song to multilingual display format.

Input:
Artist: ${artist}
Title: ${title}

Rules:
1. For Korean artists: 한글 (ROMANIZED)
   Example: 크러쉬 → 크러쉬 (CRUSH)
2. For Japanese: 日本語 (ROMANIZED)
   Example: 星野源 → 星野源 (HOSHINOGEN)
3. For Chinese: 中文 (ROMANIZED)
   Example: 周杰倫 → 周杰倫 (JAY CHOU)
4. Keep original script and add uppercase romanization in parentheses
5. Remove feat./ft. from romanization

Return ONLY this JSON (no other text):
{
  "artistDisplay": "original (ROMANIZED)",
  "titleDisplay": "original (ROMANIZED)",
  "artistOriginal": "original",
  "titleOriginal": "original",
  "language": "detected language code"
}`;
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-reasoning-pro',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });
    
    if (!response.ok) {
      logger.error('Perplexity API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    // Extract JSON from response
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed as MultilingualResponse;
    }
  } catch (error) {
    logger.error('Perplexity multilingual error:', error);
  }
  return null;
}

// Claude API call
async function callClaude(artist: string, title: string): Promise<MultilingualResponse | null> {
  try {
    const apiKey = await getSecret('anthropic', 'api_key');
    if (!apiKey) return null;
    
    const prompt = `Convert to multilingual display format:
Artist: ${artist}
Title: ${title}

Format: Keep original + add (ENGLISH UPPERCASE) in parentheses
Examples:
- 크러쉬 → 크러쉬 (CRUSH)
- 星野源 → 星野源 (HOSHINOGEN)
- 周杰倫 → 周杰倫 (JAY CHOU)

Return only JSON with: artistDisplay, titleDisplay, artistOriginal, titleOriginal, language`;
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 300,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    
    if (!response.ok) {
      logger.error('Claude API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    const content = data.content?.[0]?.text;
    
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed as MultilingualResponse;
    }
  } catch (error) {
    logger.error('Claude multilingual error:', error);
  }
  return null;
}

// Gemini API call
async function callGemini(artist: string, title: string): Promise<MultilingualResponse | null> {
  try {
    const apiKey = await getSecret('google', 'api_key');
    if (!apiKey) return null;
    
    const prompt = `Task: Convert artist and title to multilingual display format.

Input:
Artist: ${artist}
Title: ${title}

Instructions:
1. Detect the language
2. If non-English, find the correct romanization
3. Format as: Original (ROMANIZED IN UPPERCASE)
4. For English, keep as-is

Examples:
- Korean 크러쉬 becomes: 크러쉬 (CRUSH)
- Japanese 星野源 becomes: 星野源 (HOSHINOGEN)
- Chinese 周杰倫 becomes: 周杰倫 (JAY CHOU)

Output JSON only:
{
  "artistDisplay": "formatted artist",
  "titleDisplay": "formatted title",
  "artistOriginal": "original artist",
  "titleOriginal": "original title",
  "language": "language code"
}`;
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 300,
          },
        }),
      }
    );
    
    if (!response.ok) {
      logger.error('Gemini API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed as MultilingualResponse;
    }
  } catch (error) {
    logger.error('Gemini multilingual error:', error);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { artist, title } = await req.json();
    
    if (!artist || !title) {
      return NextResponse.json(
        { error: 'Artist and title are required' },
        { status: 400 }
      );
    }
    
    logger.info(`🌐 Multilingual display for: ${artist} - ${title}`);
    
    const result = await getMultilingualDisplay(artist, title);
    
    logger.success(`✅ Multilingual result: ${result.artistDisplay} - ${result.titleDisplay}`);
    
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Multilingual API error:', error);
    return NextResponse.json(
      { error: 'Failed to process multilingual display' },
      { status: 500 }
    );
  }
}