import {
  TranslationRequest,
  TranslationResult,
  BatchTranslationRequest,
  BatchTranslationResult,
  SupportedLanguage,
  TranslationRequestSchema,
  BatchTranslationRequestSchema
} from '../types/translation.types';

/**
 * Google Translate Service
 * Handles translation using Google Cloud Translation API
 */

const GOOGLE_TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';

export class GoogleTranslateService {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Google API 키가 필요합니다');
    }
    this.apiKey = apiKey;
  }

  /**
   * Translate single text
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    // Validate request
    const validated = TranslationRequestSchema.parse(request);

    try {
      const response = await fetch(`${GOOGLE_TRANSLATE_API_URL}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: validated.text,
          target: validated.targetLanguage,
          source: validated.sourceLanguage,
          format: 'text'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`번역 실패: ${error.error?.message || '알 수 없는 오류'}`);
      }

      const data = await response.json();
      const translation = data.data.translations[0];

      return {
        translatedText: translation.translatedText,
        sourceLanguage: (translation.detectedSourceLanguage || validated.sourceLanguage || 'en') as SupportedLanguage,
        targetLanguage: validated.targetLanguage,
        confidence: translation.confidence
      };
    } catch (error) {
      console.error('Google Translate error:', error);
      throw error;
    }
  }

  /**
   * Translate multiple texts in batch
   */
  async translateBatch(request: BatchTranslationRequest): Promise<BatchTranslationResult> {
    // Validate request
    const validated = BatchTranslationRequestSchema.parse(request);

    try {
      const response = await fetch(`${GOOGLE_TRANSLATE_API_URL}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: validated.texts,
          target: validated.targetLanguage,
          source: validated.sourceLanguage,
          format: 'text'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`일괄 번역 실패: ${error.error?.message || '알 수 없는 오류'}`);
      }

      const data = await response.json();
      const detectedSourceLanguage = data.data.translations[0]?.detectedSourceLanguage || validated.sourceLanguage || 'en';

      const translations: TranslationResult[] = data.data.translations.map((translation: any, index: number) => ({
        translatedText: translation.translatedText,
        sourceLanguage: detectedSourceLanguage as SupportedLanguage,
        targetLanguage: validated.targetLanguage,
        confidence: translation.confidence
      }));

      return {
        translations,
        sourceLanguage: detectedSourceLanguage as SupportedLanguage,
        targetLanguage: validated.targetLanguage
      };
    } catch (error) {
      console.error('Google Translate batch error:', error);
      throw error;
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<{ language: SupportedLanguage; confidence: number }> {
    try {
      const response = await fetch(`${GOOGLE_TRANSLATE_API_URL}/detect?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`언어 감지 실패: ${error.error?.message || '알 수 없는 오류'}`);
      }

      const data = await response.json();
      const detection = data.data.detections[0][0];

      return {
        language: detection.language as SupportedLanguage,
        confidence: detection.confidence
      };
    } catch (error) {
      console.error('Language detection error:', error);
      throw error;
    }
  }

  /**
   * Get supported languages from API
   */
  async getSupportedLanguages(): Promise<Array<{ code: string; name: string }>> {
    try {
      const response = await fetch(`${GOOGLE_TRANSLATE_API_URL}/languages?key=${this.apiKey}&target=en`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`언어 목록 가져오기 실패: ${error.error?.message || '알 수 없는 오류'}`);
      }

      const data = await response.json();
      return data.data.languages;
    } catch (error) {
      console.error('Get languages error:', error);
      throw error;
    }
  }
}