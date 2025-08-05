import { TranslationCacheEntry, TranslationResult } from '../types/translation.types';

/**
 * Translation Cache Service
 * Caches translation results to reduce API calls and improve performance
 */

export class TranslationCacheService {
  private cache: Map<string, TranslationCacheEntry>;
  private readonly defaultTTL: number;

  constructor(defaultTTL: number = 86400000) { // 24 hours
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Generate cache key from text and languages
   */
  private generateKey(text: string, sourceLanguage: string, targetLanguage: string): string {
    return `${sourceLanguage}:${targetLanguage}:${text}`;
  }

  /**
   * Get cached translation
   */
  get(text: string, sourceLanguage: string, targetLanguage: string): TranslationResult | null {
    const key = this.generateKey(text, sourceLanguage, targetLanguage);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * Set cached translation
   */
  set(
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string, 
    result: TranslationResult,
    ttl?: number
  ): void {
    const key = this.generateKey(text, sourceLanguage, targetLanguage);
    const now = Date.now();
    
    const entry: TranslationCacheEntry = {
      key,
      result,
      timestamp: now,
      expiresAt: now + (ttl || this.defaultTTL)
    };

    this.cache.set(key, entry);
  }

  /**
   * Get multiple cached translations
   */
  getMany(
    texts: string[], 
    sourceLanguage: string, 
    targetLanguage: string
  ): (TranslationResult | null)[] {
    return texts.map(text => this.get(text, sourceLanguage, targetLanguage));
  }

  /**
   * Set multiple cached translations
   */
  setMany(
    texts: string[], 
    sourceLanguage: string, 
    targetLanguage: string, 
    results: TranslationResult[],
    ttl?: number
  ): void {
    texts.forEach((text, index) => {
      if (results[index]) {
        this.set(text, sourceLanguage, targetLanguage, results[index], ttl);
      }
    });
  }

  /**
   * Clear expired entries
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    let oldest: number | null = null;
    let newest: number | null = null;

    for (const entry of this.cache.values()) {
      if (!oldest || entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
      if (!newest || entry.timestamp > newest) {
        newest = entry.timestamp;
      }
    }

    return {
      size: this.cache.size,
      oldestEntry: oldest,
      newestEntry: newest
    };
  }

  /**
   * Export cache to JSON
   */
  export(): string {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      ...entry,
      key // key is already in entry, so this ensures it's not duplicated
    }));
    return JSON.stringify(entries, null, 2);
  }

  /**
   * Import cache from JSON
   */
  import(json: string): void {
    try {
      const entries = JSON.parse(json) as TranslationCacheEntry[];
      this.cache.clear();
      
      entries.forEach(entry => {
        this.cache.set(entry.key, entry);
      });
    } catch (error) {
      console.error('Failed to import cache:', error);
      throw new Error('잘못된 캐시 데이터');
    }
  }
}