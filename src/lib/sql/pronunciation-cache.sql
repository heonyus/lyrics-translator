-- 발음 변환 캐시 테이블
CREATE TABLE IF NOT EXISTS pronunciation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_text TEXT NOT NULL,
  language TEXT NOT NULL, -- 'ja', 'en', 'zh'
  pronunciation TEXT NOT NULL,
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  
  -- 원본 텍스트와 언어로 유니크 제약
  UNIQUE(original_text, language)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_pronunciation_language ON pronunciation_cache(language);
CREATE INDEX IF NOT EXISTS idx_pronunciation_expires ON pronunciation_cache(expires_at);

-- 텍스트 길이에 대한 인덱스 (짧은 텍스트 우선)
CREATE INDEX IF NOT EXISTS idx_pronunciation_text_length ON pronunciation_cache(LENGTH(original_text));

-- 만료된 캐시 자동 삭제
CREATE OR REPLACE FUNCTION clean_expired_pronunciation_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM pronunciation_cache 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- RLS 정책 비활성화 (공개 읽기/쓰기)
ALTER TABLE pronunciation_cache ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 읽기 허용
CREATE POLICY "Allow public read" ON pronunciation_cache
  FOR SELECT USING (true);

-- 모든 사용자 쓰기 허용
CREATE POLICY "Allow public insert" ON pronunciation_cache
  FOR INSERT WITH CHECK (true);

-- 모든 사용자 업데이트 허용
CREATE POLICY "Allow public update" ON pronunciation_cache
  FOR UPDATE USING (true);