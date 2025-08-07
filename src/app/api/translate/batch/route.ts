import { NextRequest, NextResponse } from 'next/server';

// Use Groq API for better quality and cost-effectiveness
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // Latest model with best quality/price ratio

export async function POST(request: NextRequest) {
  try {
    const { lines, targetLanguage, context } = await request.json();
    
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lines array is required' },
        { status: 400 }
      );
    }
    
    if (!targetLanguage) {
      return NextResponse.json(
        { success: false, error: 'Target language is required' },
        { status: 400 }
      );
    }
    
    // 언어 코드 매핑 (20개 언어)
    const languageMap: { [key: string]: string } = {
      'en': 'English',
      'ko': 'Korean',
      'ja': 'Japanese',
      'zh': 'Chinese',
      'es': 'Spanish',
      'id': 'Indonesian',
      'th': 'Thai',
      'pt': 'Portuguese',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'vi': 'Vietnamese',
      'fr': 'French',
      'de': 'German',
      'ru': 'Russian',
      'it': 'Italian',
      'tr': 'Turkish',
      'pl': 'Polish',
      'nl': 'Dutch',
      'ms': 'Malay',
      'tl': 'Tagalog/Filipino'
    };
    
    const targetLang = languageMap[targetLanguage] || 'English';
    
    // Use Groq API for batch translation
    try {
      // Call the Groq API endpoint directly
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a professional lyrics translator. Translate each line accurately while preserving the poetic and emotional qualities. Return only the translations, numbered in the same format as the input.'
            },
            {
              role: 'user',
              content: `${context ? `Context: This is from the song "${context.title}" by "${context.artist}".` : ''}

Translate the following lyrics to ${targetLang}. 
Keep the emotional tone and poetic feel of the original lyrics.
Translate line by line, maintaining the structure.
Return ONLY the translations, one per line, in the same order as the input.

Original lyrics:
${lines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Groq API error:', error);
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const translationText = data.choices[0]?.message?.content?.trim() || '';

      // Parse the numbered translations
      const translations = translationText
        .split('\n')
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(line => line.length > 0);

      // Ensure we have the same number of translations as input lines
      while (translations.length < lines.length) {
        translations.push('...');
      }

      return NextResponse.json({
        success: true,
        translations: translations.slice(0, lines.length),
        sourceLanguage: 'auto',
        targetLanguage,
        source: 'Groq (Llama 3.3 70B)',
        model: GROQ_MODEL
      });

    } catch (error) {
      console.error('Groq API error:', error);
      // Fallback: return original lines if translation fails
      return NextResponse.json({
        success: true,
        translations: lines,
        sourceLanguage: 'auto',
        targetLanguage,
        error: 'Translation failed, returning original text'
      });
    }
    
  } catch (error) {
    console.error('[Batch Translation] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Translation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}