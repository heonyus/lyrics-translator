import { z } from 'zod';

/**
 * Translation Domain Types
 * Real-time translation for karaoke lyrics
 */

// Supported languages
export const supportedLanguages = [
  'en', 'ko', 'ja', 'zh', 'es', 'fr', 'de', 'pt', 'ru', 'ar',
  'hi', 'th', 'vi', 'id', 'it', 'nl', 'pl', 'tr', 'sv', 'no'
] as const;

export type SupportedLanguage = typeof supportedLanguages[number];

// Language info
export const languageInfo: Record<SupportedLanguage, { name: string; nativeName: string }> = {
  en: { name: 'English', nativeName: 'English' },
  ko: { name: 'Korean', nativeName: '한국어' },
  ja: { name: 'Japanese', nativeName: '日本語' },
  zh: { name: 'Chinese', nativeName: '中文' },
  es: { name: 'Spanish', nativeName: 'Español' },
  fr: { name: 'French', nativeName: 'Français' },
  de: { name: 'German', nativeName: 'Deutsch' },
  pt: { name: 'Portuguese', nativeName: 'Português' },
  ru: { name: 'Russian', nativeName: 'Русский' },
  ar: { name: 'Arabic', nativeName: 'العربية' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी' },
  th: { name: 'Thai', nativeName: 'ไทย' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  id: { name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  it: { name: 'Italian', nativeName: 'Italiano' },
  nl: { name: 'Dutch', nativeName: 'Nederlands' },
  pl: { name: 'Polish', nativeName: 'Polski' },
  tr: { name: 'Turkish', nativeName: 'Türkçe' },
  sv: { name: 'Swedish', nativeName: 'Svenska' },
  no: { name: 'Norwegian', nativeName: 'Norsk' }
};

// Translation request
export interface TranslationRequest {
  text: string;
  targetLanguage: SupportedLanguage;
  sourceLanguage?: SupportedLanguage;
}

// Translation result
export interface TranslationResult {
  translatedText: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  confidence?: number;
}

// Batch translation request
export interface BatchTranslationRequest {
  texts: string[];
  targetLanguage: SupportedLanguage;
  sourceLanguage?: SupportedLanguage;
}

// Batch translation result
export interface BatchTranslationResult {
  translations: TranslationResult[];
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
}

// Translation cache entry
export interface TranslationCacheEntry {
  key: string;
  result: TranslationResult;
  timestamp: number;
  expiresAt: number;
}

// Translation settings
export interface TranslationSettings {
  targetLanguages: SupportedLanguage[];
  autoDetectSource: boolean;
  cacheEnabled: boolean;
  cacheDuration: number; // in seconds
}

// Zod Schemas
export const TranslationRequestSchema = z.object({
  text: z.string().min(1),
  targetLanguage: z.enum(supportedLanguages),
  sourceLanguage: z.enum(supportedLanguages).optional()
});

export const TranslationResultSchema = z.object({
  translatedText: z.string(),
  sourceLanguage: z.enum(supportedLanguages),
  targetLanguage: z.enum(supportedLanguages),
  confidence: z.number().min(0).max(1).optional()
});

export const BatchTranslationRequestSchema = z.object({
  texts: z.array(z.string().min(1)),
  targetLanguage: z.enum(supportedLanguages),
  sourceLanguage: z.enum(supportedLanguages).optional()
});

export const BatchTranslationResultSchema = z.object({
  translations: z.array(TranslationResultSchema),
  sourceLanguage: z.enum(supportedLanguages),
  targetLanguage: z.enum(supportedLanguages)
});

export const TranslationSettingsSchema = z.object({
  targetLanguages: z.array(z.enum(supportedLanguages)).min(1),
  autoDetectSource: z.boolean(),
  cacheEnabled: z.boolean(),
  cacheDuration: z.number().positive()
});

// Type guards
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return supportedLanguages.includes(lang as SupportedLanguage);
}

// Default settings
export const defaultTranslationSettings: TranslationSettings = {
  targetLanguages: ['en'],
  autoDetectSource: true,
  cacheEnabled: true,
  cacheDuration: 86400 // 24 hours
};