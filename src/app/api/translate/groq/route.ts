import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// Groq models - 2024년 12월 최신 업데이트
// llama-3.3-70b-versatile: 최고 품질, Meta와 파트너십으로 출시된 최신 모델
// llama-3.1-8b-instant: 빠른 응답, 가벼운 작업용
// mixtral-8x7b-32768: 32K 컨텍스트, 긴 텍스트 처리 가능
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // 2024년 12월 6일 출시, 최고 품질 & 가성비

export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguage = 'ko', context } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Language mapping
    const languageNames: { [key: string]: string } = {
      ko: 'Korean',
      en: 'English',
      ja: 'Japanese',
      zh: 'Chinese',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ru: 'Russian',
      pt: 'Portuguese',
      it: 'Italian'
    };

    const targetLang = languageNames[targetLanguage] || 'Korean';

    // Create translation prompt
    const prompt = `You are a professional translator specializing in song lyrics translation.
${context ? `Context: This is from the song "${context.title}" by "${context.artist}".` : ''}

Translate the following lyrics to ${targetLang}. 
Keep the emotional tone and poetic feel of the original lyrics.
If there are repeated words or sounds (like "oh", "yeah", etc.), keep them as is.
Only return the translation, nothing else.

Original text:
${text}`;

    // Call Groq API
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
            content: 'You are a professional lyrics translator. Translate accurately while preserving the poetic and emotional qualities.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Groq API error:', error);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const translation = data.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({
      translation,
      source: 'Groq (Llama 3.3 70B)',
      model: GROQ_MODEL
    });

  } catch (error) {
    console.error('Groq translation error:', error);
    return NextResponse.json(
      { error: 'Translation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Batch translation endpoint
export async function PUT(req: NextRequest) {
  try {
    const { lines, targetLanguage = 'ko', context } = await req.json();

    if (!lines || !Array.isArray(lines)) {
      return NextResponse.json(
        { error: 'Lines array is required' },
        { status: 400 }
      );
    }

    // Language mapping
    const languageNames: { [key: string]: string } = {
      ko: 'Korean',
      en: 'English',
      ja: 'Japanese',
      zh: 'Chinese',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      ru: 'Russian',
      pt: 'Portuguese',
      it: 'Italian'
    };

    const targetLang = languageNames[targetLanguage] || 'Korean';

    // Create batch translation prompt
    const prompt = `You are a professional translator specializing in song lyrics translation.
${context ? `Context: This is from the song "${context.title}" by "${context.artist}".` : ''}

Translate the following lyrics to ${targetLang}. 
Keep the emotional tone and poetic feel of the original lyrics.
Translate line by line, maintaining the structure.
Return ONLY the translations, one per line, in the same order as the input.

Original lyrics:
${lines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`;

    // Call Groq API
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
            content: prompt
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
      translations: translations.slice(0, lines.length),
      source: 'Groq (Llama 3.3 70B)',
      model: GROQ_MODEL
    });

  } catch (error) {
    console.error('Groq batch translation error:', error);
    return NextResponse.json(
      { error: 'Batch translation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}