import { logger, APITimer } from '@/lib/logger';

let PERPLEXITY_API_KEY: string | undefined;
let GROQ_API_KEY: string | undefined;
let CLAUDE_API_KEY: string | undefined;
async function loadKeys() {
  if (typeof window !== 'undefined') return;
  const { getSecret } = await import('@/lib/secure-secrets');
  PERPLEXITY_API_KEY = (await getSecret('perplexity')) || process.env.PERPLEXITY_API_KEY;
  GROQ_API_KEY = (await getSecret('groq')) || process.env.GROQ_API_KEY;
  CLAUDE_API_KEY = (await getSecret('anthropic')) || process.env.CLAUDE_API_KEY;
}

// Search using Perplexity to find lyrics
async function searchWithPerplexity(artist: string, title: string): Promise<string | null> {
  const timer = new APITimer('Perplexity Scraper');
  await loadKeys();
  
  if (!PERPLEXITY_API_KEY) {
    timer.skip('Perplexity API key not configured');
    return null;
  }
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-medium-online',
        messages: [
          {
            role: 'system',
            content: 'You are a lyrics finder. Search the web and return the complete, accurate lyrics for songs. Do not generate or make up lyrics.'
          },
          {
            role: 'user',
            content: `Find the complete lyrics for "${title}" by ${artist}. Search multiple sources and return the most accurate version. Return ONLY the lyrics, no explanations.`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const lyrics = data.choices?.[0]?.message?.content || '';
    
    if (lyrics && lyrics.length > 200) {
      timer.success(`Found ${lyrics.length} chars`);
      return lyrics;
    }
    
    timer.fail('Response too short');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Search using Claude as backup
async function searchWithClaude(artist: string, title: string): Promise<string | null> {
  const timer = new APITimer('Claude Scraper');
  await loadKeys();
  
  if (!CLAUDE_API_KEY) {
    timer.skip('Claude API key not configured');
    return null;
  }
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `I need the lyrics for "${title}" by ${artist}. Please search your knowledge and provide the complete, accurate lyrics. If you don't know the exact lyrics, return "LYRICS_NOT_FOUND". Do not generate or make up lyrics. Return ONLY the actual lyrics.`
          }
        ],
        temperature: 0.1
      })
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const lyrics = data.content?.[0]?.text || '';
    
    if (lyrics && !lyrics.includes('LYRICS_NOT_FOUND') && lyrics.length > 180) {
      timer.success(`Found ${lyrics.length} chars`);
      return lyrics;
    }
    
    timer.fail('No valid lyrics found');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Use Groq to search and clean lyrics
async function searchWithGroq(artist: string, title: string): Promise<string | null> {
  const timer = new APITimer('Groq Scraper');
  await loadKeys();
  
  if (!GROQ_API_KEY) {
    timer.skip('Groq API key not configured');
    return null;
  }
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a lyrics expert. Provide accurate, complete song lyrics when asked. Never make up or generate lyrics.'
          },
          {
            role: 'user',
            content: `Provide the complete lyrics for "${title}" by ${artist}. If you don't have the exact lyrics in your training data, return "LYRICS_NOT_AVAILABLE". Return ONLY the lyrics text, no metadata or explanations.`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });
    
    if (!response.ok) {
      timer.fail(`HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const lyrics = data.choices?.[0]?.message?.content || '';
    
    if (lyrics && !lyrics.includes('LYRICS_NOT_AVAILABLE') && lyrics.length > 180) {
      timer.success(`Found ${lyrics.length} chars`);
      return lyrics;
    }
    
    timer.fail('No valid lyrics found');
    return null;
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Main smart scraper function
export async function smartScraperV2({ 
  artist, 
  title, 
  forceRefresh = false 
}: { 
  artist: string; 
  title: string; 
  forceRefresh?: boolean;
}) {
  const timer = new APITimer('Smart Scraper V2');
  
  logger.info(`🔍 Smart Scraper V2: ${artist} - ${title}`);
  
  try {
    // Try multiple AI providers in parallel
    const searches = [
      searchWithPerplexity(artist, title),
      searchWithGroq(artist, title),
      searchWithClaude(artist, title)
    ];
    
    const results = await Promise.allSettled(searches);
    const sources = ['perplexity', 'groq', 'claude'];
    
    // Find the best result
    let bestLyrics: string | null = null;
    let bestSource: string | null = null;
    let bestLength = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const lyrics = result.value;
        if (lyrics.length > bestLength) {
          bestLyrics = lyrics;
          bestSource = sources[index];
          bestLength = lyrics.length;
        }
      }
    });
    
    if (!bestLyrics || !bestSource) {
      timer.fail('No results from any AI provider');
      return {
        success: false,
        error: 'Could not find lyrics from AI providers'
      };
    }
    
    timer.success(`Found from ${bestSource}: ${bestLength} chars`);
    
    return {
      success: true,
      result: {
        lyrics: bestLyrics,
        source: `smart-scraper-v2-${bestSource}`,
        artist,
        title,
        confidence: 0.75,
        hasTimestamps: false,
        searchTime: Date.now() - (timer as any).startTime
      }
    };
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Smart Scraper V2 error:', error);
    
    return {
      success: false,
      error: 'Smart scraper failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}