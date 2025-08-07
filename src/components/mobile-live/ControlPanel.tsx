'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function MobileLiveControlPanel() {
  const [settings, setSettings] = useState({
    showAlbumInfo: true,
    showNextLine: true,
    showTranslation: true,
    fontSize: 48,
    textColor: '#FFFFFF',
    chromaKey: '#1a0033'
  });
  
  const [currentSong, setCurrentSong] = useState({
    title: '',
    artist: '',
    album: '',
    coverUrl: ''
  });

  useEffect(() => {
    // Load saved settings
    const saved = localStorage.getItem('mobile_overlay_settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
    
    // Load current song info
    const title = localStorage.getItem('current_title') || '';
    const artist = localStorage.getItem('current_artist') || '';
    const album = localStorage.getItem('current_album') || '';
    const coverUrl = localStorage.getItem('current_cover_url') || '';
    
    setCurrentSong({ title, artist, album, coverUrl });
  }, []);

  const updateSettings = (newSettings: typeof settings) => {
    setSettings(newSettings);
    localStorage.setItem('mobile_overlay_settings', JSON.stringify(newSettings));
  };

  const fetchAlbumInfo = async () => {
    if (!currentSong.artist || !currentSong.title) return;
    
    try {
      const response = await fetch('/api/album/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: currentSong.artist,
          title: currentSong.title
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.albumInfo) {
          const info = data.albumInfo;
          
          // Update localStorage with album info
          localStorage.setItem('current_album', info.album || '');
          localStorage.setItem('current_cover_url', info.coverUrl || '');
          
          setCurrentSong({
            ...currentSong,
            album: info.album || '',
            coverUrl: info.coverUrl || ''
          });
          
          // Trigger storage event
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'current_album',
            newValue: info.album || ''
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch album info:', error);
    }
  };

  const getOverlayUrl = () => {
    const params = new URLSearchParams({
      fontSize: settings.fontSize.toString(),
      textColor: encodeURIComponent(settings.textColor),
      chromaKey: encodeURIComponent(settings.chromaKey),
      showAlbum: settings.showAlbumInfo.toString(),
      showNext: settings.showNextLine.toString(),
      showTranslation: settings.showTranslation.toString()
    });
    
    return `${window.location.origin}/obs/mobile-live?${params.toString()}`;
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(getOverlayUrl());
    alert('OBS URL copied to clipboard!');
  };

  return (
    <div className="p-6 space-y-6 bg-gray-900 text-white rounded-lg">
      <h2 className="text-2xl font-bold">📱 Mobile Live Overlay Control</h2>
      
      {/* Current Song Info */}
      <div className="p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Current Song</h3>
        {currentSong.coverUrl && (
          <img src={currentSong.coverUrl} alt="Album" className="w-20 h-20 rounded mb-2" />
        )}
        <p className="text-sm">{currentSong.title || 'No song loaded'}</p>
        <p className="text-xs opacity-70">{currentSong.artist}</p>
        <p className="text-xs opacity-50">{currentSong.album}</p>
        <Button 
          onClick={fetchAlbumInfo}
          className="mt-2"
          disabled={!currentSong.title || !currentSong.artist}
        >
          Fetch Album Info
        </Button>
      </div>

      {/* Display Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Display Settings</h3>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="show-album">Show Album Info</Label>
          <Switch
            id="show-album"
            checked={settings.showAlbumInfo}
            onCheckedChange={(checked) => 
              updateSettings({ ...settings, showAlbumInfo: checked })
            }
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="show-next">Show Next Line Preview</Label>
          <Switch
            id="show-next"
            checked={settings.showNextLine}
            onCheckedChange={(checked) => 
              updateSettings({ ...settings, showNextLine: checked })
            }
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="show-trans">Show Translations</Label>
          <Switch
            id="show-trans"
            checked={settings.showTranslation}
            onCheckedChange={(checked) => 
              updateSettings({ ...settings, showTranslation: checked })
            }
          />
        </div>
        
        <div className="space-y-2">
          <Label>Font Size: {settings.fontSize}px</Label>
          <Slider
            value={[settings.fontSize]}
            onValueChange={(value) => 
              updateSettings({ ...settings, fontSize: value[0] })
            }
            min={24}
            max={72}
            step={2}
          />
        </div>
        
        <div className="space-y-2">
          <Label>Text Color</Label>
          <input
            type="color"
            value={settings.textColor}
            onChange={(e) => 
              updateSettings({ ...settings, textColor: e.target.value })
            }
            className="w-full h-10 rounded cursor-pointer"
          />
        </div>
        
        <div className="space-y-2">
          <Label>Chroma Key Color</Label>
          <div className="flex gap-2">
            <input
              type="color"
              value={settings.chromaKey}
              onChange={(e) => 
                updateSettings({ ...settings, chromaKey: e.target.value })
              }
              className="flex-1 h-10 rounded cursor-pointer"
            />
            <Button
              onClick={() => updateSettings({ ...settings, chromaKey: '#1a0033' })}
              variant="outline"
            >
              Dark Purple
            </Button>
            <Button
              onClick={() => updateSettings({ ...settings, chromaKey: '#00FF00' })}
              variant="outline"
            >
              Green
            </Button>
          </div>
        </div>
      </div>

      {/* OBS URL */}
      <div className="p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">OBS Browser Source</h3>
        <p className="text-xs opacity-70 mb-2">Size: 1080 x 1920 (9:16 Portrait)</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={getOverlayUrl()}
            readOnly
            className="flex-1 px-3 py-2 bg-gray-700 rounded text-sm"
          />
          <Button onClick={copyUrl}>Copy URL</Button>
        </div>
      </div>

      {/* Tips */}
      <div className="p-4 bg-blue-900/30 rounded-lg text-sm">
        <h4 className="font-semibold mb-1">💡 Tips for TikTok Live</h4>
        <ul className="space-y-1 opacity-80">
          <li>• Album info appears at top (15% from top)</li>
          <li>• Lyrics appear at bottom (20% from bottom)</li>
          <li>• Middle area stays clear for your face</li>
          <li>• Use dark purple chroma key for better removal</li>
          <li>• Adjust font size based on your stream quality</li>
        </ul>
      </div>
    </div>
  );
}