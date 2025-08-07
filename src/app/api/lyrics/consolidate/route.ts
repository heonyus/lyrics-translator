import { NextRequest, NextResponse } from 'next/server';
import { logger, APITimer } from '@/lib/logger';

interface LyricsResult {
  source: string;
  lyrics: string;
  confidence: number;
  language?: string;
}

// Consolidate with Claude
async function consolidateWithClaude(
  referenceResult: LyricsResult,
  fullResults: LyricsResult[]
): Promise<string | null> {
  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  if (!CLAUDE_API_KEY) return null;
  
  const timer = new APITimer('Claude Consolidate');
  
  try {
    const prompt = `You are a lyrics verification expert. 

Reference lyrics (from ${referenceResult.source}, partial but accurate):
"""
${referenceResult.lyrics}
"""

Full lyrics candidates:
${fullResults.map((r, i) => `
Source ${i + 1} (${r.source}):
"""
${r.lyrics}
"""
`).join('\n')}

Task:
1. Check if the reference lyrics match parts of the full candidates
2. Select the most complete and accurate version
3. Fix any typos or errors
4. Return ONLY the corrected, complete lyrics (no explanations)`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const lyrics = data.content?.[0]?.text || '';
      if (lyrics) {
        timer.success('Consolidated successfully');
        return lyrics;
      }
    }
    
    timer.fail('Failed to consolidate');
    return null;
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Consolidate with GPT
async function consolidateWithGPT(
  referenceResult: LyricsResult,
  fullResults: LyricsResult[]
): Promise<string | null> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return null;
  
  const timer = new APITimer('GPT Consolidate');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a lyrics expert. Return only the complete, corrected lyrics without any explanations.'
          },
          {
            role: 'user',
            content: `Reference (partial but accurate from ${referenceResult.source}):
${referenceResult.lyrics}

Full versions to verify:
${fullResults.map(r => `[${r.source}]\n${r.lyrics}`).join('\n\n')}

Return the most complete and accurate version, fixing any errors.`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const lyrics = data.choices?.[0]?.message?.content || '';
      if (lyrics) {
        timer.success('Consolidated successfully');
        return lyrics;
      }
    }
    
    timer.fail('Failed to consolidate');
    return null;
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Consolidate with Groq
async function consolidateWithGroq(
  referenceResult: LyricsResult,
  fullResults: LyricsResult[]
): Promise<string | null> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return null;
  
  const timer = new APITimer('Groq Consolidate');
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Compare lyrics and return the most accurate, complete version. Output only the lyrics, no explanations.'
          },
          {
            role: 'user',
            content: `Reference (${referenceResult.source}): ${referenceResult.lyrics}

Full versions:
${fullResults.map(r => `${r.source}: ${r.lyrics}`).join('\n\n')}

Output the best complete version:`
          }
        ],
        temperature: 0.1,
        max_tokens: 8000
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const lyrics = data.choices?.[0]?.message?.content || '';
      if (lyrics) {
        timer.success('Consolidated successfully');
        return lyrics;
      }
    }
    
    timer.fail('Failed to consolidate');
    return null;
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Main handler
export async function POST(request: NextRequest) {
  const timer = new APITimer('Consolidate Lyrics');
  
  try {
    const { results, artist, title } = await request.json();
    
    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No results to consolidate' },
        { status: 400 }
      );
    }
    
    logger.info(`🔀 Consolidating ${results.length} results for "${artist} - ${title}"`);
    
    // Find Perplexity result (reference for accuracy)
    const perplexityResult = results.find(r => 
      r.source === 'perplexity' && r.lyrics && r.lyrics.length > 500
    );
    
    // Find full lyrics (2000+ chars)
    const fullResults = results.filter(r => 
      r.lyrics && r.lyrics.length > 2000 && r.source !== 'perplexity'
    ).sort((a, b) => {
      // Prioritize Korean sources for Korean songs
      const koreanSources = ['search-engine-naver', 'bugs', 'melon', 'genie'];
      const aKorean = koreanSources.includes(a.source);
      const bKorean = koreanSources.includes(b.source);
      if (aKorean !== bKorean) return aKorean ? -1 : 1;
      
      // Then by confidence
      return (b.confidence || 0) - (a.confidence || 0);
    }).slice(0, 3); // Top 3 full results
    
    // Strategy 1: If we have Perplexity + full results, use them for verification
    if (perplexityResult && fullResults.length > 0) {
      logger.info('📊 Strategy: Perplexity reference + full verification');
      
      // Try consolidation with multiple LLMs
      const consolidations = await Promise.allSettled([
        consolidateWithGroq(perplexityResult, fullResults),
        consolidateWithClaude(perplexityResult, fullResults),
        consolidateWithGPT(perplexityResult, fullResults)
      ]);
      
      // Get first successful result
      for (const result of consolidations) {
        if (result.status === 'fulfilled' && result.value) {
          timer.success('Consolidated with Perplexity reference');
          return NextResponse.json({
            success: true,
            lyrics: result.value,
            source: 'consolidated-perplexity',
            confidence: 0.95,
            strategy: 'perplexity-reference',
            artist,
            title
          });
        }
      }
    }
    
    // Strategy 2: If no Perplexity, use highest confidence as reference
    if (fullResults.length >= 2) {
      logger.info('📊 Strategy: Cross-verification without Perplexity');
      
      const referenceResult = fullResults[0];
      const otherResults = fullResults.slice(1);
      
      const consolidations = await Promise.allSettled([
        consolidateWithGroq(referenceResult, otherResults),
        consolidateWithClaude(referenceResult, otherResults),
        consolidateWithGPT(referenceResult, otherResults)
      ]);
      
      for (const result of consolidations) {
        if (result.status === 'fulfilled' && result.value) {
          timer.success('Consolidated without Perplexity');
          return NextResponse.json({
            success: true,
            lyrics: result.value,
            source: 'consolidated-cross',
            confidence: 0.9,
            strategy: 'cross-verification',
            artist,
            title
          });
        }
      }
    }
    
    // Strategy 3: Return best available result
    const bestResult = results
      .filter(r => r.lyrics && r.lyrics.length > 100)
      .sort((a, b) => {
        // Sort by length and confidence
        const aScore = (a.lyrics?.length || 0) * (a.confidence || 0.5);
        const bScore = (b.lyrics?.length || 0) * (b.confidence || 0.5);
        return bScore - aScore;
      })[0];
    
    if (bestResult) {
      timer.success('Returning best available');
      return NextResponse.json({
        success: true,
        lyrics: bestResult.lyrics,
        source: `consolidated-${bestResult.source}`,
        confidence: bestResult.confidence || 0.7,
        strategy: 'best-available',
        artist,
        title
      });
    }
    
    timer.fail('No valid results to consolidate');
    return NextResponse.json(
      { success: false, error: 'Could not consolidate lyrics' },
      { status: 400 }
    );
    
  } catch (error) {
    timer.fail(error instanceof Error ? error.message : 'Unknown error');
    logger.error('Consolidate error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Consolidation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}