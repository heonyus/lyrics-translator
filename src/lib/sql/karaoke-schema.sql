-- 노래방 시스템 종합 데이터베이스 스키마

-- 1. 노래 마스터 테이블
CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist TEXT NOT NULL,
  title TEXT NOT NULL,
  lyrics TEXT NOT NULL,
  lyrics_language TEXT DEFAULT 'ko',
  metadata JSONB DEFAULT '{}',
  search_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(artist, title)
);

-- 2. MR(반주) 정보
CREATE TABLE IF NOT EXISTS mr_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  youtube_url TEXT,
  youtube_id TEXT,
  platform TEXT DEFAULT 'youtube', -- youtube, soundcloud, etc.
  duration INTEGER, -- 초 단위
  key_signature TEXT, -- 원키, +1, -2 등
  tempo INTEGER, -- BPM
  quality_rating INTEGER DEFAULT 3, -- 1-5
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 번역 캐시 (개선된 버전)
CREATE TABLE IF NOT EXISTS translations_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  source_language TEXT DEFAULT 'ko',
  target_language TEXT NOT NULL,
  full_translation JSONB NOT NULL, -- {lines: [{original: "", translated: ""}, ...]}
  translation_method TEXT DEFAULT 'ai', -- ai, google, manual
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, target_language)
);

-- 4. 재생 세션 (타이밍 기록)
CREATE TABLE IF NOT EXISTS play_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  mr_track_id UUID REFERENCES mr_tracks(id) ON DELETE SET NULL,
  user_session TEXT NOT NULL,
  line_timings JSONB DEFAULT '[]', -- [{line_index: 0, clicked_at: 1.234}, ...]
  translation_languages TEXT[] DEFAULT '{}',
  playback_settings JSONB DEFAULT '{}', -- {fontSize: 60, textColor: "#FFF", etc}
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT FALSE
);

-- 5. 플레이리스트 (사용자별)
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_session TEXT NOT NULL,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  mr_track_id UUID REFERENCES mr_tracks(id) ON DELETE SET NULL,
  play_count INTEGER DEFAULT 0,
  last_played TIMESTAMPTZ,
  is_favorite BOOLEAN DEFAULT FALSE,
  custom_settings JSONB DEFAULT '{}', -- 개인 설정 (키, 템포, 글자크기 등)
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_session, song_id)
);

-- 6. 학습된 타이밍 패턴
CREATE TABLE IF NOT EXISTS timing_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  mr_track_id UUID REFERENCES mr_tracks(id) ON DELETE CASCADE,
  line_index INTEGER NOT NULL,
  avg_timing FLOAT,
  timing_samples FLOAT[] DEFAULT '{}', -- 모든 샘플 저장
  sample_count INTEGER DEFAULT 0,
  confidence FLOAT DEFAULT 0.0, -- 0.0 ~ 1.0
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, mr_track_id, line_index)
);

-- 7. 인기 검색어 (기존 개선)
CREATE TABLE IF NOT EXISTS popular_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist TEXT NOT NULL,
  title TEXT NOT NULL,
  search_count INTEGER DEFAULT 1,
  last_searched TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(artist, title)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_songs_artist_title ON songs(artist, title);
CREATE INDEX IF NOT EXISTS idx_songs_search_count ON songs(search_count DESC);
CREATE INDEX IF NOT EXISTS idx_mr_tracks_song_id ON mr_tracks(song_id);
CREATE INDEX IF NOT EXISTS idx_mr_tracks_youtube_id ON mr_tracks(youtube_id);
CREATE INDEX IF NOT EXISTS idx_translations_song_id ON translations_cache(song_id);
CREATE INDEX IF NOT EXISTS idx_play_sessions_user ON play_sessions(user_session);
CREATE INDEX IF NOT EXISTS idx_play_sessions_song ON play_sessions(song_id);
CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_session);
CREATE INDEX IF NOT EXISTS idx_playlists_favorites ON playlists(user_session, is_favorite);
CREATE INDEX IF NOT EXISTS idx_timing_patterns_song_mr ON timing_patterns(song_id, mr_track_id);

-- RLS 정책 설정
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mr_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE timing_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE popular_searches ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 읽기/쓰기 허용 정책
CREATE POLICY "Public access for songs" ON songs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public access for mr_tracks" ON mr_tracks
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public access for translations_cache" ON translations_cache
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public access for play_sessions" ON play_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public access for playlists" ON playlists
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public access for timing_patterns" ON timing_patterns
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public access for popular_searches" ON popular_searches
  FOR ALL USING (true) WITH CHECK (true);

-- 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 업데이트 트리거 생성
CREATE TRIGGER update_songs_updated_at
  BEFORE UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_mr_tracks_updated_at
  BEFORE UPDATE ON mr_tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_translations_cache_updated_at
  BEFORE UPDATE ON translations_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_playlists_updated_at
  BEFORE UPDATE ON playlists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_timing_patterns_updated_at
  BEFORE UPDATE ON timing_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 타이밍 학습 함수
CREATE OR REPLACE FUNCTION update_timing_pattern(
  p_song_id UUID,
  p_mr_track_id UUID,
  p_line_index INTEGER,
  p_new_timing FLOAT
)
RETURNS void AS $$
DECLARE
  v_samples FLOAT[];
  v_avg FLOAT;
  v_confidence FLOAT;
BEGIN
  -- 기존 패턴 가져오기
  SELECT timing_samples INTO v_samples
  FROM timing_patterns
  WHERE song_id = p_song_id 
    AND mr_track_id = p_mr_track_id 
    AND line_index = p_line_index;
  
  IF v_samples IS NULL THEN
    v_samples := ARRAY[p_new_timing];
  ELSE
    v_samples := array_append(v_samples, p_new_timing);
    -- 최대 20개 샘플만 유지
    IF array_length(v_samples, 1) > 20 THEN
      v_samples := v_samples[2:21];
    END IF;
  END IF;
  
  -- 평균 계산
  SELECT AVG(unnest) INTO v_avg FROM unnest(v_samples);
  
  -- 신뢰도 계산 (샘플 수 기반)
  v_confidence := LEAST(array_length(v_samples, 1) / 10.0, 1.0);
  
  -- 업데이트 또는 삽입
  INSERT INTO timing_patterns (
    song_id, mr_track_id, line_index, 
    avg_timing, timing_samples, sample_count, confidence
  ) VALUES (
    p_song_id, p_mr_track_id, p_line_index,
    v_avg, v_samples, array_length(v_samples, 1), v_confidence
  )
  ON CONFLICT (song_id, mr_track_id, line_index)
  DO UPDATE SET
    avg_timing = v_avg,
    timing_samples = v_samples,
    sample_count = array_length(v_samples, 1),
    confidence = v_confidence,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;