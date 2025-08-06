import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 싱글톤 패턴으로 하나의 인스턴스만 생성
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const supabase = (() => {
  if (typeof window !== 'undefined' && !supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
  } else if (!supabaseInstance) {
    // 서버사이드용
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
  }
  return supabaseInstance!;
})();

// Admin client for server-side operations ONLY
export const supabaseAdmin = () => {
  // 클라이언트 사이드에서 호출 방지
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin can only be used on the server side');
  }
  
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseServiceRole) {
    throw new Error('SUPABASE_SERVICE_ROLE is not set');
  }
  
  return createClient(supabaseUrl, supabaseServiceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// Types for database tables
export interface LyricsRecord {
  id: string;
  title: string;
  artist: string;
  album?: string;
  lrc_content: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TranslationRecord {
  id: string;
  lyrics_id: string;
  source_language?: string;
  target_language: string;
  translated_content: string;
  ai_enhanced: boolean;
  created_at: string;
}

export interface UserSessionRecord {
  id: string;
  user_id?: string;
  session_id: string;
  current_song_id?: string;
  playback_state?: {
    currentTime: number;
    isPlaying: boolean;
    playbackRate: number;
  };
  settings?: {
    fontSize: number;
    highlightColor: string;
    animationType: string;
    targetLanguages: string[];
  };
  created_at: string;
  updated_at: string;
}