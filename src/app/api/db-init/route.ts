import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE || ''
);

export async function GET(request: NextRequest) {
  try {
    const results = {
      pronunciation_cache: false,
      ai_lyrics_cache_policies: false,
      errors: [] as string[]
    };

    // 1. pronunciation_cache 테이블 생성
    try {
      await supabase.rpc('query', {
        query: `
          CREATE TABLE IF NOT EXISTS pronunciation_cache (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            original_text TEXT NOT NULL,
            language TEXT NOT NULL,
            pronunciation TEXT NOT NULL,
            confidence FLOAT DEFAULT 1.0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
            UNIQUE(original_text, language)
          );
        `
      });
      
      await supabase.rpc('query', {
        query: `
          CREATE INDEX IF NOT EXISTS idx_pronunciation_language ON pronunciation_cache(language);
          CREATE INDEX IF NOT EXISTS idx_pronunciation_expires ON pronunciation_cache(expires_at);
        `
      });
      
      results.pronunciation_cache = true;
    } catch (error) {
      results.errors.push(`pronunciation_cache: ${error}`);
    }

    // 2. ai_lyrics_cache RLS 정책 추가
    try {
      await supabase.rpc('query', {
        query: `
          ALTER TABLE ai_lyrics_cache DISABLE ROW LEVEL SECURITY;
        `
      });
      
      results.ai_lyrics_cache_policies = true;
    } catch (error) {
      results.errors.push(`ai_lyrics_cache policies: ${error}`);
    }

    // 3. pronunciation_cache RLS 비활성화
    try {
      await supabase.rpc('query', {
        query: `
          ALTER TABLE pronunciation_cache DISABLE ROW LEVEL SECURITY;
        `
      });
    } catch (error) {
      // 무시 (테이블이 없을 수 있음)
    }

    return NextResponse.json({
      success: true,
      results,
      message: '데이터베이스 초기화 완료'
    });

  } catch (error) {
    console.error('DB init error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database initialization failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// SQL 직접 실행 (Supabase SQL Editor에서 실행할 용도)
export async function POST(request: NextRequest) {
  const sqlCommands = `
-- pronunciation_cache 테이블 생성
CREATE TABLE IF NOT EXISTS pronunciation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_text TEXT NOT NULL,
  language TEXT NOT NULL,
  pronunciation TEXT NOT NULL,
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  UNIQUE(original_text, language)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_pronunciation_language ON pronunciation_cache(language);
CREATE INDEX IF NOT EXISTS idx_pronunciation_expires ON pronunciation_cache(expires_at);

-- RLS 비활성화
ALTER TABLE pronunciation_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_lyrics_cache DISABLE ROW LEVEL SECURITY;

-- 또는 RLS 정책 추가 (필요시)
-- ALTER TABLE ai_lyrics_cache ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all" ON ai_lyrics_cache FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all" ON pronunciation_cache FOR ALL USING (true) WITH CHECK (true);
  `;

  return NextResponse.json({
    success: true,
    message: 'Supabase SQL Editor에서 다음 SQL을 실행하세요:',
    sql: sqlCommands
  });
}