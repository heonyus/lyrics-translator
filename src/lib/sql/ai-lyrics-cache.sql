-- AI 가사 캐시 테이블
CREATE TABLE IF NOT EXISTS ai_lyrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist TEXT NOT NULL,
  title TEXT NOT NULL,
  lyrics TEXT NOT NULL,
  lrc_format TEXT,
  source TEXT NOT NULL, -- 'Perplexity', 'GPT-4', 'Tavily', etc
  confidence FLOAT,
  search_time FLOAT,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  
  -- 아티스트와 제목으로 유니크 제약
  UNIQUE(artist, title)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_ai_cache_artist_title ON ai_lyrics_cache(artist, title);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_lyrics_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_source ON ai_lyrics_cache(source);

-- 만료된 캐시 자동 삭제 (선택사항)
-- 이 함수는 cron job이나 trigger로 주기적으로 실행 가능
CREATE OR REPLACE FUNCTION clean_expired_ai_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_lyrics_cache 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- RLS 정책 설정 (ai_lyrics_cache)
ALTER TABLE ai_lyrics_cache ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 읽기 허용
CREATE POLICY "Allow public read ai_cache" ON ai_lyrics_cache
  FOR SELECT USING (true);

-- 모든 사용자 쓰기 허용
CREATE POLICY "Allow public insert ai_cache" ON ai_lyrics_cache
  FOR INSERT WITH CHECK (true);

-- 모든 사용자 업데이트 허용
CREATE POLICY "Allow public update ai_cache" ON ai_lyrics_cache
  FOR UPDATE USING (true);

-- song_patterns 테이블 (학습 기반 타이밍)
CREATE TABLE IF NOT EXISTS song_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id TEXT NOT NULL UNIQUE, -- artist_title 형식
  mr_url TEXT,
  line_timings FLOAT[],
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_song_patterns_song_id ON song_patterns(song_id);

-- favorite_songs 테이블 (즐겨찾기)
CREATE TABLE IF NOT EXISTS favorite_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist TEXT NOT NULL,
  title TEXT NOT NULL,
  lyrics_id UUID REFERENCES lyrics(id) ON DELETE SET NULL,
  ai_cache_id UUID REFERENCES ai_lyrics_cache(id) ON DELETE SET NULL,
  metadata JSONB,
  play_count INTEGER DEFAULT 0,
  last_played TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(artist, title)
);

CREATE INDEX IF NOT EXISTS idx_favorite_songs_artist_title ON favorite_songs(artist, title);
CREATE INDEX IF NOT EXISTS idx_favorite_songs_play_count ON favorite_songs(play_count DESC);