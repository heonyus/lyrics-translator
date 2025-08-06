import { supabase } from './supabase';

// 테이블 존재 여부만 확인하는 간단한 버전
export async function checkTablesExist() {
  try {
    const tables = ['ai_lyrics_cache', 'song_patterns'];
    const results = await Promise.allSettled(
      tables.map(async (table) => {
        try {
          const { error } = await supabase
            .from(table)
            .select('id')
            .limit(1)
            .single();
          
          // 404는 테이블이 없다는 의미
          const exists = !error || (error.code !== '42P01' && error.code !== 'PGRST116');
          
          return {
            table,
            exists
          };
        } catch (err) {
          // 네트워크 오류 등은 조용히 처리
          return {
            table,
            exists: false
          };
        }
      })
    );
    
    return results
      .filter((r): r is PromiseFulfilledResult<{ table: string; exists: boolean }> => 
        r.status === 'fulfilled'
      )
      .map(r => r.value);
  } catch (error) {
    // 오류 시 빈 배열 반환 (콘솔에 로그 남기지 않음)
    return [];
  }
}