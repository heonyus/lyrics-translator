# 🎤 Karaoke Lyrics Translator

Real-time karaoke-style lyrics display with live translation for singing broadcasts. Perfect for connecting with international audiences!

![Next.js](https://img.shields.io/badge/Next.js-15.1-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-19.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **Automatic Lyrics Fetching**: Search and fetch lyrics from multiple sources (Spotify, Genius, YouTube, LRClib)
- **Word-by-Word Karaoke**: Smooth word-level highlighting with customizable animations
- **Real-time Translation**: Translate lyrics to 20+ languages using Google Translate API
- **OBS Integration**: Transparent overlay perfect for streaming
- **Smart Matching**: AI-powered lyrics matching with confidence scoring
- **Customizable Display**: Adjust colors, fonts, animations, and timing

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ 
- npm or yarn
- Google Cloud API key (for translations)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/lyrics-translator.git
cd lyrics-translator

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Add your Google API key to .env.local
# NEXT_PUBLIC_GOOGLE_API_KEY=your_api_key_here

# Run development server
npm run dev
```

### Usage

1. **Demo Page** (`/demo`): Test the karaoke display and translation
2. **Control Panel** (`/control`): Search songs and configure overlay settings
3. **OBS Overlay** (`/overlay`): Add as Browser Source in OBS

## 🎬 OBS Setup

1. In OBS, add a new **Browser Source**
2. Set URL: `http://localhost:3000/overlay?q=Song+Name+Artist&lang=ko`
3. Width: `1920`, Height: `1080`
4. Check "Shutdown source when not visible"
5. Check "Refresh browser when scene becomes active"

### URL Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `q` | Song search query or URL | Required |
| `lang` | Target translation language | `en` |
| `fontSize` | Font size in pixels | `32` |
| `color` | Highlight color (hex) | `#FFD700` |
| `animation` | Animation type: fade, slide, glow | `glow` |
| `autoPlay` | Auto-start playback | `true` |

## 🏗️ Architecture

```
src/
├── app/                    # Next.js app router pages
│   ├── demo/              # Demo page
│   ├── control/           # Control panel
│   └── overlay/           # OBS overlay
├── domains/               # Domain-driven design modules
│   ├── lyrics/           # LRC parsing and playback
│   ├── lrc-fetcher/      # Automatic lyrics fetching
│   ├── translation/      # Translation service
│   ├── karaoke/          # Display components
│   └── metadata/         # Metadata extraction
└── components/           # Shared UI components
```

## 🔧 Configuration

### Environment Variables

```env
# Google Cloud Translation API
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key

# Optional: Enhanced providers
NEXT_PUBLIC_GENIUS_API_KEY=your_genius_key
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_id
SPOTIFY_CLIENT_SECRET=your_spotify_secret
NEXT_PUBLIC_YOUTUBE_API_KEY=your_youtube_key
```

### Supported Languages

English, Korean, Japanese, Chinese, Spanish, French, German, Portuguese, Russian, Arabic, Hindi, Thai, Vietnamese, Indonesian, Italian, Dutch, Polish, Turkish, Swedish, Norwegian

## 📚 API Documentation

### LRC Format

The app supports standard LRC with word-level timing:

```lrc
[00:12.00]<00:12.30>Hello <00:12.60>world <00:13.00>lyrics
[00:15.00]<00:15.30>Next <00:15.60>line
```

### Translation Hook

```typescript
import { useTranslation } from '@/domains/translation';

const { translate, isTranslating } = useTranslation();

const result = await translate('Hello', 'ko');
// result.translatedText: "안녕하세요"
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- LRC files from [LRClib.net](https://lrclib.net)
- Lyrics data from Spotify and Genius
- Translation by Google Cloud Translation API
- Built with Next.js, React, and TypeScript