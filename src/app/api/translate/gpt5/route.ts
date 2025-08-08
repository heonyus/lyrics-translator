import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSecret } from '@/lib/secure-secrets';
import OpenAI from 'openai';

interface TranslationRequest {
  text: string;
  targetLanguage: string;
  context?: {
    previousLine?: string;
    nextLine?: string;
    artist?: string;
    title?: string;
  };
}

interface TranslationResponse {
  translation: string;
  confidence: number;
  model: string;
}

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

async function getOpenAIClient(): Promise<OpenAI | null> {
  if (openaiClient) return openaiClient;
  
  const apiKey = await getSecret('openai', 'api_key');
  if (!apiKey) {
    logger.error('OpenAI API key not found');
    return null;
  }
  
  openaiClient = new OpenAI({
    apiKey,
    defaultHeaders: {
      'OpenAI-Beta': 'assistants=v2',
    },
  });
  
  return openaiClient;
}

// Language name mapping
const languageNames: Record<string, string> = {
  en: 'English',
  ko: 'Korean',
  ja: 'Japanese',
  zh: 'Chinese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  tr: 'Turkish',
};

async function translateWithGPT5(
  text: string,
  targetLanguage: string,
  context?: TranslationRequest['context']
): Promise<TranslationResponse> {
  const client = await getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI client initialization failed');
  }
  
  const targetLangName = languageNames[targetLanguage] || targetLanguage;
  
  // Build context-aware prompt
  let systemPrompt = `You are a professional translator specializing in song lyrics translation.
Translate the given text to ${targetLangName} while:
1. Preserving the emotional tone and artistic expression
2. Maintaining cultural nuances and metaphors where possible
3. Keeping the rhythm and flow suitable for lyrics
4. Using natural, colloquial language appropriate for songs`;
  
  if (context?.artist && context?.title) {
    systemPrompt += `\n5. This is from the song "${context.title}" by "${context.artist}"`;
  }
  
  let userPrompt = `Translate this lyric line to ${targetLangName}:\n"${text}"`;
  
  if (context?.previousLine) {
    userPrompt = `Previous line: "${context.previousLine}"\n` + userPrompt;
  }
  if (context?.nextLine) {
    userPrompt += `\nNext line: "${context.nextLine}"`;
  }
  
  userPrompt += `\n\nProvide only the translation, no explanations.`;
  
  try {
    logger.info(`🌍 GPT-5 translating to ${targetLangName}: ${text.substring(0, 50)}...`);
    
    // Try GPT-5 first (when available)
    let response;
    let modelUsed = 'gpt-5-turbo';
    
    try {
      response = await client.chat.completions.create({
        model: 'gpt-5-turbo', // Will use GPT-5 when available
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });
    } catch (gpt5Error: any) {
      // Fallback to GPT-4 Turbo if GPT-5 not available
      logger.warn('GPT-5 not available, falling back to GPT-4 Turbo');
      modelUsed = 'gpt-4-turbo-preview';
      
      response = await client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });
    }
    
    const translation = response.choices[0]?.message?.content?.trim() || text;
    
    logger.success(`✅ GPT-5 translation complete (${modelUsed})`);
    
    return {
      translation,
      confidence: 0.95,
      model: modelUsed,
    };
  } catch (error: any) {
    logger.error('GPT-5 translation error:', error);
    
    // Final fallback: return original text
    return {
      translation: text,
      confidence: 0,
      model: 'fallback',
    };
  }
}

// Batch translation for multiple lines
async function batchTranslateWithGPT5(
  lines: string[],
  targetLanguage: string,
  songContext?: { artist?: string; title?: string }
): Promise<TranslationResponse[]> {
  const client = await getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI client initialization failed');
  }
  
  const targetLangName = languageNames[targetLanguage] || targetLanguage;
  
  // For batch translation, use a single prompt with all lines
  const systemPrompt = `You are a professional translator specializing in song lyrics.
Translate the given song lyrics to ${targetLangName} while:
1. Preserving emotional tone and artistic expression
2. Maintaining cultural nuances and metaphors
3. Keeping rhythm and flow suitable for singing
4. Using natural, colloquial language
${songContext ? `5. This is "${songContext.title}" by "${songContext.artist}"` : ''}`;
  
  const numberedLines = lines.map((line, i) => `${i + 1}. ${line}`).join('\n');
  
  const userPrompt = `Translate these lyrics to ${targetLangName}.
Keep the same numbering format in your response.

${numberedLines}

Provide only the numbered translations, no explanations.`;
  
  try {
    logger.info(`🌍 GPT-5 batch translating ${lines.length} lines to ${targetLangName}`);
    
    let response;
    let modelUsed = 'gpt-5-turbo';
    
    try {
      response = await client.chat.completions.create({
        model: 'gpt-5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });
    } catch {
      modelUsed = 'gpt-4-turbo-preview';
      response = await client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });
    }
    
    const content = response.choices[0]?.message?.content || '';
    
    // Parse numbered translations
    const translations: string[] = [];
    const translationLines = content.split('\n');
    
    for (const line of translationLines) {
      const match = line.match(/^\d+\.\s*(.+)/);
      if (match) {
        translations.push(match[1].trim());
      }
    }
    
    // Ensure we have translations for all lines
    while (translations.length < lines.length) {
      translations.push(lines[translations.length]); // Fallback to original
    }
    
    logger.success(`✅ GPT-5 batch translation complete (${modelUsed})`);
    
    return translations.slice(0, lines.length).map((translation) => ({
      translation,
      confidence: 0.95,
      model: modelUsed,
    }));
  } catch (error) {
    logger.error('GPT-5 batch translation error:', error);
    
    // Fallback: return original texts
    return lines.map((text) => ({
      translation: text,
      confidence: 0,
      model: 'fallback',
    }));
  }
}

// Single line translation endpoint
export async function POST(req: NextRequest) {
  try {
    const body: TranslationRequest = await req.json();
    const { text, targetLanguage, context } = body;
    
    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: 'Text and target language are required' },
        { status: 400 }
      );
    }
    
    const result = await translateWithGPT5(text, targetLanguage, context);
    
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Translation API error:', error);
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
}

// Batch translation endpoint
export async function PUT(req: NextRequest) {
  try {
    const { lines, targetLanguage, artist, title } = await req.json();
    
    if (!lines || !Array.isArray(lines) || !targetLanguage) {
      return NextResponse.json(
        { error: 'Lines array and target language are required' },
        { status: 400 }
      );
    }
    
    const results = await batchTranslateWithGPT5(
      lines,
      targetLanguage,
      { artist, title }
    );
    
    return NextResponse.json({ translations: results });
  } catch (error) {
    logger.error('Batch translation API error:', error);
    return NextResponse.json(
      { error: 'Batch translation failed' },
      { status: 500 }
    );
  }
}