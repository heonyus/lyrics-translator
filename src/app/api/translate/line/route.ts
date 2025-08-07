import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { text, targetLang = 'ko', sourceLang = 'auto', context = {} } = await request.json();
    
    if (!text) {
      return NextResponse.json({ success: false, error: 'Text is required' }, { status: 400 });
    }
    
    // 먼저 Gemini API 시도 (가사에 최적화된 번역)
    if (GOOGLE_API_KEY) {
      try {
        const langNames = {
          ko: 'Korean',
          en: 'English',
          ja: 'Japanese',
          zh: 'Chinese (Simplified)',
          es: 'Spanish',
          fr: 'French'
        };
        
        const targetLangName = langNames[targetLang as keyof typeof langNames] || targetLang;
        const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const prompt = `
Translate this song lyric to ${targetLangName}.

Original lyric: "${text}"

${context?.previousLine ? `Previous line: "${context.previousLine}"` : ''}
${context?.nextLine ? `Next line: "${context.nextLine}"` : ''}

Translation requirements:
- Preserve emotional tone and mood
- Keep it natural and singable in ${targetLangName}
- For K-pop/J-pop: preserve romanized names and artistic English phrases
- Don't over-translate cultural references

Return ONLY the translated text:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const translation = response.text().trim();
        
        if (translation) {
          return NextResponse.json({
            success: true,
            translation,
            source: 'Gemini Pro'
          });
        }
      } catch (error) {
        console.error('Gemini translate error:', error);
      }
    }
    
    // Gemini가 실패하면 Google Translate Basic API 시도 (백업)
    if (GOOGLE_API_KEY) {
      try {
        const response = await fetch(
          `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              q: text,
              target: targetLang,
              source: sourceLang === 'auto' ? undefined : sourceLang,
              format: 'text'
            })
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            success: true,
            translation: data.data.translations[0].translatedText,
            source: 'Google Translate (Backup)'
          });
        }
      } catch (error) {
        console.error('Google Translate error:', error);
      }
    }
    
    // 모든 방법이 실패하면 기본 메시지
    return NextResponse.json({
      success: false,
      translation: targetLang === 'ko' ? '(번역 불가)' : '(Translation unavailable)',
      source: 'none'
    });
    
  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { success: false, error: 'Translation failed' },
      { status: 500 }
    );
  }
}