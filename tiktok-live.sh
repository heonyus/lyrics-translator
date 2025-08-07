#!/bin/bash

echo "======================================"
echo "  TikTok Live Overlay Launcher"
echo "  Size: 1080 x 1920 (9:16)"
echo "======================================"
echo

# For macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
        --app=http://localhost:3000/obs/mobile-live \
        --window-size=1080,1920 \
        --window-position=100,10 \
        --disable-extensions \
        --disable-plugins

# For Linux
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    google-chrome \
        --app=http://localhost:3000/obs/mobile-live \
        --window-size=1080,1920 \
        --window-position=100,10 \
        --disable-extensions \
        --disable-plugins
fi

echo
echo "Overlay started! Use OBS Window Capture."