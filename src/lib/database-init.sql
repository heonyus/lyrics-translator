-- Supabase 테이블 생성 스크립트
-- 이 SQL을 Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. AI 가사 캐시 테이블
CREATE TABLE IF NOT EXISTS ai_lyrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist TEXT NOT NULL,
  title TEXT NOT NULL,
  lyrics TEXT NOT NULL,
  lrc_format TEXT,
  source TEXT NOT NULL,
  confidence FLOAT NOT NULL DEFAULT 0,
  search_time FLOAT,
  hit_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(artist, title)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_ai_lyrics_artist_title ON ai_lyrics_cache(artist, title);
CREATE INDEX IF NOT EXISTS idx_ai_lyrics_expires ON ai_lyrics_cache(expires_at);

-- 2. 노래 패턴 테이블 (학습 모드용)
CREATE TABLE IF NOT EXISTS song_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  pattern_data JSONB NOT NULL,
  learning_count INTEGER DEFAULT 1,
  avg_duration FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(artist, title)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_song_patterns_artist_title ON song_patterns(artist, title);

-- 3. 가사 테이블 (기본)
CREATE TABLE IF NOT EXISTS lyrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  lrc_content TEXT NOT NULL,
  lines JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_lyrics_artist_title ON lyrics(artist, title);

-- 4. 번역 테이블
CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lyrics_id UUID REFERENCES lyrics(id) ON DELETE CASCADE,
  line_index INTEGER NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  target_language TEXT NOT NULL,
  timestamp FLOAT,
  duration FLOAT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lyrics_id, line_index, target_language)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_translations_lyrics_id ON translations(lyrics_id);
CREATE INDEX IF NOT EXISTS idx_translations_unique ON translations(lyrics_id, line_index, target_language);

-- 5. RLS (Row Level Security) 활성화
ALTER TABLE ai_lyrics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE lyrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- 6. RLS 정책 생성 (모든 사용자 읽기/쓰기 허용)
-- ai_lyrics_cache
CREATE POLICY "Enable all for ai_lyrics_cache" ON ai_lyrics_cache
  FOR ALL USING (true) WITH CHECK (true);

-- song_patterns  
CREATE POLICY "Enable all for song_patterns" ON song_patterns
  FOR ALL USING (true) WITH CHECK (true);

-- lyrics
CREATE POLICY "Enable all for lyrics" ON lyrics
  FOR ALL USING (true) WITH CHECK (true);

-- translations
CREATE POLICY "Enable all for translations" ON translations
  FOR ALL USING (true) WITH CHECK (true);

-- 7. 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 업데이트 트리거 생성
CREATE TRIGGER update_ai_lyrics_cache_updated_at
  BEFORE UPDATE ON ai_lyrics_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_song_patterns_updated_at
  BEFORE UPDATE ON song_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_lyrics_updated_at
  BEFORE UPDATE ON lyrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 성공 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ 모든 테이블이 성공적으로 생성되었습니다!';
END $$;