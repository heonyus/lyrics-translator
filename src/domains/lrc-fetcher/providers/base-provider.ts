/**
 * Base LRC Provider
 */

import { LRCProvider, LRCSearchResult, SongQuery, ProviderConfig } from '../types/provider.types';

export abstract class BaseProvider implements LRCProvider {
  abstract name: string;
  abstract priority: number;
  abstract confidence: number;
  
  protected config: ProviderConfig;
  protected lastRequestTime: number = 0;
  
  constructor(config: ProviderConfig = {}) {
    this.config = config;
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      // Check if API key is configured if required
      if (this.requiresApiKey() && !this.config.apiKey) {
        return false;
      }
      
      // Check rate limiting
      if (!this.canMakeRequest()) {
        return false;
      }
      
      // Provider-specific availability check
      return await this.checkAvailability();
    } catch {
      return false;
    }
  }
  
  abstract searchLRC(query: SongQuery): Promise<LRCSearchResult[]>;
  abstract fetchLRC(lrcId: string): Promise<string>;
  
  protected abstract checkAvailability(): Promise<boolean>;
  protected abstract requiresApiKey(): boolean;
  
  protected canMakeRequest(): boolean {
    if (!this.config.rateLimit) return true;
    
    const now = Date.now();
    const window = this.config.rateLimit.window * 1000;
    
    if (now - this.lastRequestTime < window / this.config.rateLimit.requests) {
      return false;
    }
    
    return true;
  }
  
  protected updateRequestTime(): void {
    this.lastRequestTime = Date.now();
  }
  
  protected async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const timeout = this.config.timeout || 10000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  protected normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  protected calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = this.normalizeString(str1);
    const s2 = this.normalizeString(str2);
    
    if (s1 === s2) return 1.0;
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}