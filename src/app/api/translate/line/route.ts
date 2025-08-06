import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { text, targetLang = 'ko', sourceLang = 'auto', userApiKeys } = await request.json();
    
    if (!text) {
      return NextResponse.json({ success: false, error: 'Text is required' }, { status: 400 });
    }
    
    // 먼저 Google Translate 시도
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
              source: sourceLang === 'auto' ? undefined : sourceLang
            })
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            success: true,
            translation: data.data.translations[0].translatedText,
            source: 'Google Translate'
          });
        }
      } catch (error) {
        console.error('Google Translate error:', error);
      }
    }
    
    // Google이 실패하면 OpenAI 시도
    if (OPENAI_API_KEY) {
      try {
        const langNames = {
          ko: 'Korean',
          en: 'English',
          ja: 'Japanese',
          zh: 'Chinese',
          es: 'Spanish',
          fr: 'French'
        };
        
        const targetLangName = langNames[targetLang as keyof typeof langNames] || targetLang;
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `You are a professional translator specializing in song lyrics. Translate the given lyrics to ${targetLangName}. Maintain the emotional tone and poetic nature of the lyrics. Return ONLY the translation, no explanations.`
              },
              {
                role: 'user',
                content: text
              }
            ],
            temperature: 0.3,
            max_tokens: 500
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            success: true,
            translation: data.choices[0].message.content.trim(),
            source: 'OpenAI GPT-3.5'
          });
        }
      } catch (error) {
        console.error('OpenAI translate error:', error);
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