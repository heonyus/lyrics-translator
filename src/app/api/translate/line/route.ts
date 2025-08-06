import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { text, targetLang = 'ko', sourceLang = 'auto', userApiKeys } = await request.json();
    
    if (!text) {
      return NextResponse.json({ success: false, error: 'Text is required' }, { status: 400 });
    }
    
    // 먼저 OpenAI GPT-4o-mini 시도 (더 자연스러운 번역)
    if (OPENAI_API_KEY) {
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
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are an expert translator specializing in song lyrics and poetry. 

Your task is to translate lyrics to ${targetLangName} while:
1. Preserving the emotional tone and mood
2. Maintaining poetic rhythm when possible
3. Keeping cultural nuances and metaphors
4. Using natural, singable expressions in the target language

For K-pop or J-pop songs, preserve any intentional language mixing.
Return ONLY the translation, no explanations or notes.`
              },
              {
                role: 'user',
                content: `Translate this song lyric line to ${targetLangName}:\n\n${text}`
              }
            ],
            temperature: 0.4,
            max_tokens: 500
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            success: true,
            translation: data.choices[0].message.content.trim(),
            source: 'GPT-4o-mini'
          });
        } else {
          const errorData = await response.text();
          console.error('OpenAI API Error:', response.status, errorData);
        }
      } catch (error) {
        console.error('OpenAI translate error:', error);
      }
    }
    
    // GPT-4o-mini가 실패하면 Google Translate 시도
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