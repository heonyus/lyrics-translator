import { Genius } from 'genius-lyrics';
import lyricsFinder from 'lyrics-finder';
import { AILyricsService } from './ai-lyrics-service';

interface LyricsSearchResult {
  source: string;
  title: string;
  artist: string;
  lyrics: string;
  lrcFormat?: string;
  confidence: number;
}

export class LyricsSearchService {
  private geniusClient: any;
  private aiService: AILyricsService;
  
  constructor() {
    // Genius client 초기화 (API 키 없이도 작동)
    this.geniusClient = new Genius();
    // AI 서비스 초기화
    this.aiService = new AILyricsService();
  }

  /**
   * 여러 소스에서 가사 검색
   */
  async searchLyrics(artist: string, title: string): Promise<LyricsSearchResult | null> {
    console.log(`🔍 Searching lyrics for: ${artist} - ${title}`);
    
    // 0. AI 검색 우선 시도 (Perplexity → GPT-4 → Tavily)
    try {
      const aiResult = await this.aiService.searchLyrics(artist, title);
      if (aiResult) {
        console.log(`✅ AI 검색 성공: ${aiResult.source} (신뢰도: ${(aiResult.confidence * 100).toFixed(0)}%)`);
        return {
          source: `AI-${aiResult.source}`,
          title: aiResult.title || title,
          artist: aiResult.artist || artist,
          lyrics: aiResult.lyrics,
          lrcFormat: aiResult.lrcFormat,
          confidence: aiResult.confidence
        };
      }
    } catch (error) {
      console.error('AI 검색 오류:', error);
    }
    
    // 1. LRClib API 시도 (AI 실패시 폴백)
    const lrcResult = await this.searchLRClib(artist, title);
    if (lrcResult) return lrcResult;
    
    // 2. Genius 시도
    const geniusResult = await this.searchGenius(artist, title);
    if (geniusResult) return geniusResult;
    
    // 3. lyrics-finder (여러 소스 통합)
    const finderResult = await this.searchLyricsFinder(artist, title);
    if (finderResult) return finderResult;
    
    // 4. 웹 스크래핑 폴백
    const scrapedResult = await this.searchWebScraping(artist, title);
    if (scrapedResult) return scrapedResult;
    
    return null;
  }

  /**
   * LRClib에서 검색 (타이밍 포함)
   */
  private async searchLRClib(artist: string, title: string): Promise<LyricsSearchResult | null> {
    try {
      const response = await fetch('/api/lrclib/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      });
      
      if (!response.ok) return null;
      
      const { success, data } = await response.json();
      if (!success || !data || data.length === 0) return null;
      
      const bestMatch = data[0];
      
      // LRC 형식 가사 가져오기
      if (bestMatch.id) {
        const lrcResponse = await fetch(`/api/lrclib/search?id=${bestMatch.id}`);
        if (lrcResponse.ok) {
          const lrcData = await lrcResponse.json();
          if (lrcData.success && lrcData.data) {
            return {
              source: 'LRClib',
              title: bestMatch.trackName || title,
              artist: bestMatch.artistName || artist,
              lyrics: lrcData.data.plainLyrics || '',
              lrcFormat: lrcData.data.syncedLyrics,
              confidence: 0.95
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('LRClib search error:', error);
      return null;
    }
  }

  /**
   * Genius에서 검색
   */
  private async searchGenius(artist: string, title: string): Promise<LyricsSearchResult | null> {
    try {
      const searches = await this.geniusClient.songs.search(`${artist} ${title}`);
      
      if (!searches || searches.length === 0) return null;
      
      const song = searches[0];
      const lyrics = await song.lyrics();
      
      if (!lyrics) return null;
      
      return {
        source: 'Genius',
        title: song.title || title,
        artist: song.artist?.name || artist,
        lyrics: lyrics,
        confidence: 0.85
      };
    } catch (error) {
      console.error('Genius search error:', error);
      return null;
    }
  }

  /**
   * lyrics-finder로 검색 (여러 소스 통합)
   */
  private async searchLyricsFinder(artist: string, title: string): Promise<LyricsSearchResult | null> {
    try {
      const lyrics = await lyricsFinder(artist, title);
      
      if (!lyrics) return null;
      
      return {
        source: 'LyricsFinder',
        title: title,
        artist: artist,
        lyrics: lyrics,
        confidence: 0.75
      };
    } catch (error) {
      console.error('LyricsFinder search error:', error);
      return null;
    }
  }

  /**
   * 웹 스크래핑 폴백 (AZLyrics 등)
   */
  private async searchWebScraping(artist: string, title: string): Promise<LyricsSearchResult | null> {
    try {
      // Google 검색으로 가사 페이지 찾기
      const searchQuery = `${artist} ${title} lyrics site:azlyrics.com OR site:lyrics.com`;
      
      // 서버사이드 API로 처리
      const response = await fetch('/api/lyrics/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title, query: searchQuery })
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.success && data.lyrics) {
        return {
          source: 'WebScraping',
          title: data.title || title,
          artist: data.artist || artist,
          lyrics: data.lyrics,
          confidence: 0.65
        };
      }
      
      return null;
    } catch (error) {
      console.error('Web scraping error:', error);
      return null;
    }
  }

  /**
   * 한글 가사를 위한 특별 검색
   */
  async searchKoreanLyrics(artist: string, title: string): Promise<LyricsSearchResult | null> {
    // 한글 제목/아티스트 변환
    const queries = [
      { artist, title },
      { artist: this.romanizeKorean(artist), title: this.romanizeKorean(title) },
      { artist: this.translateToEnglish(artist), title: this.translateToEnglish(title) }
    ];
    
    for (const query of queries) {
      const result = await this.searchLyrics(query.artist, query.title);
      if (result) return result;
    }
    
    return null;
  }

  /**
   * 한글 로마자 변환 (간단한 구현)
   */
  private romanizeKorean(text: string): string {
    // 실제로는 더 복잡한 변환 필요
    const romanization: { [key: string]: string } = {
      '아이유': 'IU',
      '방탄소년단': 'BTS',
      '블랙핑크': 'BLACKPINK',
      '좋은날': 'Good Day',
      // ... 더 많은 매핑
    };
    
    return romanization[text] || text;
  }

  /**
   * 영어로 번역 (간단한 구현)
   */
  private translateToEnglish(text: string): string {
    // 실제로는 번역 API 사용
    const translations: { [key: string]: string } = {
      '아이유': 'IU',
      '좋은날': 'Good Day',
      // ... 더 많은 매핑
    };
    
    return translations[text] || text;
  }

  /**
   * 가사를 LRC 형식으로 변환 (타이밍 없이)
   */
  convertToSimpleLRC(lyrics: string, title: string, artist: string): string {
    const lines = lyrics.split('\n').filter(line => line.trim());
    const header = [
      `[ti:${title}]`,
      `[ar:${artist}]`,
      '[by:LyricsSearchService]',
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