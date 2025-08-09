import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';
import { getSecret } from '@/lib/secure-secrets';

export async function POST(request: NextRequest) {
  const timer = new APITimer('Metadata Fetch');
  
  try {
    const { query, artist, title } = await request.json();
    
    // Parse input - either a single query or artist/title
    let searchQuery = '';
    if (query) {
      searchQuery = query;
    } else if (artist && title) {
      searchQuery = `${artist} - ${title}`;
    } else {
      timer.fail('Missing required parameters');
      return NextResponse.json(
        { success: false, error: 'Query or artist/title required' },
        { status: 400 }
      );
    }
    
    logger.info(`🔍 Fetching metadata for: ${searchQuery}`);
    
    // Load Perplexity API key
    const PERPLEXITY_API_KEY = (await getSecret('perplexity')) || process.env.PERPLEXITY_API_KEY;
    
    if (!PERPLEXITY_API_KEY) {
      timer.fail('Perplexity API key missing');
      return NextResponse.json(
        { success: false, error: 'Metadata service not configured' },
        { status: 500 }
      );
    }
    
    // Call Perplexity with enhanced prompt
    const perplexityPrompt = `
TASK: Extract accurate metadata for the song: "${searchQuery}"

CHAIN OF THOUGHT PROCESS:
1. Identify the exact artist name (check official sources, correct spelling)
2. Find the correct song title (official version, including features if any)
3. Locate album information (album name, release year)
4. Find high-quality album artwork URL
5. Gather additional metadata (genre, songwriters, duration)

FEW-SHOT EXAMPLES:

Example 1: "폴킴 커피한잔할래요"
{
  "artist": "폴킴",
  "artistDisplay": "폴킴 (Paul Kim)",
  "title": "커피 한잔할래요",
  "titleDisplay": "커피 한잔할래요 (Coffee With Me)",
  "album": "녹색의 계절",
  "releaseYear": "2017",
  "genre": "K-Pop, R&B/Soul",
  "albumCover": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/...",
  "songwriters": "폴킴",
  "duration": "3:47"
}

Example 2: "IU eight"
{
  "artist": "IU",
  "artistDisplay": "아이유 (IU)",
  "title": "에잇",
  "titleDisplay": "에잇 (eight) (Prod.&Feat. SUGA of BTS)",
  "album": "에잇",
  "releaseYear": "2020",
  "genre": "K-Pop",
  "albumCover": "https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/...",
  "songwriters": "IU, SUGA, EL CAPITXN",
  "duration": "2:47"
}

Example 3: "bts dynamite"
{
  "artist": "BTS",
  "artistDisplay": "방탄소년단 (BTS)",
  "title": "Dynamite",
  "titleDisplay": "Dynamite",
  "album": "BE",
  "releaseYear": "2020",
  "genre": "Pop",
  "albumCover": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/...",
  "songwriters": "David Stewart, Jessica Agombar",
  "duration": "3:19"
}

RELIABLE SOURCES TO CHECK:
- Official: Spotify, Apple Music, YouTube Music
- Korean: Melon, Genie, Bugs, FLO, Vibe
- Database: Wikipedia, Genius, AllMusic, Discogs
- For K-pop: Kprofiles, KpopWiki

CRITICAL REQUIREMENTS:
1. Use official artist/title spellings
2. Include both Korean and romanized names when applicable
3. Find the highest quality album cover URL available
4. Verify information from multiple sources
5. Return as valid JSON

OUTPUT FORMAT (JSON):
{
  "artist": "exact artist name",
  "artistDisplay": "display name with translations",
  "title": "exact song title",
  "titleDisplay": "display title with translations",
  "album": "album name",
  "releaseYear": "YYYY",
  "genre": "genre(s)",
  "albumCover": "high quality image URL",
  "songwriters": "writers/composers",
  "duration": "M:SS"
}`;

    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'user',
            content: perplexityPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    });
    
    if (!perplexityResponse.ok) {
      // Retry with fallback model
      if (perplexityResponse.status === 429 || perplexityResponse.status === 400) {
        logger.warning('Perplexity rate limit, trying fallback model');
        await new Promise(r => setTimeout(r, 500));
        
        const fallbackResponse = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar-medium-online',
            messages: [
              {
                role: 'user',
                content: `Find metadata for song: ${searchQuery}
Return JSON with: artist, artistDisplay, title, titleDisplay, album, releaseYear, genre, albumCover URL, songwriters, duration`
              }
            ],
            temperature: 0.1,
            max_tokens: 800
          })
        });
        
        if (!fallbackResponse.ok) {
          timer.fail(`Perplexity HTTP ${fallbackResponse.status}`);
          throw new Error('Perplexity API failed');
        }
        
        const fallbackData = await fallbackResponse.json();
        const fallbackContent = fallbackData.choices?.[0]?.message?.content || '';
        
        try {
          // Try to parse JSON from response
          const jsonMatch = fallbackContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const metadata = JSON.parse(jsonMatch[0]);
            
            // If no album cover from Perplexity, try iTunes
            if (!metadata.albumCover && (metadata.artist || artist) && (metadata.title || title)) {
              metadata.albumCover = await fetchItunesAlbumCover(
                metadata.artist || artist,
                metadata.title || title
              );
            }
            
            timer.success('Metadata fetched (fallback)');
            return NextResponse.json({
              success: true,
              metadata,
              source: 'perplexity-fallback'
            });
          }
        } catch (parseError) {
          logger.error('Failed to parse fallback metadata:', parseError);
        }
      }
      
      timer.fail(`Perplexity HTTP ${perplexityResponse.status}`);
      throw new Error('Perplexity API failed');
    }
    
    const perplexityData = await perplexityResponse.json();
    const content = perplexityData.choices?.[0]?.message?.content || '';
    
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const metadata = JSON.parse(jsonMatch[0]);
      
      // Validate and clean metadata
      const cleanedMetadata = {
        artist: metadata.artist || artist || '',
        artistDisplay: metadata.artistDisplay || metadata.artist || artist || '',
        title: metadata.title || title || '',
        titleDisplay: metadata.titleDisplay || metadata.title || title || '',
        album: metadata.album || '',
        releaseYear: metadata.releaseYear || '',
        genre: metadata.genre || '',
        albumCover: metadata.albumCover || '',
        songwriters: metadata.songwriters || '',
        duration: metadata.duration || ''
      };
      
      // If no album cover from Perplexity, try iTunes as fallback
      if (!cleanedMetadata.albumCover && cleanedMetadata.artist && cleanedMetadata.title) {
        logger.info('No album cover from Perplexity, trying iTunes...');
        cleanedMetadata.albumCover = await fetchItunesAlbumCover(
          cleanedMetadata.artist,
          cleanedMetadata.title
        );
      }
      
      timer.success(`Metadata fetched successfully`);
      logger.info(`✅ Metadata: ${cleanedMetadata.artistDisplay} - ${cleanedMetadata.titleDisplay}`);
      
      return NextResponse.json({
        success: true,
        metadata: cleanedMetadata,
        source: 'perplexity'
      });
      
    } catch (parseError) {
      logger.error('Failed to parse metadata JSON:', parseError);
      
      // Fallback to basic parsing
      const basicMetadata = {
        artist: artist || extractFromText(content, 'artist') || '',
        artistDisplay: artist || extractFromText(content, 'artist') || '',
        title: title || extractFromText(content, 'title') || '',
        titleDisplay: title || extractFromText(content, 'title') || '',
        album: extractFromText(content, 'album') || '',
        releaseYear: extractFromText(content, 'year') || extractFromText(content, 'release') || '',
        genre: extractFromText(content, 'genre') || '',
        albumCover: '',
        songwriters: extractFromText(content, 'writer') || extractFromText(content, 'composer') || '',
        duration: extractFromText(content, 'duration') || extractFromText(content, 'length') || ''
      };
      
      // Try iTunes for album cover
      if (basicMetadata.artist && basicMetadata.title) {
        basicMetadata.albumCover = await fetchItunesAlbumCover(
          basicMetadata.artist,
          basicMetadata.title
        );
      }
      
      timer.success('Basic metadata extracted');
      return NextResponse.json({
        success: true,
        metadata: basicMetadata,
        source: 'perplexity-basic'
      });
    }
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Metadata fetch error:', error);
    
    // Last resort: return basic info from input
    const fallbackMetadata = {
      artist: request.artist || '',
      artistDisplay: request.artist || '',
      title: request.title || '',
      titleDisplay: request.title || '',
      album: '',
      releaseYear: '',
      genre: '',
      albumCover: '',
      songwriters: '',
      duration: ''
    };
    
    return NextResponse.json({
      success: false,
      metadata: fallbackMetadata,
      error: error instanceof Error ? error.message : 'Failed to fetch metadata'
    });
  }
}

// Helper function to fetch album cover from iTunes
async function fetchItunesAlbumCover(artist: string, title: string): Promise<string> {
  try {
    const searchTerm = encodeURIComponent(`${artist} ${title}`);
    const itunesUrl = `https://itunes.apple.com/search?term=${searchTerm}&entity=song&limit=1`;
    
    const response = await fetch(itunesUrl);
    if (!response.ok) return '';
    
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      // Get high quality artwork (600x600)
      const artworkUrl = result.artworkUrl100?.replace('100x100', '600x600') || 
                         result.artworkUrl60?.replace('60x60', '600x600') || 
                         result.artworkUrl30?.replace('30x30', '600x600') || '';
      return artworkUrl;
    }
    
    return '';
  } catch (error) {
    logger.error('iTunes album cover fetch failed:', error);
    return '';
  }
}

// Helper function to extract value from text
function extractFromText(text: string, key: string): string {
  const patterns = [
    new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i'),
    new RegExp(`${key}\\s*:\\s*([^,\\n]+)`, 'i'),
    new RegExp(`${key}\\s*=\\s*([^,\\n]+)`, 'i')
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return '';
}