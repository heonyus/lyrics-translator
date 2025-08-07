import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// 언어 코드 매핑
const languageNames: { [key: string]: string } = {
  ko: 'Korean',
  en: 'English',
  ja: 'Japanese',
  zh: 'Chinese (Simplified)',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ru: 'Russian',
  pt: 'Portuguese',
  it: 'Italian'
};

export async function POST(request: NextRequest) {
  try {
    const { text, targetLang = 'ko', sourceLang = 'auto', context = {} } = await request.json();
    
    if (!text) {
      return NextResponse.json({ success: false, error: 'Text is required' }, { status: 400 });
    }

    const targetLanguage = languageNames[targetLang] || targetLang;
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // 가사 번역에 최적화된 프롬프트
    const prompt = `
You are a professional song lyrics translator specializing in preserving meaning, emotion, and poetic quality.

TASK: Translate this song lyric to ${targetLanguage}.

CONTEXT:
${context.songTitle ? `Song Title: ${context.songTitle}` : ''}
${context.artist ? `Artist: ${context.artist}` : ''}
${context.previousLine ? `Previous line: ${context.previousLine}` : ''}
${context.nextLine ? `Next line: ${context.nextLine}` : ''}

LYRIC TO TRANSLATE:
"${text}"

TRANSLATION GUIDELINES:
1. Preserve the emotional tone and mood
2. Keep poetic/metaphorical expressions natural in ${targetLanguage}
3. For K-pop/J-pop: Keep romanized names and some English phrases if artistically intended
4. Maintain singability - use natural rhythm in ${targetLanguage}
5. Don't over-translate cultural references that work better in original

OUTPUT: Return ONLY the translated text, no explanations or alternatives.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const translation = response.text().trim();

    return NextResponse.json({
      success: true,
      translation,
      source: 'Gemini AI',
      quality: 'high'
    });

  } catch (error) {
    console.error('Gemini translation error:', error);
    
    // Fallback to basic translation if Gemini fails
    return NextResponse.json({
      success: false,
      translation: text,
      source: 'original',
      error: 'Translation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// 배치 번역 엔드포인트
export async function PUT(request: NextRequest) {
  try {
    const { text, languages = ['en', 'ko', 'ja'], context = {} } = await request.json();
    
    if (!text) {
      return NextResponse.json({ success: false, error: 'Text is required' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // 다중 언어 동시 번역 프롬프트
    const prompt = `
Translate this song lyric into multiple languages simultaneously.

ORIGINAL LYRIC:
"${text}"

TRANSLATE TO:
${languages.map(lang => `- ${languageNames[lang] || lang}`).join('\n')}

CONTEXT:
${context.songTitle ? `Song: ${context.songTitle}` : ''}
${context.artist ? `Artist: ${context.artist}` : ''}

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
[LANGUAGE_CODE]: translation
Example:
en: English translation here
ko: 한국어 번역 여기에
ja: 日本語の翻訳はここに

IMPORTANT:
- Preserve emotional tone in each language
- Keep the translations natural and singable
- Return ONLY the translations in the format above`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const translationsText = response.text().trim();

    // Parse the response
    const translations: { [key: string]: string } = {};
    const lines = translationsText.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^([a-z]{2}):\s*(.+)$/i);
      if (match) {
        translations[match[1].toLowerCase()] = match[2].trim();
      }
    }

    // Ensure all requested languages have translations
    for (const lang of languages) {
      if (!translations[lang]) {
        translations[lang] = text; // Fallback to original
      }
    }

    return NextResponse.json({
      success: true,
      translations,
      source: 'Gemini AI Batch',
      quality: 'high'
    });

  } catch (error) {
    console.error('Gemini batch translation error:', error);
    
    // Return original text for all languages as fallback
    const { languages = ['en', 'ko', 'ja'] } = await request.json();
    const fallbackTranslations: { [key: string]: string } = {};
    languages.forEach((lang: string) => {
      fallbackTranslations[lang] = request.json.text || '';
    });

    return NextResponse.json({
      success: false,
      translations: fallbackTranslations,
      source: 'fallback',
      error: 'Batch translation failed'
    });
  }
}