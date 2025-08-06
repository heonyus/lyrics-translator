-- Drop existing tables if they exist
DROP TABLE IF EXISTS translations CASCADE;
DROP TABLE IF EXISTS lyrics CASCADE;

-- Create lyrics table
CREATE TABLE lyrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  lrc_content TEXT NOT NULL,
  lines JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create translations table for caching
CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lyrics_id UUID REFERENCES lyrics(id) ON DELETE CASCADE,
  line_index INTEGER NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  target_language TEXT NOT NULL,
  timestamp FLOAT,
  duration FLOAT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lyrics_id, line_index, target_language)
);

-- Create indexes for better performance
CREATE INDEX idx_lyrics_title_artist ON lyrics(title, artist);
CREATE INDEX idx_translations_lyrics_id ON translations(lyrics_id);
CREATE INDEX idx_translations_unique ON translations(lyrics_id, line_index, target_language);

-- Enable Row Level Security (RLS)
ALTER TABLE lyrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (for now)
CREATE POLICY "Allow public read access" ON lyrics
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON lyrics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON lyrics
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON lyrics
  FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON translations
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON translations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON translations
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON translations
  FOR DELETE USING (true);