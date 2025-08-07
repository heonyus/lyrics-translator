import { logger, APITimer } from '@/lib/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

// Search for lyrics using Gemini
export async function geminiSearch({ 
  artist, 
  title 
}: { 
  artist: string; 
  title: string;
}) {
  const timer = new APITimer('Gemini Search');
  
  logger.info(`🤖 Gemini Search: ${artist} - ${title}`);
  
  if (!GOOGLE_API_KEY) {
    timer.skip('Google API key not configured');
    return {
      success: false,
      message: 'Gemini not configured'
    };
  }
  
  try {
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // First, try to get lyrics directly
    const directPrompt = `Find the complete lyrics for the song "${title}" by ${artist}.

Important:
- Return ONLY the actual lyrics, no explanations or metadata
- If you don't know the exact lyrics, say "LYRICS_NOT_FOUND"
- Do not make up or generate lyrics
- Preserve the original line breaks and structure

Song lyrics:`;
    
    const directResult = await model.generateContent(directPrompt);
    const directResponse = await directResult.response;
    const directLyrics = directResponse.text().trim();
    
    // Check if Gemini found the lyrics
    if (directLyrics && !directLyrics.includes('LYRICS_NOT_FOUND') && directLyrics.length > 200) {
      timer.success(`Found ${directLyrics.length} chars directly`);
      
      return {
        success: true,
        result: {
          lyrics: directLyrics,
          source: 'gemini-direct',
          artist,
          title,
          confidence: 0.85,
          hasTimestamps: false,
          searchTime: Date.now() - (timer as any).startTime
        }
      };
    }
    
    // If direct search failed, try to find lyrics websites
    const searchPrompt = `Help me find the lyrics for "${title}" by ${artist}.

Please provide:
1. The most reliable lyrics websites that would have this song
2. Any specific search tips for finding this particular song
3. Alternative song titles or artist names if applicable

Format your response as:
WEBSITES: [list of URLs]
SEARCH_TIPS: [tips]
ALTERNATIVES: [alternative names]`;
    
    const searchResult = await model.generateContent(searchPrompt);
    const searchResponse = await searchResult.response;
    const searchText = searchResponse.text().trim();
    
    // Extract URLs from the response
    const urlMatches = searchText.match(/https?:\/\/[^\s\]]+/g) || [];
    
    if (urlMatches.length > 0) {
      logger.info(`🔗 Gemini suggested ${urlMatches.length} URLs`);
      
      // Try to fetch and parse the first URL
      const firstUrl = urlMatches[0];
      const fetchResult = await fetchAndParseWithGemini(firstUrl, artist, title);
      
      if (fetchResult) {
        timer.success(`Found ${fetchResult.lyrics.length} chars from ${fetchResult.source}`);
        return {
          success: true,
          result: fetchResult
        };
      }
    }
    
    timer.fail('Could not find lyrics');
    return {
      success: false,
      error: 'Gemini could not find lyrics'
    };
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Gemini Search error:', error);
    
    return {
      success: false,
      error: 'Gemini search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Fetch URL and parse with Gemini
async function fetchAndParseWithGemini(url: string, artist: string, title: string): Promise<any | null> {
  try {
    logger.info(`📄 Fetching URL suggested by Gemini: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (!response.ok) {
      logger.warning(`Failed to fetch ${url}: HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Clean HTML
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .substring(0, 20000); // Limit to 20k chars
    
    // Use Gemini to extract lyrics
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const extractPrompt = `Extract the lyrics for "${title}" by ${artist} from this HTML content.

Rules:
- Extract ONLY the song lyrics, no metadata or explanations
- Preserve line breaks and verse structure
- Remove any annotations like [Verse 1], [Chorus] if present
- If no lyrics found, return "NO_LYRICS_FOUND"

HTML content:
${cleanedHtml}

Extracted lyrics:`;
    
    const result = await model.generateContent(extractPrompt);
    const response = await result.response;
    const lyrics = response.text().trim();
    
    if (lyrics && !lyrics.includes('NO_LYRICS_FOUND') && lyrics.length > 100) {
      return {
        lyrics,
        source: `gemini-${new URL(url).hostname.replace('www.', '')}`,
        url,
        artist,
        title,
        confidence: 0.8,
        hasTimestamps: false
      };
    }
    
    return null;
    
  } catch (error) {
    logger.error(`Error processing URL ${url}:`, error);
    return null;
  }
}