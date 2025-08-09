import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger, APITimer } from '@/lib/logger';

let GROQ_API_KEY: string | undefined;
let OPENAI_API_KEY: string | undefined;
let GOOGLE_API_KEY: string | undefined;

async function loadKeys() {
  if (typeof window !== 'undefined') return;
  const { getSecret } = await import('@/lib/secure-secrets');
  GROQ_API_KEY = (await getSecret('groq')) || process.env.GROQ_API_KEY;
  OPENAI_API_KEY = (await getSecret('openai')) || process.env.OPENAI_API_KEY;
  GOOGLE_API_KEY = (await getSecret('google')) || process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
}

// Verify with Gemini 2.5 Pro (최신, 가장 정확)
async function verifyWithGemini25Pro(artist: string, title: string, lyrics: string) {
  const timer = new APITimer('Gemini 2.5 Pro Verify');
  
  try {
    if (!GOOGLE_API_KEY) {
      timer.skip('No API key');
      return null;
    }
    
    const prompt = `Based on your training data, verify these lyrics.
Song: "${title}" by "${artist}"

Provided lyrics (first 500 chars):
"""
${lyrics.substring(0, 500)}
"""

Tasks:
1. Do you know this song from your training?
2. If yes, do these lyrics match what you know?
3. Are they complete or partial?
4. Any obvious errors or AI-generated explanation text?

Return JSON only:
{
  "knownSong": true/false,
  "lyricsMatch": true/false,
  "isComplete": true/false,
  "confidence": 0-100,
  "isAIText": true/false,
  "expectedOpening": "first line you know if any"
}`;

    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp" // Using available model
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Try to parse JSON from response
    try {
      const parsed = JSON.parse(text);
      timer.success(`Verified with confidence ${parsed.confidence}`);
      return parsed;
    } catch {
      // Fallback if not valid JSON
      timer.fail('Invalid JSON response');
      return {
        knownSong: false,
        lyricsMatch: false,
        isComplete: false,
        confidence: 0,
        isAIText: text.includes('cannot') || text.includes('search'),
        expectedOpening: null
      };
    }
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Verify with GPT-5 (백업)
async function verifyWithGPT5(artist: string, title: string, lyrics: string) {
  const timer = new APITimer('GPT-5 Verify');
  
  try {
    if (!OPENAI_API_KEY) {
      timer.skip('No API key');
      return null;
    }
    
    const prompt = `Verify if these are the correct lyrics for "${title}" by "${artist}".

Lyrics sample (first 400 chars):
"""
${lyrics.substring(0, 400)}
"""

Based on your training data:
1. Is this a real song you know?
2. Do these lyrics match your knowledge?
3. Is this AI explanation text or real lyrics?

Return JSON only:
{
  "knownSong": true/false,
  "lyricsMatch": true/false,
  "confidence": 0-100,
  "isAIText": true/false
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo', // Fallback to available model
        messages: [
          { role: 'system', content: 'You are a music expert with knowledge of song lyrics.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const result = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    
    timer.success(`Verified with confidence ${result.confidence}`);
    return result;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Verify with Groq GPT-OSS (무료, 빠름)
async function verifyWithGroqGPTOSS(artist: string, title: string, lyrics: string) {
  const timer = new APITimer('Groq GPT-OSS Verify');
  
  try {
    if (!GROQ_API_KEY) {
      timer.skip('No API key');
      return null;
    }
    
    const prompt = `You are a music database with knowledge up to your training cutoff.
Verify if these are the correct lyrics for "${title}" by "${artist}".

Lyrics sample (first 400 chars):
"""
${lyrics.substring(0, 400)}
"""

Check against your knowledge:
1. Is this a real song you know?
2. Do the lyrics match your memory?
3. Detect if this is AI explanation text vs real song lyrics

Song lyrics have:
- Emotional/poetic language
- Verses and choruses
- Line breaks
- Repetition

AI text has:
- "I cannot", "I don't have", "search for"
- Instructions or recommendations
- Explanatory language

Return JSON:
{
  "knownSong": true/false,
  "lyricsMatch": true/false,
  "isAIText": true/false,
  "confidence": 0-100
}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Using standard Groq model
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const result = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    
    timer.success(`Verified with confidence ${result.confidence}`);
    return result;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Main verification chain
async function verifyLyricsChain(artist: string, title: string, lyrics: string) {
  console.log(`🔍 [Verify] Starting verification for: ${artist} - ${title}`);
  console.log(`📝 [Verify] Lyrics sample: "${lyrics.substring(0, 100)}..."`);
  
  // Try each verifier in order
  const verifiers = [
    { name: 'Gemini 2.5 Pro', fn: verifyWithGemini25Pro },
    { name: 'GPT-5', fn: verifyWithGPT5 },
    { name: 'Groq GPT-OSS', fn: verifyWithGroqGPTOSS }
  ];
  
  for (const verifier of verifiers) {
    console.log(`🔄 [Verify] Trying ${verifier.name}...`);
    const result = await verifier.fn(artist, title, lyrics);
    
    if (result && result.confidence > 50) {
      console.log(`✅ [Verify] ${verifier.name} succeeded: confidence=${result.confidence}, isAIText=${result.isAIText}`);
      return {
        ...result,
        verifier: verifier.name,
        isCorrect: result.lyricsMatch && !result.isAIText
      };
    }
  }
  
  console.log(`❌ [Verify] All verifiers failed or low confidence`);
  
  // Default response if all fail
  return {
    knownSong: false,
    lyricsMatch: false,
    isComplete: false,
    confidence: 0,
    isAIText: false,
    isCorrect: false,
    verifier: 'none'
  };
}

export async function POST(request: NextRequest) {
  const timer = new APITimer('Lyrics Verification');
  
  try {
    await loadKeys();
    
    const { artist, title, lyrics } = await request.json();
    
    if (!artist || !title || !lyrics) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const verification = await verifyLyricsChain(artist, title, lyrics);
    
    timer.success('Verification complete');
    
    return NextResponse.json({
      success: true,
      verification
    });
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Lyrics verification error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Verification failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}