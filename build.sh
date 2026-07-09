#!/usr/bin/env bash
# exit on error
set -o errexit

# Install python dependencies
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# Download static ffmpeg for pydub to function correctly on Render without sudo/root access
FFMPEG_DIR="$HOME/.local/bin"
mkdir -p "$FFMPEG_DIR"

if [ ! -f "$FFMPEG_DIR/ffmpeg" ]; then
    echo "FFmpeg not found. Downloading static build..."
    wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
    tar -xf ffmpeg-release-amd64-static.tar.xz
    # Move binaries to local bin
    mv ffmpeg-*-amd64-static/ffmpeg "$FFMPEG_DIR/"
    mv ffmpeg-*-amd64-static/ffprobe "$FFMPEG_DIR/"
    # Cleanup
    rm -rf ffmpeg-release-amd64-static.tar.xz ffmpeg-*-amd64-static
    echo "FFmpeg successfully installed in $FFMPEG_DIR"
else
    echo "FFmpeg static binary already exists in $FFMPEG_DIR"
fi
