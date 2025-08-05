-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable vector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lyrics library table
CREATE TABLE IF NOT EXISTS public.lyrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  duration INTEGER, -- in milliseconds
  lrc_content TEXT,
  metadata JSONB DEFAULT '{}',
  source TEXT, -- 'spotify', 'genius', 'youtube', 'lrclib', 'user'
  source_id TEXT, -- external ID from source
  embeddings vector(1536), -- for AI search
  view_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Translations table
CREATE TABLE IF NOT EXISTS public.translations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lyrics_id UUID NOT NULL REFERENCES public.lyrics(id) ON DELETE CASCADE,
  source_language TEXT DEFAULT 'auto',
  target_language TEXT NOT NULL,
  translated_lines JSONB NOT NULL, -- Array of {line_id, original, translation}
  translation_method TEXT DEFAULT 'google', -- 'google', 'openai', 'manual'
  ai_enhanced BOOLEAN DEFAULT FALSE,
  quality_score REAL DEFAULT 0.0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lyrics_id, target_language)
);

-- User sessions table for real-time sync
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  room_id TEXT, -- for multi-user sessions
  current_lyrics_id UUID REFERENCES public.lyrics(id),
  playback_state JSONB DEFAULT '{"currentTime": 0, "isPlaying": false, "playbackRate": 1}',
  display_settings JSONB DEFAULT '{}',
  participants JSONB DEFAULT '[]', -- Array of participant info
  is_host BOOLEAN DEFAULT TRUE,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- Favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lyrics_id UUID NOT NULL REFERENCES public.lyrics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lyrics_id)
);

-- Recent plays table
CREATE TABLE IF NOT EXISTS public.recent_plays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  lyrics_id UUID NOT NULL REFERENCES public.lyrics(id),
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lyrics_title ON public.lyrics(title);
CREATE INDEX IF NOT EXISTS idx_lyrics_artist ON public.lyrics(artist);
CREATE INDEX IF NOT EXISTS idx_lyrics_source ON public.lyrics(source);
CREATE INDEX IF NOT EXISTS idx_translations_lyrics ON public.translations(lyrics_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_room ON public.user_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_recent_plays_user ON public.recent_plays(user_id);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lyrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_plays ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- User profiles: Users can read all profiles but only update their own
CREATE POLICY "Public profiles are viewable by everyone" ON public.user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Lyrics: Public read, authenticated users can create
CREATE POLICY "Lyrics are viewable by everyone" ON public.lyrics
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create lyrics" ON public.lyrics
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own lyrics" ON public.lyrics
  FOR UPDATE USING (auth.uid() = created_by);

-- Translations: Public read, authenticated users can create
CREATE POLICY "Translations are viewable by everyone" ON public.translations
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create translations" ON public.translations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Sessions: Users can only access their own sessions or public rooms
CREATE POLICY "Users can view own sessions" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id OR room_id IS NOT NULL);

CREATE POLICY "Users can create sessions" ON public.user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own sessions" ON public.user_sessions
  FOR UPDATE USING (auth.uid() = user_id OR (room_id IS NOT NULL AND is_host = false));

-- Favorites: Users can only manage their own favorites
CREATE POLICY "Users can view own favorites" ON public.favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create favorites" ON public.favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" ON public.favorites
  FOR DELETE USING (auth.uid() = user_id);

-- Recent plays: Users can only view their own history
CREATE POLICY "Users can view own recent plays" ON public.recent_plays
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anyone can create recent plays" ON public.recent_plays
  FOR INSERT WITH CHECK (true);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_lyrics_updated_at BEFORE UPDATE ON public.lyrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_translations_updated_at BEFORE UPDATE ON public.translations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_sessions
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Enable realtime for sessions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;