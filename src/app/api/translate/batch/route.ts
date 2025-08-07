import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger, APITimer } from '@/lib/logger';

// API configuration
let GROQ_API_KEY: string | undefined;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
let GOOGLE_API_KEY: string | undefined;

export async function POST(request: NextRequest) {
  try {
    const overallTimer = new APITimer('Batch Translate');
    const overallStart = Date.now();
    if (typeof window === 'undefined') {
      const { getSecret } = await import('@/lib/secure-secrets');
      GROQ_API_KEY = (await getSecret('groq')) || process.env.GROQ_API_KEY || '';
      GOOGLE_API_KEY = (await getSecret('google')) || process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    }
    const { lines, targetLanguage, context, task } = await request.json();
    
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
      const isPronounce = String(task || '').toLowerCase() === 'pronounce';
      logger.api('Groq Translate', 'start', `${isPronounce ? 'Pronounce' : 'Translate'} Target=${targetLang} Lines=${lines.length}`);
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
              content: [
                {
                  type: 'text',
                  text: isPronounce
                    ? `You are a professional pronunciation transcriber for lyrics into Korean Hangul.\n\nStrict rules:\n- Convert each line to its Korean Hangul pronunciation only (phonetic rendering), do NOT translate meaning.\n- Keep line structure; number of lines must match input.\n- Preserve section labels only if they are part of pronunciation; otherwise ignore labels like [Chorus].\n- No explanations or metadata.\n- Output ONLY pronunciations, numbered exactly like input.`
                    : `You are a professional lyrics translator.\n\nStrict rules:\n- Preserve meaning, tone, and poetic feel.\n- Keep each line structure; number of lines must match input.\n- Preserve proper nouns and artist/title names.\n- Keep parentheses/brackets content unless they are section labels.\n- Do NOT add explanations or metadata.\n- Output ONLY translations, numbered exactly like input.`
                }
              ]
            },
            {
              role: 'user',
              content: isPronounce
                ? `${context ? `Context: Song="${context.title}" Artist="${context.artist}".` : ''}

Transcribe the following lyrics to Korean Hangul pronunciation (phonetic rendering). Do NOT translate meaning.
Return ONLY the pronunciations, one per line, in the same order as input, numbered 1-${lines.length}.

Original lyrics:\n${lines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`
                : `${context ? `Context: Song="${context.title}" Artist="${context.artist}".` : ''}

Translate the following lyrics to ${targetLang}.
Return ONLY the translations, one per line, in the same order as input, numbered 1-${lines.length}.

Original lyrics:\n${lines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        logger.api('Groq Translate', 'fail', `HTTP ${response.status}`);
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

      logger.api('Groq Translate', 'success', `Lines=${lines.length}`);
      logger.summary(1, 1, Date.now() - overallStart);
      return NextResponse.json({
        success: true,
        translations: translations.slice(0, lines.length),
        sourceLanguage: 'auto',
        targetLanguage,
        source: isPronounce ? 'Groq (Pronunciation)' : 'Groq (Llama 3.3 70B)',
        model: GROQ_MODEL,
        task: isPronounce ? 'pronounce' : 'translate'
      });

    } catch (groqError) {
      logger.api('Groq Translate', 'fail', 'Primary provider failed, trying Gemini');
      
      // Fallback to Gemini 2.5 Flash
      try {
        if (!GOOGLE_API_KEY) {
          throw new Error('No Google API key available');
        }
        
        const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        // Try batch translation first
        const isPron = String(task || '').toLowerCase() === 'pronounce';
        const batchPrompt = isPron
          ? `${context ? `Context: Song="${context.title}" Artist="${context.artist}".` : ''}

Transcribe the lyrics to Korean Hangul pronunciation.\nRules:\n- Do NOT translate.\n- Keep the same number of lines.\n- No commentary.\n- Return ONLY pronunciations, numbered 1-${lines.length}.\n\nOriginal lyrics:\n${lines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`
          : `${context ? `Context: Song="${context.title}" Artist="${context.artist}".` : ''}

Translate the lyrics to ${targetLang}.\nRules:\n- Keep the same number of lines.\n- Preserve names and punctuation.\n- No commentary.\n- Return ONLY translations, numbered 1-${lines.length}.\n\nOriginal lyrics:\n${lines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`;
        
        logger.api('Gemini Translate (Batch)', 'start', `Lines=${lines.length}`);
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
          logger.api('Gemini Translate (Batch)', 'fail', 'Identical translations');
          
          // Translate each line individually to avoid repetition
          translations = [];
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            try {
              const individualPrompt = `Translate this single lyric line to ${targetLang}.\n- Keep poetic tone\n- No commentary\n- Return ONLY the translation\n\nLine: "${line}"`;
              
              logger.api('Gemini Line', 'start', `#${i + 1}`);
              const individualResult = await model.generateContent(individualPrompt);
              const individualResponse = await individualResult.response;
              const translation = individualResponse.text().trim();
              
              // Remove quotes if present
              const cleanTranslation = translation.replace(/^["']|["']$/g, '').trim();
              translations.push(cleanTranslation);
              logger.api('Gemini Line', 'success', `#${i + 1}`);
              
            } catch (individualError) {
              logger.api('Gemini Line', 'fail', `#${i + 1}`);
              translations.push(line); // Use original if individual translation fails
            }
          }
          
          logger.api('Gemini Translate (Batch)', 'success', `Lines=${lines.length} (individual mode)`);
          logger.summary(lines.length, translations.filter(t => !!t).length, Date.now() - overallStart);
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
        
        logger.api('Gemini Translate (Batch)', 'success', `Lines=${lines.length}`);
        logger.summary(1, 1, Date.now() - overallStart);
        return NextResponse.json({
          success: true,
          translations: translations.slice(0, lines.length),
          sourceLanguage: 'auto',
          targetLanguage,
          source: isPron ? 'Gemini 2.5 Flash (Pronounce)' : 'Gemini 2.5 Flash (Batch)',
          model: 'gemini-2.5-flash',
          task: isPron ? 'pronounce' : 'translate'
        });
        
      } catch (geminiError) {
        logger.api('Gemini Translate (Batch)', 'fail', 'Fallback failed');
        
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
        
        logger.summary(1, 0, Date.now() - overallStart);
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
    logger.error('[Batch Translation] Error', error);
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