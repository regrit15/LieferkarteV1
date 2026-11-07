#!/bin/bash
# Erzeugt die Testvideos und -bilder fuer den nachgebauten Anbieter (mock.js). Braucht ffmpeg.
set -e
cd "$(dirname "$0")"
mkdir -p media/hls media/img
F="ffmpeg -loglevel error -y"
$F -f lavfi -i testsrc=size=640x360:rate=25 -f lavfi -i sine=frequency=440 -t 20 -c:v libx264 -pix_fmt yuv420p -g 50 -c:a aac -f hls -hls_time 4 -hls_list_size 0 media/hls/index.m3u8
printf '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:4.0,\nindex0.ts\n' > media/hls/stall.m3u8
$F -f lavfi -i testsrc2=size=640x360:rate=25 -f lavfi -i sine=frequency=660 -t 20 -c:v libx264 -pix_fmt yuv420p -c:a aac -f mpegts media/live.ts
$F -f lavfi -i testsrc2=size=640x360:rate=25 -f lavfi -i sine=frequency=440 -t 180 -c:v libx264 -preset veryfast -b:v 1200k -maxrate 1200k -bufsize 2400k -g 50 -pix_fmt yuv420p -c:a aac -b:a 96k -muxrate 1500k -f mpegts media/long.ts
$F -f lavfi -i smptebars=size=640x360:rate=25 -f lavfi -i sine=frequency=330 -t 120 -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart media/movie.mp4
$F -f lavfi -i testsrc2=size=640x360:rate=25 -f lavfi -i sine=frequency=500 -t 8 -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart media/short.mp4
$F -f lavfi -i testsrc2=size=640x360:rate=25 -f lavfi -i sine=frequency=500 -t 60 -c:v libx264 -pix_fmt yuv420p -c:a ac3 media/film_ac3.mkv
$F -f lavfi -i smptebars=size=640x360:rate=25 -f lavfi -i sine=frequency=300 -t 60 -c:v mpeg4 -q:v 5 -c:a aac media/film_mpeg4.mp4
$F -f lavfi -i testsrc2=size=300x450 -frames:v 1 media/img/poster1.jpg
$F -f lavfi -i mandelbrot=size=300x450 -frames:v 1 media/img/poster2.jpg
$F -f lavfi -i "life=size=300x450:mold=10:rate=1:ratio=0.2" -frames:v 1 media/img/poster3.jpg
$F -f lavfi -i "mandelbrot=size=1280x720:start_scale=0.5" -frames:v 1 media/img/backdrop.jpg
$F -f lavfi -i smptehdbars=size=320x180 -frames:v 1 media/img/ep.jpg
$F -f lavfi -i color=c=0x1f6feb:size=120x80 -frames:v 1 media/img/logo.png
echo "Testmedien erzeugt."
