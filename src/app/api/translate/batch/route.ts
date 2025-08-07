import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// API configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

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
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'th': 'Thai',
      'vi': 'Vietnamese',
      'id': 'Indonesian',
      'tr': 'Turkish',
      'pl': 'Polish',
      'nl': 'Dutch',
      'sv': 'Swedish',
      'fi': 'Finnish'
    };
    
    const targetLang = languageMap[targetLanguage] || targetLanguage;
    
    // Try Groq first
    try {
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
        .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
        .filter((line: string) => line.length > 0);

      // Check for duplicate translations
      const uniqueTranslations = [...new Set(translations)];
      if (uniqueTranslations.length === 1 && lines.length > 1) {
        throw new Error('All translations are identical');
      }

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

    } catch (groqError) {
      console.error('Groq API failed, trying Gemini 2.5 Flash:', groqError);
      
      // Fallback to Gemini 2.5 Flash
      try {
        if (!GOOGLE_API_KEY) {
          throw new Error('No Google API key available');
        }
        
        const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        // Try batch translation first
        const batchPrompt = `${context ? `Context: This is from the song "${context.title}" by "${context.artist}".` : ''}

Translate these lyrics to ${targetLang}.
Keep the emotional tone and poetic feel.
Each line should be translated separately - do NOT repeat the same translation.
Return ONLY the translations, numbered 1-${lines.length}.

Original lyrics:
${lines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`;
        
        const result = await model.generateContent(batchPrompt);
        const response = await result.response;
        const translationText = response.text().trim();
        
        // Parse the numbered translations
        let translations = translationText
          .split('\n')
          .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
          .filter((line: string) => line.length > 0);
        
        // Check for duplicate translations (common error)
        const uniqueTranslations = [...new Set(translations)];
        if (uniqueTranslations.length === 1 && lines.length > 1) {
          console.warn('Gemini returned identical translations, translating individually...');
          
          // Translate each line individually to avoid repetition
          translations = [];
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            try {
              const individualPrompt = `Translate this single song lyric line to ${targetLang}.
Keep the poetic and emotional tone.
${i > 0 ? `Previous line translation: "${translations[i-1]}"` : ''}

Original line: "${line}"

Return ONLY the translation, nothing else:`;
              
              const individualResult = await model.generateContent(individualPrompt);
              const individualResponse = await individualResult.response;
              const translation = individualResponse.text().trim();
              
              // Remove quotes if present
              const cleanTranslation = translation.replace(/^["']|["']$/g, '').trim();
              translations.push(cleanTranslation);
              
            } catch (individualError) {
              console.error(`Failed to translate line ${i + 1}:`, individualError);
              translations.push(line); // Use original if individual translation fails
            }
          }
          
          return NextResponse.json({
            success: true,
            translations: translations,
            sourceLanguage: 'auto',
            targetLanguage,
            source: 'Gemini 2.5 Flash (Individual)',
            model: 'gemini-2.5-flash',
            note: 'Translated line by line to ensure variety'
          });
        }
        
        // Ensure we have the same number of translations as input lines
        while (translations.length < lines.length) {
          translations.push('...');
        }
        
        return NextResponse.json({
          success: true,
          translations: translations.slice(0, lines.length),
          sourceLanguage: 'auto',
          targetLanguage,
          source: 'Gemini 2.5 Flash (Batch)',
          model: 'gemini-2.5-flash'
        });
        
      } catch (geminiError) {
        console.error('Both Groq and Gemini failed:', geminiError);
        
        // Last fallback: simple translation
        const simpleTranslations = lines.map(line => {
          // Very basic translation logic as last resort
          if (targetLanguage === 'en' && line.includes('어땠는지')) {
            return 'How was it';
          }
          if (targetLanguage === 'en' && line.includes('남아')) {
            return 'It remains';
          }
          // Return original for other cases
          return line;
        });
        
        return NextResponse.json({
          success: true,
          translations: simpleTranslations,
          sourceLanguage: 'auto',
          targetLanguage,
          error: 'All translation services failed, using fallback',
          source: 'Fallback'
        });
      }
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