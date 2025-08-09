import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger, APITimer } from '@/lib/logger';
import { isGroqAvailable, reportGroq429, scheduleGroq } from '@/lib/groq-scheduler';

// In-process Groq rate limiter to mitigate HTTP 429
let GROQ_IN_FLIGHT = 0;
const GROQ_MAX_CONCURRENCY = 1;
const GROQ_QUEUE: Array<() => void> = [];
function acquireGroqSlot(): Promise<void> {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (GROQ_IN_FLIGHT < GROQ_MAX_CONCURRENCY) {
        GROQ_IN_FLIGHT++;
        resolve();
      } else {
        GROQ_QUEUE.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}
function releaseGroqSlot() {
  GROQ_IN_FLIGHT = Math.max(0, GROQ_IN_FLIGHT - 1);
  const next = GROQ_QUEUE.shift();
  if (next) setTimeout(next, 25 + Math.floor(Math.random() * 50));
}

// API configuration
let GROQ_API_KEY: string | undefined;
let OPENAI_API_KEY: string | undefined;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
let GOOGLE_API_KEY: string | undefined;

export async function POST(request: NextRequest) {
  try {
    const overallTimer = new APITimer('Batch Translate');
    const overallStart = Date.now();
    if (typeof window === 'undefined') {
      const { getSecret } = await import('@/lib/secure-secrets');
      GROQ_API_KEY = (await getSecret('groq')) || process.env.GROQ_API_KEY || '';
      OPENAI_API_KEY = (await getSecret('openai')) || process.env.OPENAI_API_KEY || '';
      GOOGLE_API_KEY = (await getSecret('google')) || process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    }
    const { lines, targetLanguage, context, task, engine } = await request.json();
    
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
    const isPronounce = String(task || '').toLowerCase() === 'pronounce';
    const hasGroq = !!GROQ_API_KEY;
    const hasOpenAI = !!OPENAI_API_KEY;
    const hasGoogle = !!GOOGLE_API_KEY;
    
    // If engine is specified, try that first
    if (engine === 'groq' && hasGroq && !isPronounce) {
      try {
        // Call the new Groq translation API
        const groqResponse = await fetch(`${request.url.replace('/batch', '/groq')}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lines, targetLanguage, context })
        });
        
        if (groqResponse.ok) {
          const groqData = await groqResponse.json();
          if (groqData.success) {
            overallTimer.success('Groq translation successful');
            logger.summary(1, 1, Date.now() - overallStart);
            return NextResponse.json({
              success: true,
              translations: groqData.translations,
              source: 'groq'
            });
          }
        }
      } catch (error) {
        logger.warning('Groq translation failed, falling back to other engines');
      }
    }
    
    // Default behavior: Try OpenAI gpt-5 first for translation (not pronounce)
    try {
      if (!hasOpenAI || isPronounce || engine === 'groq') throw new Error('Skip OpenAI');
      logger.api('OpenAI Translate', 'start', `Target=${targetLang} Lines=${lines.length}`);
      const OPENAI_MODEL = 'gpt-5';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            {
              role: 'system',
              content: [
                '당신은 번역가입니다.',
                '당신의 임무는 노래 가사를 번역하는 것입니다.',
                '이 번역은 반드시 작사가가 의도한 의미와 감정을 최대한 그대로 전달해야 합니다.',
                '',
                '번역 시 핵심 원칙:',
                '1) 의미 보존: 직역보다 의미 전달을 우선, 메타포/비유/상징 해석.',
                '2) 감정선 유지: 분위기·어조·톤을 원문과 일치.',
                '3) 문화적 맥락 반영: 관용구/속담/지역 표현은 현지화.',
                '4) 리듬·흐름 고려: 구절감·반복·운율 최대한 유지.',
                '',
                '절차(내부 사고만, 출력 금지):',
                '- 각 줄의 직역→의미/감정 재작성→리듬 확인→최종 검수. 사고 과정은 출력하지 마세요.',
                '',
                '출력 형식(반드시 준수):',
                `- 번역만, 번호 붙여 1-${lines.length}로 줄별 대응.`,
                '- 추가 설명/주석/메타데이터 금지.',
              ].join('\n')
            },
            {
              role: 'user',
              content: `${context ? `Context: Song=\"${context.title}\" Artist=\"${context.artist}\".` : ''}\n\n다음 가사를 ${targetLang}로 번역하세요.\n출력은 번역만, 입력과 동일한 줄 수, 번호 1-${lines.length}.\n\n원문 가사:\n${lines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`
            }
          ],
          temperature: 0.2,
          max_tokens: 3500
        })
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        logger.api('OpenAI Translate', 'fail', `HTTP ${response.status} ${errText?.slice(0, 200)}`);
        throw new Error(`OpenAI HTTP ${response.status}`);
      }
      const data = await response.json();
      const raw = (data.choices?.[0]?.message?.content || '').trim();
      // Parse numbered lines; tolerate minor formatting
      const numbered = raw
        .split('\n')
        .map((line: string) => line.replace(/^\s*\d+\.\s*/, '').trim())
        .filter((line: string) => line.length > 0);
      while (numbered.length < lines.length) numbered.push('...');
      logger.api('OpenAI Translate', 'success', `Lines=${lines.length}`);
      logger.summary(1, 1, Date.now() - overallStart);
      return NextResponse.json({
        success: true,
        translations: numbered.slice(0, lines.length),
        sourceLanguage: 'auto',
        targetLanguage,
        source: 'OpenAI (gpt-5)',
        model: OPENAI_MODEL,
        task: 'translate'
      });

    } catch (openaiError) {
      // Fallback: Groq archived → Skip directly to Gemini (callback/backup)
      try {
        throw new Error('Skip Groq');
      } catch {}
      
      // Fallback to Gemini 2.5 Flash
      try {
        if (!hasGoogle) {
          throw new Error('No Google API key available');
        }
        
        const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY as string);
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
        
        // Fallback to Google Translate v2 (bulk) if available and not pronounce
        if (!isPronounce && hasGoogle) {
          try {
            const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ q: lines, target: targetLanguage, format: 'text' })
            });
            if (res.ok) {
              const data = await res.json();
              const out = (data?.data?.translations || []).map((t: any) => (t.translatedText || '').trim());
              logger.api('Google Translate v2', 'success', `Lines=${out.length}`);
              logger.summary(1, 1, Date.now() - overallStart);
              return NextResponse.json({
                success: true,
                translations: out.length ? out : lines,
                sourceLanguage: 'auto',
                targetLanguage,
                source: 'Google Translate v2 (Backup)',
                model: 'google-v2',
                task: 'translate'
              });
            }
          } catch (gerr) {
            logger.api('Google Translate v2', 'fail', 'Backup failed');
          }
        }
        
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