import { supabase } from './supabase';

// 간단한 테이블 체크만 하는 함수 (클라이언트 사이드용)
export async function checkRequiredTables() {
  // 클라이언트 사이드에서는 일반 supabase 클라이언트 사용
  const requiredTables = ['ai_lyrics_cache', 'song_patterns'];
  const missingTables: string[] = [];
  
  for (const table of requiredTables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (error && (error.code === 'PGRST116' || error.code === '42P01')) {
        missingTables.push(table);
      }
    } catch {
      missingTables.push(table);
    }
  }
  
  if (missingTables.length > 0) {
    console.error('⚠️ Missing Supabase tables:', missingTables.join(', '));
    console.log('📝 Please run the following SQL in Supabase Dashboard:');
    console.log('   Path: /src/lib/database-init.sql');
    return false;
  }
  
  return true;
}