// Client-safe version of lyrics search service
// genius-lyrics와 lyrics-finder는 서버사이드에서만 작동하므로 제외

interface LyricsSearchResult {
  source: string;
  title: string;
  artist: string;
  lyrics: string;
  lrcFormat?: string;
  confidence: number;
}

export class LyricsSearchServiceClient {
  /**
   * 여러 소스에서 가사 검색 (클라이언트 안전 버전)
   */
  async searchLyrics(artist: string, title: string): Promise<LyricsSearchResult | null> {
    console.log(`🔍 Searching lyrics for: ${artist} - ${title}`);
    
    // AI 검색 API 호출 (서버사이드)
    try {
      const response = await fetch('/api/lyrics/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      });
      
      if (response.ok) {
        const { success, data } = await response.json();
        if (success && data) {
          console.log(`✅ Found lyrics via ${data.source}`);
          return {
            source: data.source,
            title: data.title,
            artist: data.artist,
            lyrics: data.lyrics,
            lrcFormat: data.lrcFormat,
            confidence: data.confidence || 0.5
          };
        }
      }
    } catch (error) {
      console.error('AI search error:', error);
    }
    
    // LRClib API 시도
    const lrcResult = await this.searchLRClib(artist, title);
    if (lrcResult) return lrcResult;
    
    // 웹 스크래핑 시도
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
   * 웹 스크래핑 폴백
   */
  private async searchWebScraping(artist: string, title: string): Promise<LyricsSearchResult | null> {
    try {
      const response = await fetch('/api/lyrics/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
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
      { artist: this.romanizeKorean(artist), title: this.romanizeKorean(title) }
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
    const romanization: { [key: string]: string } = {
      '아이유': 'IU',
      '방탄소년단': 'BTS',
      '블랙핑크': 'BLACKPINK',
      '샘킴': 'Sam Kim',
      '뉴진스': 'NewJeans',
      '세븐틴': 'SEVENTEEN',
      '좋은날': 'Good Day',
      '메이크업': 'Make Up'
    };
    
    return romanization[text] || text;
  }

  /**
   * 가사를 LRC 형식으로 변환
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