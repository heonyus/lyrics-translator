-- AI 가사 캐시 테이블
CREATE TABLE IF NOT EXISTS ai_lyrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist TEXT NOT NULL,
  title TEXT NOT NULL,
  lyrics TEXT NOT NULL,
  lrc_format TEXT,
  source TEXT NOT NULL,
  confidence FLOAT,
  search_time FLOAT,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  UNIQUE(artist, title)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_ai_cache_artist_title ON ai_lyrics_cache(artist, title);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_lyrics_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_source ON ai_lyrics_cache(source);

-- song_patterns 테이블 (학습 기반 타이밍)
CREATE TABLE IF NOT EXISTS song_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id TEXT NOT NULL UNIQUE,
  mr_url TEXT,
  line_timings FLOAT[],
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_song_patterns_song_id ON song_patterns(song_id);