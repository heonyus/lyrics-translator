import { logger } from '@/lib/logger';

/**
 * Canonicalize module for text normalization and multilingual artist/title mapping
 * Handles Korean, Japanese, Chinese, and English text processing
 */

// Remove common suffixes and normalize text
export function normalizeText(text: string): string {
  if (!text) return '';
  
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\u200B/g, '') // Remove zero-width spaces
    .replace(/\uFEFF/g, ''); // Remove BOM
}

// Build generic title variants for search
export function buildGenericTitleVariants(title: string): string[] {
  if (!title) return [];
  
  const variants = new Set<string>([title]);
  const normalized = normalizeText(title);
  
  if (normalized !== title) {
    variants.add(normalized);
  }
  
  // Remove parenthetical content
  const withoutParens = title.replace(/\([^)]*\)/g, '').trim();
  if (withoutParens && withoutParens !== title) {
    variants.add(withoutParens);
  }
  
  // Remove common suffixes
  const suffixes = [
    ' (Feat.*)',
    ' (feat.*)',
    ' (Ft.*)',
    ' (ft.*)',
    ' - Remix',
    ' Remix',
    ' (Remix)',
    ' - Live',
    ' Live',
    ' (Live)',
    ' - Acoustic',
    ' Acoustic',
    ' (Acoustic)',
    ' - Radio Edit',
    ' (Radio Edit)',
    ' - Extended',
    ' (Extended)',
    ' - Original',
    ' (Original)',
  ];
  
  for (const suffix of suffixes) {
    const regex = new RegExp(suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const cleaned = title.replace(regex, '').trim();
    if (cleaned && cleaned !== title) {
      variants.add(cleaned);
    }
  }
  
  // Add lowercase variant
  variants.add(title.toLowerCase());
  
  // Add uppercase variant for English titles
  if (/^[a-zA-Z\s]+$/.test(title)) {
    variants.add(title.toUpperCase());
  }
  
  return Array.from(variants);
}

// Detect language of text
export function detectLanguage(text: string): 'ko' | 'ja' | 'zh' | 'en' | 'unknown' {
  if (!text) return 'unknown';
  
  // Korean (Hangul)
  if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/.test(text)) {
    return 'ko';
  }
  
  // Japanese (Hiragana, Katakana, or common Kanji)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return 'ja';
  }
  
  // Chinese (CJK Unified Ideographs)
  if (/[\u4E00-\u9FFF]/.test(text)) {
    return 'zh';
  }
  
  // English (Latin alphabet)
  if (/^[a-zA-Z\s\d\-.,!?'"]+$/.test(text)) {
    return 'en';
  }
  
  return 'unknown';
}

// Convert to romanized version
export function romanize(text: string, language?: string): string {
  if (!text) return '';
  
  const lang = language || detectLanguage(text);
  
  // For now, return uppercase version for English
  // In production, you'd use proper romanization libraries
  if (lang === 'en') {
    return text.toUpperCase();
  }
  
  // For other languages, return as-is
  // This will be replaced with actual romanization logic
  return text.toUpperCase().replace(/[^A-Z0-9\s]/g, '');
}

// Resolve canonical form using Perplexity API
export async function resolveCanonicalPPLX(
  artist: string,
  title: string
): Promise<{ artist: string; title: string } | null> {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      logger.warn('Perplexity API key not configured');
      return null;
    }
    
    const prompt = `
Given the artist "${artist}" and song title "${title}", provide the canonical form:
1. If Korean/Japanese/Chinese, provide original script
2. If Western, provide standard spelling
3. Remove feat./ft. from artist name
4. Use most common/official title

Return JSON: {"artist": "canonical artist", "title": "canonical title"}
`;
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-reasoning-pro',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });
    
    if (!response.ok) {
      logger.error('Perplexity API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return null;
    
    // Try to parse JSON from response
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          artist: parsed.artist || artist,
          title: parsed.title || title,
        };
      } catch (e) {
        logger.error('Failed to parse canonical response:', e);
      }
    }
    
    return null;
  } catch (error) {
    logger.error('resolveCanonicalPPLX error:', error);
    return null;
  }
}

// Format artist and title with multilingual display
export async function formatMultilingualDisplay(
  artist: string,
  title: string
): Promise<{ artistDisplay: string; titleDisplay: string }> {
  const artistLang = detectLanguage(artist);
  const titleLang = detectLanguage(title);
  
  let artistDisplay = artist;
  let titleDisplay = title;
  
  // Add romanized version in parentheses for non-English
  if (artistLang !== 'en' && artistLang !== 'unknown') {
    const romanized = romanize(artist, artistLang);
    if (romanized && romanized !== artist) {
      artistDisplay = `${artist} (${romanized})`;
    }
  }
  
  if (titleLang !== 'en' && titleLang !== 'unknown') {
    const romanized = romanize(title, titleLang);
    if (romanized && romanized !== title) {
      titleDisplay = `${title} (${romanized})`;
    }
  }
  
  return { artistDisplay, titleDisplay };
}

// Export all functions
export default {
  normalizeText,
  buildGenericTitleVariants,
  detectLanguage,
  romanize,
  resolveCanonicalPPLX,
  formatMultilingualDisplay,
};