import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE || ''
);

// 기본 인기 검색어 (DB가 비어있을 때 사용)
const defaultPopularSearches = [
  '아이유 좋은날',
  'NewJeans Ditto',
  'YOASOBI 夜に駆ける',
  '임영웅 사랑은 늘 도망가',
  'BTS Dynamite'
];

export async function GET(request: NextRequest) {
  try {
    // 1. favorite_songs 테이블에서 play_count 기준 상위 5개 가져오기
    const { data: favorites, error: favError } = await supabase
      .from('favorite_songs')
      .select('artist, title, play_count')
      .order('play_count', { ascending: false })
      .limit(5);

    if (favError) {
      console.error('Error fetching favorite songs:', favError);
    }

    // 2. ai_lyrics_cache에서 hit_count 기준 상위 5개 가져오기
    const { data: cached, error: cacheError } = await supabase
      .from('ai_lyrics_cache')
      .select('artist, title, hit_count')
      .order('hit_count', { ascending: false })
      .limit(5);

    if (cacheError) {
      console.error('Error fetching cached songs:', cacheError);
    }

    // 3. 데이터 병합 및 중복 제거
    const popularSearches = new Map<string, number>();

    // favorites 추가
    if (favorites && favorites.length > 0) {
      favorites.forEach(song => {
        const key = `${song.artist} ${song.title}`;
        popularSearches.set(key, song.play_count || 0);
      });
    }

    // cached 추가 (hit_count를 play_count처럼 취급)
    if (cached && cached.length > 0) {
      cached.forEach(song => {
        const key = `${song.artist} ${song.title}`;
        const currentCount = popularSearches.get(key) || 0;
        popularSearches.set(key, currentCount + (song.hit_count || 0));
      });
    }

    // 4. 정렬 및 상위 8개 선택
    let finalSearches = Array.from(popularSearches.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([key]) => key);

    // 5. 데이터가 없으면 기본값 사용
    if (finalSearches.length === 0) {
      finalSearches = defaultPopularSearches;
    }

    // 6. 최근 검색 기록도 가져오기 (선택사항)
    const recentSearches: string[] = [];

    return NextResponse.json({
      success: true,
      popularSearches: finalSearches,
      recentSearches,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in popular-searches API:', error);
    
    // 에러 시 기본값 반환
    return NextResponse.json({
      success: false,
      popularSearches: defaultPopularSearches,
      recentSearches: [],
      error: 'Failed to fetch popular searches'
    });
  }
}

// POST: 검색 기록 업데이트
export async function POST(request: NextRequest) {
  try {
    const { artist, title } = await request.json();

    if (!artist || !title) {
      return NextResponse.json(
        { success: false, error: 'Artist and title are required' },
        { status: 400 }
      );
    }

    // favorite_songs 테이블 업데이트 또는 삽입
    const { data: existing } = await supabase
      .from('favorite_songs')
      .select('id, play_count')
      .eq('artist', artist)
      .eq('title', title)
      .single();

    if (existing) {
      // 기존 레코드 업데이트
      await supabase
        .from('favorite_songs')
        .update({ 
          play_count: (existing.play_count || 0) + 1,
          last_played: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // 새 레코드 삽입
      await supabase
        .from('favorite_songs')
        .insert({
          artist,
          title,
          play_count: 1,
          last_played: new Date().toISOString()
        });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating search history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update search history' },
      { status: 500 }
    );
  }
}