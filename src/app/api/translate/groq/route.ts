import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';
import { getSecret } from '@/lib/secure-secrets';

export async function POST(request: NextRequest) {
  const timer = new APITimer('Groq Translate');
  
  try {
    const { lines, targetLanguage, context } = await request.json();
    
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      timer.fail('Invalid lines array');
      return NextResponse.json(
        { success: false, error: 'Lines array is required' },
        { status: 400 }
      );
    }
    
    if (!targetLanguage) {
      timer.fail('Missing target language');
      return NextResponse.json(
        { success: false, error: 'Target language is required' },
        { status: 400 }
      );
    }
    
    // Load Groq API key
    const GROQ_API_KEY = (await getSecret('groq')) || process.env.GROQ_API_KEY;
    
    if (!GROQ_API_KEY) {
      timer.fail('Groq API key missing');
      return NextResponse.json(
        { success: false, error: 'Translation service not configured' },
        { status: 500 }
      );
    }
    
    // Language mapping
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
    
    logger.info(`🔄 Translating ${lines.length} lines to ${targetLang} using Groq`);
    
    // Prepare the enhanced prompt with CoT and context analysis
    const systemPrompt = `You are a professional lyrics translator specializing in preserving poetic meaning and emotional resonance.

## CONTEXT ANALYSIS PHASE (전체 가사 분석):
1. Read and understand the ENTIRE lyrics first
2. Identify the song's theme and emotional journey
3. Note metaphors, wordplay, and cultural references
4. Understand the narrative or message being conveyed

## TRANSLATION METHODOLOGY (Chain of Thought):
Step 1: Literal translation (직역) - internal processing only
Step 2: Identify poetic devices and emotional tone (시적 장치와 감정)
Step 3: Cultural adaptation (문화적 적응) - adapt idioms and references
Step 4: Preserve rhythm and flow where possible (리듬과 흐름 유지)
Step 5: Final polished translation with emotional resonance (감정 전달 최종본)

## FEW-SHOT EXAMPLES:

### Example 1 - Metaphor/Emotion (Korean → English):
Original: "너는 내 삶의 봄이야"
Literal: "You are my life's spring"
Context: Love as renewal, growth, new beginning
Final: "You're the spring in my life"

### Example 2 - Cultural Reference (English → Korean):
Original: "You're my ride or die"
Literal: "너는 내 탈것 또는 죽음"
Context: Unwavering loyalty and commitment
Final: "너는 내 평생의 동반자"

### Example 3 - Emotional Intensity (Japanese → English):
Original: "会いたくて 会いたくて 震える"
Literal: "Want to meet, want to meet, trembling"
Context: Desperate longing, physical manifestation of emotion
Final: "I'm trembling with how much I miss you"

### Example 4 - Wordplay (English → Korean):
Original: "I'm falling for you"
Literal: "나는 너를 위해 떨어지고 있어"
Context: Double meaning - falling in love / physically falling
Final: "너에게 빠져들고 있어"

### Example 5 - Poetic Repetition (Korean → English):
Original: "기다려 기다려 널 기다려"
Literal: "Wait wait for you wait"
Context: Emphasis through repetition, yearning
Final: "I wait, I wait, I'll keep waiting for you"

## CRITICAL RULES:
1. Maintain the exact number of lines (${lines.length} lines)
2. Preserve emotional tone and intensity
3. Adapt cultural references naturally
4. Keep verse/chorus structure markers if present
5. Number each line from 1 to ${lines.length}
6. DO NOT add explanations or notes
7. Focus on meaning and emotion over literal translation

## OUTPUT FORMAT:
Return ONLY the numbered translations, one per line:
1. [translated line 1]
2. [translated line 2]
...and so on`;
    
    const userPrompt = `${context ? `Song Context: "${context.title}" by ${context.artist}\n\n` : ''}Translate these lyrics to ${targetLang}.

Remember the Chain of Thought process:
1. First understand the overall meaning and emotion
2. Identify key metaphors and cultural elements
3. Translate preserving poetic essence
4. Ensure emotional resonance matches original

Original lyrics:
${lines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`;
    
    // Call Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent translations
        max_tokens: 4000,
        top_p: 0.9
      })
    });
    
    if (!response.ok) {
      // Handle rate limiting with retry
      if (response.status === 429) {
        logger.warning('Groq rate limit hit, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Retry once
        const retryResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: `Translate song lyrics to ${targetLang}. Preserve meaning and emotion.`
              },
              {
                role: 'user',
                content: `Translate to ${targetLang}:\n${lines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`
              }
            ],
            temperature: 0.3,
            max_tokens: 3000
          })
        });
        
        if (!retryResponse.ok) {
          timer.fail(`Groq retry failed: HTTP ${retryResponse.status}`);
          throw new Error(`Groq API failed after retry: ${retryResponse.status}`);
        }
        
        const retryData = await retryResponse.json();
        const retryContent = retryData.choices?.[0]?.message?.content || '';
        const retryTranslations = parseTranslations(retryContent, lines.length);
        
        timer.success(`Translated ${lines.length} lines (retry)`);
        return NextResponse.json({
          success: true,
          translations: retryTranslations,
          source: 'groq-retry'
        });
      }
      
      timer.fail(`Groq HTTP ${response.status}`);
      const errorText = await response.text().catch(() => '');
      logger.error(`Groq API error: ${errorText.substring(0, 200)}`);
      throw new Error(`Groq API failed: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse the numbered translations
    const translations = parseTranslations(content, lines.length);
    
    timer.success(`Translated ${lines.length} lines successfully`);
    logger.info(`✅ Groq translation completed: ${translations.length} lines`);
    
    return NextResponse.json({
      success: true,
      translations,
      source: 'groq'
    });
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Groq translation error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Translation failed'
    }, { status: 500 });
  }
}

// Helper function to parse numbered translations
function parseTranslations(content: string, expectedCount: number): string[] {
  const lines = content.split('\n');
  const translations: string[] = [];
  
  for (const line of lines) {
    // Remove numbering (1., 2., etc.) and trim
    const cleaned = line.replace(/^\d+\.\s*/, '').trim();
    if (cleaned) {
      translations.push(cleaned);
    }
  }
  
  // Ensure we have the right number of translations
  while (translations.length < expectedCount) {
    translations.push('...');
  }
  
  // Trim to expected count if we have too many
  if (translations.length > expectedCount) {
    translations.length = expectedCount;
  }
  
  return translations;
}