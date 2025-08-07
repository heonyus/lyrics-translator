import { LRUCache } from 'lru-cache';

// 싱글톤 메모리 캐시 인스턴스
// 모든 API 라우트에서 공유
const memoryCache = new LRUCache<string, any>({
  max: 200, // 최대 200개 항목
  ttl: 1000 * 60 * 10, // 10분 TTL
  updateAgeOnGet: true,
  updateAgeOnHas: true,
});

// 캐시 통계
let cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
};

export function getMemoryCache() {
  return memoryCache;
}

export function getCacheStats() {
  return {
    ...cacheStats,
    size: memoryCache.size,
    hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0,
  };
}

export function getCachedValue(key: string): any | null {
  const value = memoryCache.get(key);
  if (value) {
    cacheStats.hits++;
    console.log(`⚡ Memory cache hit for: ${key}`);
  } else {
    cacheStats.misses++;
  }
  return value;
}

export function setCachedValue(key: string, value: any): void {
  memoryCache.set(key, value);
  cacheStats.sets++;
  console.log(`💾 Saved to memory cache: ${key}`);
}

export function clearCache(): void {
  memoryCache.clear();
  console.log('🗑️ Memory cache cleared');
}

export function deleteCachedValue(key: string): boolean {
  return memoryCache.delete(key);
}

// 캐시 키 생성 헬퍼
export function createCacheKey(artist: string, title: string): string {
  return `${artist}_${title}`.toLowerCase().replace(/\s+/g, '_');
}