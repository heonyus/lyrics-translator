/**
 * Translation Domain
 * Real-time translation for karaoke lyrics
 */

// Types
export type {
  TranslationRequest,
  TranslationResult,
  BatchTranslationRequest,
  BatchTranslationResult,
  TranslationCacheEntry,
  TranslationSettings,
  SupportedLanguage
} from './types/translation.types';

export {
  supportedLanguages,
  languageInfo,
  isSupportedLanguage,
  defaultTranslationSettings,
  TranslationRequestSchema,
  TranslationResultSchema,
  BatchTranslationRequestSchema,
  BatchTranslationResultSchema,
  TranslationSettingsSchema
} from './types/translation.types';

// Services
export { TranslationService } from './services/translation.service';
export { GoogleTranslateService } from './services/google-translate.service';
export { TranslationCacheService } from './services/translation-cache.service';

// Hooks
export { useTranslation } from './hooks/useTranslation';