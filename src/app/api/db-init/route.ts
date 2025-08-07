import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Read the SQL schema file
    const schemaPath = path.join(process.cwd(), 'src', 'lib', 'sql', 'database-schema.sql');
    let schema: string;
    
    try {
      schema = fs.readFileSync(schemaPath, 'utf-8');
    } catch (fileError) {
      // If file doesn't exist, use inline schema
      schema = `
-- 노래 정보 테이블
CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  genre TEXT,
  release_date DATE,
  lyrics_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MR(반주) 트랙 테이블
CREATE TABLE IF NOT EXISTS mr_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  duration INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 즐겨찾기 노래 테이블
CREATE TABLE IF NOT EXISTS favorite_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  lyrics_preview TEXT,
  last_played_at TIMESTAMPTZ,
  play_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 재생목록 테이블
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  user_id TEXT,
  is_public BOOLEAN DEFAULT false,
  cover_image TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 재생목록-노래 연결 테이블
CREATE TABLE IF NOT EXISTS playlist_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- 최근 검색 기록 테이블
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  query TEXT NOT NULL,
  artist TEXT,
  title TEXT,
  result_count INTEGER,
  selected_result JSONB,
  searched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 커스텀 프롬프트 저장 테이블
CREATE TABLE IF NOT EXISTS custom_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
      `;
    }
    
    // For now, return the SQL that needs to be executed in Supabase SQL Editor
    return NextResponse.json({
      success: true,
      message: 'Please execute the following SQL in your Supabase SQL Editor',
      sql: schema,
      note: 'Copy the SQL and run it in: Supabase Dashboard > SQL Editor'
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to prepare database schema', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check which tables exist
    const tables = [
      'songs',
      'mr_tracks',
      'playlists',
      'playlist_songs',
      'favorite_songs',
      'search_history',
      'custom_prompts',
      'lyrics',
      'translations'
    ];
    
    const tableStatus: Record<string, string> = {};
    
    for (const table of tables) {
      try {
        const { data, error } = await supabaseAdmin
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          tableStatus[table] = '❌ Not found';
        } else {
          tableStatus[table] = '✅ Exists';
        }
      } catch (err) {
        tableStatus[table] = '❌ Error';
      }
    }
    
    return NextResponse.json({
      success: true,
      tables: tableStatus,
      message: 'Database table status checked'
    });
  } catch (error) {
    console.error('Database check error:', error);
    return NextResponse.json(
      { error: 'Failed to check database', details: String(error) },
      { status: 500 }
    );
  }
}