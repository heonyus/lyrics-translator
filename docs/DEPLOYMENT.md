# Deployment Guide

## Vercel Deployment

### Prerequisites

1. Vercel account
2. Google Cloud API key for translations
3. Optional: API keys for enhanced providers (Genius, Spotify, YouTube)

### Deployment Steps

1. **Install Vercel CLI** (optional):
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Vercel**:
   ```bash
   vercel
   ```
   Or push to GitHub and connect to Vercel dashboard.

3. **Configure Environment Variables** in Vercel Dashboard:
   - `NEXT_PUBLIC_GOOGLE_API_KEY` - Required for translations
   - `NEXT_PUBLIC_GENIUS_API_KEY` - Optional for Genius lyrics
   - `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` - Optional for Spotify
   - `SPOTIFY_CLIENT_SECRET` - Optional for Spotify
   - `NEXT_PUBLIC_YOUTUBE_API_KEY` - Optional for YouTube

4. **Custom Domain** (optional):
   - Add your domain in Vercel dashboard
   - Update DNS records

### Production URLs

After deployment, your app will be available at:
- Main app: `https://your-app.vercel.app`
- OBS overlay: `https://your-app.vercel.app/overlay?q=Song+Name`

### OBS Configuration for Production

Update OBS Browser Source URL to use your production domain:
```
https://your-app.vercel.app/overlay?q=Song+Name&lang=ko&fontSize=40
```

### Performance Optimization

1. **Edge Functions**: Translation API calls are optimized for edge runtime
2. **Caching**: 24-hour cache for translations and LRC fetches
3. **Static Generation**: Most pages are pre-rendered for fast loading

### Monitoring

- Check Vercel Analytics for performance metrics
- Monitor API usage in Google Cloud Console
- Set up alerts for API quota limits

### Troubleshooting

1. **CORS Issues**: Already configured in `vercel.json`
2. **API Key Issues**: Double-check environment variables in Vercel dashboard
3. **Build Failures**: Ensure Node.js version is 20+ in Vercel settings