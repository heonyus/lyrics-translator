import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TranslateRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  context?: {
    artist?: string;
    title?: string;
    genre?: string;
    mood?: string;
  };
}

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
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  sv: 'Swedish',
  no: 'Norwegian'
};

export async function POST(request: NextRequest) {
  try {
    const body: TranslateRequest = await request.json();
    const { text, targetLanguage, sourceLanguage, context } = body;

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: 'Text and target language are required' },
        { status: 400 }
      );
    }

    const targetLangName = languageNames[targetLanguage] || targetLanguage;
    const sourceLangName = sourceLanguage ? (languageNames[sourceLanguage] || sourceLanguage) : 'auto-detect';

    // Build context-aware prompt
    let systemPrompt = `You are a professional translator specializing in song lyrics and poetry. 
Your task is to translate lyrics while preserving:
1. The emotional tone and mood
2. Poetic elements and metaphors
3. Cultural nuances
4. Rhythm and flow when possible
5. The original meaning and intent

Translate from ${sourceLangName} to ${targetLangName}.`;

    if (context) {
      systemPrompt += `\n\nContext:`;
      if (context.artist) systemPrompt += `\n- Artist: ${context.artist}`;
      if (context.title) systemPrompt += `\n- Song Title: ${context.title}`;
      if (context.genre) systemPrompt += `\n- Genre: ${context.genre}`;
      if (context.mood) systemPrompt += `\n- Mood: ${context.mood}`;
    }

    systemPrompt += `\n\nProvide ONLY the translation without any explanations or notes.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const translatedText = completion.choices[0]?.message?.content || '';

    // Parse line-by-line if the input was multi-line
    const inputLines = text.split('\n');
    const outputLines = translatedText.split('\n');

    // Try to maintain line correspondence
    const translations = inputLines.map((line, index) => ({
      original: line,
      translated: outputLines[index] || '',
      lineNumber: index + 1
    }));

    return NextResponse.json({
      translatedText,
      translations,
      metadata: {
        model: 'gpt-4-turbo-preview',
        sourceLanguage: sourceLangName,
        targetLanguage: targetLangName,
        context,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('AI Translation error:', error);
    
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Translation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Batch translation endpoint
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { lines, targetLanguage, sourceLanguage, context } = body;

    if (!lines || !Array.isArray(lines) || !targetLanguage) {
      return NextResponse.json(
        { error: 'Lines array and target language are required' },
        { status: 400 }
      );
    }

    const targetLangName = languageNames[targetLanguage] || targetLanguage;
    const sourceLangName = sourceLanguage ? (languageNames[sourceLanguage] || sourceLanguage) : 'auto-detect';

    // Combine lines for batch translation
    const combinedText = lines.join('\n[BREAK]\n');

    const systemPrompt = `You are translating song lyrics from ${sourceLangName} to ${targetLangName}.
Translate each line separated by [BREAK] markers.
Preserve the emotional tone, poetic elements, and meaning.
Keep the [BREAK] markers in your translation to maintain line separation.
Provide ONLY the translations.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: combinedText }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const translatedText = completion.choices[0]?.message?.content || '';
    const translatedLines = translatedText.split(/\[BREAK\]/i).map(line => line.trim());

    const translations = lines.map((originalLine, index) => ({
      original: originalLine,
      translated: translatedLines[index] || '',
      lineNumber: index + 1
    }));

    return NextResponse.json({
      translations,
      metadata: {
        model: 'gpt-4-turbo-preview',
        sourceLanguage: sourceLangName,
        targetLanguage: targetLangName,
        totalLines: lines.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Batch AI Translation error:', error);
    return NextResponse.json(
      { error: 'Batch translation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}