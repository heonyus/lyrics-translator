import { supabase } from '@/lib/supabase';

interface AISearchResult {
  lyrics: string;
  lrcFormat?: string;
  source: 'Perplexity' | 'GPT-4' | 'Tavily' | 'Cache';
  confidence: number;  // 0-1
  searchTime: number;  // seconds
  autoAccepted: boolean;
  title?: string;
  artist?: string;
}

export class AILyricsService {
  private perplexityApiKey: string;
  private tavilyApiKey: string; 
  private openaiApiKey: string;

  constructor() {
    // 클라이언트 사이드에서도 작동하도록
    this.perplexityApiKey = process.env.perplexity_api_key || 
                           process.env.NEXT_PUBLIC_PERPLEXITY_API_KEY ||
                           '';
    this.tavilyApiKey = process.env.tavily_api_key || 
                       process.env.NEXT_PUBLIC_TAVILY_API_KEY ||
                       '';
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
  }

  /**
   * 통합 가사 검색 (캐시 → Perplexity → GPT-4 → Tavily)
   */
  async searchLyrics(artist: string, title: string): Promise<AISearchResult | null> {
    console.log(`🎵 AI 가사 검색 시작: ${artist} - ${title}`);
    const startTime = Date.now();

    // 1. 캐시 확인
    const cached = await this.checkCache(artist, title);
    if (cached) {
      console.log('✅ 캐시에서 발견');
      return {
        ...cached,
        source: 'Cache' as const,
        searchTime: (Date.now() - startTime) / 1000,
        autoAccepted: true
      };
    }

    // 2. Perplexity 검색
    try {
      console.log('🔍 Perplexity 검색 중...');
      const perplexityResult = await this.searchWithPerplexity(artist, title);
      if (perplexityResult && this.isPerplexitySuccess(perplexityResult)) {
        const lyrics = this.extractLyricsFromPerplexity(perplexityResult);
        const confidence = this.calculateConfidence(lyrics, artist, title);
        
        console.log(`Perplexity 신뢰도: ${(confidence * 100).toFixed(0)}%`);
        
        if (confidence > 0.5) {
          const result: AISearchResult = {
            lyrics,
            source: 'Perplexity',
            confidence,
            searchTime: (Date.now() - startTime) / 1000,
            autoAccepted: confidence > 0.7,
            title,
            artist
          };
          
          // 캐시 저장
          await this.saveToCache(result);
          return result;
        }
      }
    } catch (error) {
      console.error('Perplexity 검색 실패:', error);
    }

    // 3. GPT-4 검색
    try {
      console.log('🤖 GPT-4 검색 중...');
      const gptResult = await this.searchWithGPT(artist, title);
      if (gptResult && this.isGPTSuccess(gptResult)) {
        const lyrics = this.extractLyricsFromGPT(gptResult);
        const confidence = this.calculateConfidence(lyrics, artist, title);
        
        console.log(`GPT-4 신뢰도: ${(confidence * 100).toFixed(0)}%`);
        
        if (confidence > 0.5) {
          const result: AISearchResult = {
            lyrics,
            source: 'GPT-4',
            confidence,
            searchTime: (Date.now() - startTime) / 1000,
            autoAccepted: confidence > 0.7,
            title,
            artist
          };
          
          await this.saveToCache(result);
          return result;
        }
      }
    } catch (error) {
      console.error('GPT-4 검색 실패:', error);
    }

    // 4. Tavily 검색
    try {
      console.log('🌐 Tavily 검색 중...');
      const tavilyResult = await this.searchWithTavily(artist, title);
      if (tavilyResult && this.isTavilySuccess(tavilyResult)) {
        const lyrics = this.extractLyricsFromTavily(tavilyResult);
        const confidence = this.calculateConfidence(lyrics, artist, title);
        
        console.log(`Tavily 신뢰도: ${(confidence * 100).toFixed(0)}%`);
        
        if (confidence > 0.3) {  // Tavily는 낮은 임계값
          const result: AISearchResult = {
            lyrics,
            source: 'Tavily',
            confidence,
            searchTime: (Date.now() - startTime) / 1000,
            autoAccepted: confidence > 0.6,
            title,
            artist
          };
          
          await this.saveToCache(result);
          return result;
        }
      }
    } catch (error) {
      console.error('Tavily 검색 실패:', error);
    }

    console.log('❌ 모든 검색 실패');
    return null;
  }

  /**
   * Perplexity API 검색
   */
  private async searchWithPerplexity(artist: string, title: string): Promise<any> {
    // 한글 아티스트 변환 매핑
    const artistMapping: { [key: string]: string } = {
      '샘킴': 'Sam Kim',
      '아이유': 'IU',
      '방탄소년단': 'BTS',
      '블랙핑크': 'BLACKPINK',
      '뉴진스': 'NewJeans',
      '세븐틴': 'SEVENTEEN'
    };
    
    const searchArtist = artistMapping[artist] || artist;
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.perplexityApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-medium-online',
        messages: [
          {
            role: 'system',
            content: '당신은 정확한 가사를 찾아주는 전문가입니다. 가사를 찾아서 전체 텍스트를 그대로 제공해주세요. 각 절과 후렴구를 구분하여 표시해주세요. 한국 가수의 경우 한글명과 영문명을 모두 고려해주세요.'
          },
          {
            role: 'user',
            content: `"${searchArtist}" (${artist})의 "${title}" 노래 가사 전체를 찾아주세요. 정확한 원본 가사를 그대로 제공해주세요.`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * GPT-4 검색
   */
  private async searchWithGPT(artist: string, title: string): Promise<any> {
    // 한글 아티스트 변환 매핑
    const artistMapping: { [key: string]: string } = {
      '샘킴': 'Sam Kim',
      '아이유': 'IU', 
      '방탄소년단': 'BTS',
      '블랙핑크': 'BLACKPINK',
      '뉴진스': 'NewJeans',
      '세븐틴': 'SEVENTEEN'
    };
    
    const searchArtist = artistMapping[artist] || artist;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: '당신은 음악 가사 데이터베이스입니다. 정확한 가사를 제공하거나, 가사를 찾을 수 없는 경우 "가사를 찾을 수 없습니다"라고 답하세요. 한국 가수의 경우 한글명과 영문명을 모두 알고 있습니다.'
          },
          {
            role: 'user',
            content: `${searchArtist} (한글명: ${artist})의 "${title}" 가사를 알려주세요. 전체 가사를 정확하게 제공해주세요.`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Tavily API 검색
   */
  private async searchWithTavily(artist: string, title: string): Promise<any> {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: this.tavilyApiKey,
        query: `${artist} ${title} 가사 lyrics full text complete`,
        search_depth: 'advanced',
        include_domains: [
          'genius.com',
          'azlyrics.com',
          'lyrics.com',
          'melon.com',
          'genie.co.kr',
          'bugs.co.kr',
          'vibe.naver.com'
        ],
        max_results: 10
      })
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 신뢰도 계산
   */
  private calculateConfidence(lyrics: string, artist: string, title: string): number {
    if (!lyrics) return 0;
    
    let score = 0;
    
    // 1. 길이 체크 (100-5000자가 정상)
    if (lyrics.length > 100 && lyrics.length < 5000) {
      score += 0.2;
    } else if (lyrics.length > 50) {
      score += 0.1;
    }
    
    // 2. 구조 체크 (줄바꿈, 절/후렴 패턴)
    const lines = lyrics.split('\n').filter(l => l.trim());
    if (lines.length > 10 && lines.length < 100) {
      score += 0.2;
    } else if (lines.length > 5) {
      score += 0.1;
    }
    
    // 3. 반복 패턴 (후렴구)
    const hasChorus = /(\[.*?(후렴|Chorus|Hook|Refrain).*?\])|((같은|동일한)\s*(구절|가사)|반복)/i.test(lyrics);
    if (hasChorus) score += 0.1;
    
    // 4. 언어 일치 (한글 아티스트 → 한글 가사)
    const isKoreanArtist = /[가-힣]/.test(artist);
    const hasKoreanLyrics = /[가-힣]/.test(lyrics);
    const isEnglishArtist = /^[a-zA-Z\s]+$/.test(artist);
    const hasEnglishLyrics = /[a-zA-Z]/.test(lyrics);
    
    if (isKoreanArtist && hasKoreanLyrics) {
      score += 0.2;
    } else if (isEnglishArtist && hasEnglishLyrics && !hasKoreanLyrics) {
      score += 0.2;
    } else if (hasKoreanLyrics || hasEnglishLyrics) {
      score += 0.1;
    }
    
    // 5. 제목 포함 여부 (제목이 가사에 포함되는 경우가 많음)
    const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const lyricsLower = lyrics.toLowerCase();
    const titleMatchCount = titleWords.filter(word => 
      lyricsLower.includes(word)
    ).length;
    
    if (titleMatchCount > 0) {
      score += Math.min(0.3, titleMatchCount * 0.1);
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * 성공 판단 - Perplexity
   */
  private isPerplexitySuccess(response: any): boolean {
    if (!response?.choices?.[0]?.message?.content) return false;
    
    const content = response.choices[0].message.content;
    
    // 실패 키워드 체크
    const failureKeywords = [
      '찾을 수 없습니다',
      '정보가 없습니다',
      'I cannot find',
      'No lyrics found',
      'I don\'t have access',
      '죄송합니다',
      'I apologize'
    ];
    
    if (failureKeywords.some(keyword => content.toLowerCase().includes(keyword.toLowerCase()))) {
      return false;
    }
    
    // 최소 길이 체크
    if (content.length < 100) return false;
    
    // 줄바꿈 체크
    const lineBreaks = (content.match(/\n/g) || []).length;
    if (lineBreaks < 3) return false;
    
    return true;
  }

  /**
   * 성공 판단 - GPT
   */
  private isGPTSuccess(response: any): boolean {
    if (!response?.choices?.[0]?.message?.content) return false;
    
    const content = response.choices[0].message.content;
    
    // 실패/생성 키워드 체크
    const failureKeywords = [
      '찾을 수 없습니다',
      '만들어드릴게요',
      '생성해드리겠습니다',
      'I cannot provide',
      'I don\'t have',
      '죄송합니다',
      '제가 만든'
    ];
    
    if (failureKeywords.some(keyword => content.toLowerCase().includes(keyword.toLowerCase()))) {
      return false;
    }
    
    return content.length > 100;
  }

  /**
   * 성공 판단 - Tavily
   */
  private isTavilySuccess(response: any): boolean {
    return response?.results?.some((r: any) => 
      r.content && r.content.length > 100
    );
  }

  /**
   * 가사 추출 - Perplexity
   */
  private extractLyricsFromPerplexity(response: any): string {
    return response.choices[0].message.content.trim();
  }

  /**
   * 가사 추출 - GPT
   */
  private extractLyricsFromGPT(response: any): string {
    return response.choices[0].message.content.trim();
  }

  /**
   * 가사 추출 - Tavily
   */
  private extractLyricsFromTavily(response: any): string {
    // 모든 결과를 합쳐서 가장 긴 연속된 텍스트 찾기
    const allContent = response.results
      .map((r: any) => r.content)
      .join('\n\n');
    
    // HTML 태그 제거
    let cleaned = allContent.replace(/<[^>]*>/g, '');
    cleaned = cleaned.replace(/&quot;/g, '"');
    cleaned = cleaned.replace(/&amp;/g, '&');
    cleaned = cleaned.replace(/&lt;/g, '<');
    cleaned = cleaned.replace(/&gt;/g, '>');
    cleaned = cleaned.replace(/&nbsp;/g, ' ');
    
    // 가사 부분만 추출 (연속된 줄바꿈이 있는 부분)
    const sections = cleaned.split(/\n{3,}/);
    const lyricSection = sections
      .filter(s => s.split('\n').length > 5)
      .sort((a, b) => b.length - a.length)[0];
    
    return lyricSection || cleaned;
  }

  /**
   * 캐시 확인
   */
  private async checkCache(artist: string, title: string): Promise<AISearchResult | null> {
    try {
      const { data } = await supabase
        .from('ai_lyrics_cache')
        .select('*')
        .eq('artist', artist)
        .eq('title', title)
        .single();
      
      if (data && data.expires_at > new Date().toISOString()) {
        // 히트 카운트 증가
        await supabase
          .from('ai_lyrics_cache')
          .update({ hit_count: data.hit_count + 1 })
          .eq('id', data.id);
        
        return {
          lyrics: data.lyrics,
          lrcFormat: data.lrc_format,
          source: data.source,
          confidence: data.confidence,
          searchTime: 0,
          autoAccepted: true,
          title: data.title,
          artist: data.artist
        };
      }
    } catch (error) {
      // 캐시 미스는 정상적인 상황
    }
    
    return null;
  }

  /**
   * 캐시 저장
   */
  private async saveToCache(result: AISearchResult): Promise<void> {
    try {
      await supabase
        .from('ai_lyrics_cache')
        .upsert({
          artist: result.artist,
          title: result.title,
          lyrics: result.lyrics,
          lrc_format: result.lrcFormat,
          source: result.source,
          confidence: result.confidence,
          search_time: result.searchTime,
          hit_count: 0,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }, {
          onConflict: 'artist,title'
        });
    } catch (error) {
      console.error('캐시 저장 실패:', error);
    }
  }

  /**
   * LRC 형식으로 변환
   */
  convertToLRC(lyrics: string, title: string, artist: string): string {
    const lines = lyrics.split('\n').filter(line => line.trim());
    const header = [
      `[ti:${title}]`,
      `[ar:${artist}]`,
      '[by:AI Lyrics Service]',
      ''
    ].join('\n');
    
    // 각 라인에 기본 타이밍 추가 (3초 간격)
    const lrcLines = lines.map((line, index) => {
      const seconds = index * 3;
      const minutes = Math.floor(seconds / 60);
      const secs = (seconds % 60).toFixed(2).padStart(5, '0');
      return `[${minutes.toString().padStart(2, '0')}:${secs}]${line}`;
    });
    
    return header + lrcLines.join('\n');
  }
}