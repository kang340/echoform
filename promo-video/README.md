# ECHOFORM promotional film

32 seconds · 1920 × 1080 · 30 fps · Chinese / English · original ECHOFORM soundscape.

Real geometry is rendered deterministically from the application engine at 30 frames per second. The seven scenes cover voice-to-architecture growth, three architectural styles, exploration, exports, and open-source links. Modeling and initial core code are credited to **DeepSeek V4.1 Flash 1017**.

## Reproduce

1. Install the main app dependencies and run its Vite server on port 5178.
2. Install FFmpeg and expose it on PATH, or set FFMPEG_PATH for capture.
3. Run `node promo-video/capture.mjs` from the repository root.
4. Run `npm run check` and `node render.mjs` in this directory. The helper detects this workstation's installed Chrome, FFmpeg and local FFprobe; other machines can use their own PATH or HYPERFRAMES_* environment variables.

The original soundtrack comes from the application's synthesized étude (src/lib/demo-audio.ts), extracted from media/ECHOFORM-demo.mp4 with an end fade. Fonts are the same Instrument Serif and Manrope fonts used by the application; their licenses remain in the parent project. GSAP is distributed under its standard license. Film and brand assets follow ../media/LICENSE.md; source remains MIT.
