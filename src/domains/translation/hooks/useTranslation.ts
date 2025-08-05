'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  TranslationResult,
  BatchTranslationResult,
  SupportedLanguage,
  TranslationSettings,
  defaultTranslationSettings
} from '../types/translation.types';
import { TranslationService } from '../services/translation.service';

interface UseTranslationOptions {
  apiKey?: string;
  settings?: Partial<TranslationSettings>;
  onError?: (error: Error) => void;
}

interface UseTranslationReturn {
  // State
  isTranslating: boolean;
  error: Error | null;
  
  // Single translation
  translate: (text: string, targetLanguage: SupportedLanguage, sourceLanguage?: SupportedLanguage) => Promise<TranslationResult | null>;
  translationResult: TranslationResult | null;
  
  // Batch translation
  translateBatch: (texts: string[], targetLanguage: SupportedLanguage, sourceLanguage?: SupportedLanguage) => Promise<BatchTranslationResult | null>;
  batchResult: BatchTranslationResult | null;
  
  // Multi-language translation
  translateToMultiple: (text: string, targetLanguages: SupportedLanguage[], sourceLanguage?: SupportedLanguage) => Promise<Map<SupportedLanguage, TranslationResult> | null>;
  multiResult: Map<SupportedLanguage, TranslationResult> | null;
  
  // Cache management
  clearCache: () => void;
  cacheStats: { size: number; oldestEntry: number | null; newestEntry: number | null };
  
  // Settings
  settings: TranslationSettings;
  updateSettings: (settings: Partial<TranslationSettings>) => void;
}

export function useTranslation(options: UseTranslationOptions = {}): UseTranslationReturn {
  const { apiKey, settings: initialSettings, onError } = options;
  
  // Get API key from environment if not provided
  const finalApiKey = apiKey || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  
  // State
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchTranslationResult | null>(null);
  const [multiResult, setMultiResult] = useState<Map<SupportedLanguage, TranslationResult> | null>(null);
  const [cacheStats, setCacheStats] = useState({ size: 0, oldestEntry: null as number | null, newestEntry: null as number | null });
  const [settings, setSettings] = useState<TranslationSettings>({ ...defaultTranslationSettings, ...initialSettings });
  
  // Service instance
  const serviceRef = useRef<TranslationService | null>(null);
  
  // Initialize service
  useEffect(() => {
    if (finalApiKey) {
      serviceRef.current = new TranslationService(finalApiKey, settings);
      updateCacheStats();
    }
  }, [finalApiKey]);
  
  // Update cache stats
  const updateCacheStats = useCallback(() => {
    if (serviceRef.current) {
      setCacheStats(serviceRef.current.getCacheStats());
    }
  }, []);
  
  // Handle errors
  const handleError = useCallback((err: Error) => {
    setError(err);
    if (onError) {
      onError(err);
    }
  }, [onError]);
  
  // Translate single text
  const translate = useCallback(async (
    text: string,
    targetLanguage: SupportedLanguage,
    sourceLanguage?: SupportedLanguage
  ): Promise<TranslationResult | null> => {
    if (!serviceRef.current) {
      handleError(new Error('Translation service not initialized. Please provide an API key.'));
      return null;
    }
    
    setIsTranslating(true);
    setError(null);
    
    try {
      const result = await serviceRef.current.translate({
        text,
        targetLanguage,
        sourceLanguage
      });
      
      setTranslationResult(result);
      updateCacheStats();
      return result;
    } catch (err) {
      handleError(err as Error);
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, [handleError, updateCacheStats]);
  
  // Translate batch
  const translateBatch = useCallback(async (
    texts: string[],
    targetLanguage: SupportedLanguage,
    sourceLanguage?: SupportedLanguage
  ): Promise<BatchTranslationResult | null> => {
    if (!serviceRef.current) {
      handleError(new Error('Translation service not initialized. Please provide an API key.'));
      return null;
    }
    
    setIsTranslating(true);
    setError(null);
    
    try {
      const result = await serviceRef.current.translateBatch({
        texts,
        targetLanguage,
        sourceLanguage
      });
      
      setBatchResult(result);
      updateCacheStats();
      return result;
    } catch (err) {
      handleError(err as Error);
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, [handleError, updateCacheStats]);
  
  // Translate to multiple languages
  const translateToMultiple = useCallback(async (
    text: string,
    targetLanguages: SupportedLanguage[],
    sourceLanguage?: SupportedLanguage
  ): Promise<Map<SupportedLanguage, TranslationResult> | null> => {
    if (!serviceRef.current) {
      handleError(new Error('Translation service not initialized. Please provide an API key.'));
      return null;
    }
    
    setIsTranslating(true);
    setError(null);
    
    try {
      const result = await serviceRef.current.translateToMultiple(
        text,
        targetLanguages,
        sourceLanguage
      );
      
      setMultiResult(result);
      updateCacheStats();
      return result;
    } catch (err) {
      handleError(err as Error);
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, [handleError, updateCacheStats]);
  
  // Clear cache
  const clearCache = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.clearCache();
      updateCacheStats();
    }
  }, [updateCacheStats]);
  
  // Update settings
  const updateSettings = useCallback((newSettings: Partial<TranslationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    
    if (serviceRef.current) {
      serviceRef.current.updateSettings(newSettings);
    }
  }, []);
  
  return {
    // State
    isTranslating,
    error,
    
    // Single translation
    translate,
    translationResult,
    
    // Batch translation
    translateBatch,
    batchResult,
    
    // Multi-language translation
    translateToMultiple,
    multiResult,
    
    // Cache management
    clearCache,
    cacheStats,
    
    // Settings
    settings,
    updateSettings
  };
}