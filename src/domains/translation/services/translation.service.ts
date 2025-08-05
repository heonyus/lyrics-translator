import {
  TranslationRequest,
  TranslationResult,
  BatchTranslationRequest,
  BatchTranslationResult,
  TranslationSettings,
  defaultTranslationSettings,
  SupportedLanguage
} from '../types/translation.types';
import { GoogleTranslateService } from './google-translate.service';
import { TranslationCacheService } from './translation-cache.service';

/**
 * Translation Service
 * Main service for handling translations with caching
 */

export class TranslationService {
  private googleTranslate: GoogleTranslateService;
  private cache: TranslationCacheService;
  private settings: TranslationSettings;

  constructor(apiKey: string, settings?: Partial<TranslationSettings>) {
    this.googleTranslate = new GoogleTranslateService(apiKey);
    this.settings = { ...defaultTranslationSettings, ...settings };
    this.cache = new TranslationCacheService(this.settings.cacheDuration * 1000);
  }

  /**
   * Translate single text with caching
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    // Auto-detect source language if needed
    let sourceLanguage = request.sourceLanguage;
    if (!sourceLanguage && this.settings.autoDetectSource) {
      const detection = await this.googleTranslate.detectLanguage(request.text);
      sourceLanguage = detection.language;
    }
    
    // Use default source language if still not set
    if (!sourceLanguage) {
      sourceLanguage = 'en';
    }

    // Check cache first
    if (this.settings.cacheEnabled) {
      const cached = this.cache.get(request.text, sourceLanguage, request.targetLanguage);
      if (cached) {
        console.log('Translation cache hit:', request.text.substring(0, 50) + '...');
        return cached;
      }
    }

    // Translate
    const result = await this.googleTranslate.translate({
      ...request,
      sourceLanguage
    });

    // Cache result
    if (this.settings.cacheEnabled) {
      this.cache.set(request.text, sourceLanguage, request.targetLanguage, result);
    }

    return result;
  }

  /**
   * Translate multiple texts with caching
   */
  async translateBatch(request: BatchTranslationRequest): Promise<BatchTranslationResult> {
    // Auto-detect source language if needed
    let sourceLanguage = request.sourceLanguage;
    if (!sourceLanguage && this.settings.autoDetectSource && request.texts.length > 0) {
      const detection = await this.googleTranslate.detectLanguage(request.texts[0]);
      sourceLanguage = detection.language;
    }
    
    // Use default source language if still not set
    if (!sourceLanguage) {
      sourceLanguage = 'en';
    }

    // Check cache for all texts
    let textsToTranslate: string[] = [];
    const cachedResults: (TranslationResult | null)[] = [];

    if (this.settings.cacheEnabled) {
      const cached = this.cache.getMany(request.texts, sourceLanguage, request.targetLanguage);
      
      request.texts.forEach((text, index) => {
        if (cached[index]) {
          cachedResults[index] = cached[index];
        } else {
          textsToTranslate.push(text);
          cachedResults[index] = null;
        }
      });

      console.log(`Translation cache: ${cached.filter(Boolean).length} hits, ${textsToTranslate.length} misses`);
    } else {
      textsToTranslate = request.texts;
    }

    // If all texts are cached, return immediately
    if (textsToTranslate.length === 0) {
      return {
        translations: cachedResults.filter(Boolean) as TranslationResult[],
        sourceLanguage,
        targetLanguage: request.targetLanguage
      };
    }

    // Translate uncached texts
    const batchResult = await this.googleTranslate.translateBatch({
      texts: textsToTranslate,
      targetLanguage: request.targetLanguage,
      sourceLanguage
    });

    // Merge results and cache new translations
    const finalResults: TranslationResult[] = [];
    let newTranslationIndex = 0;

    request.texts.forEach((text, index) => {
      if (cachedResults[index]) {
        finalResults.push(cachedResults[index]!);
      } else {
        const translation = batchResult.translations[newTranslationIndex];
        finalResults.push(translation);
        
        // Cache new translation
        if (this.settings.cacheEnabled) {
          this.cache.set(text, sourceLanguage!, request.targetLanguage, translation);
        }
        
        newTranslationIndex++;
      }
    });

    return {
      translations: finalResults,
      sourceLanguage: sourceLanguage!,
      targetLanguage: request.targetLanguage
    };
  }

  /**
   * Translate to multiple target languages
   */
  async translateToMultiple(
    text: string, 
    targetLanguages: SupportedLanguage[], 
    sourceLanguage?: SupportedLanguage
  ): Promise<Map<SupportedLanguage, TranslationResult>> {
    const results = new Map<SupportedLanguage, TranslationResult>();

    // Translate to each target language
    const promises = targetLanguages.map(async (targetLang) => {
      const result = await this.translate({
        text,
        targetLanguage: targetLang,
        sourceLanguage
      });
      results.set(targetLang, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    this.cache.clearAll();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<TranslationSettings>): void {
    this.settings = { ...this.settings, ...settings };
    
    // Update cache TTL if changed
    if (settings.cacheDuration) {
      this.cache = new TranslationCacheService(settings.cacheDuration * 1000);
    }
  }

  /**
   * Get current settings
   */
  getSettings(): TranslationSettings {
    return { ...this.settings };
  }
}