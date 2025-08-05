import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Admin client for server-side operations
export const supabaseAdmin = () => {
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;
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