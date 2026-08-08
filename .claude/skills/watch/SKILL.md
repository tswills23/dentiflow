---
name: watch
description: Analyze a video by URL or local file — downloads it, samples frames, transcribes audio, and answers a question or task over both signals. Works on Windows 11 with yt-dlp + ffmpeg + Whisper. Use for single videos, batch playlists, or course ingestion.
allowed-tools: Bash, PowerShell, Read, Write, Glob
---

# Video Analysis

## When to Use
User says any of: "/watch", "watch this video", "analyze this video", "summarize this video", "transcribe this", or passes a video URL or local file path with a question.

## Step 0: Choose the method BEFORE running anything

Match the method to the content type:

| Content type | Frame budget | Resolution | Primary signal |
|---|---|---|---|
| Talking-head / podcast / lecture | Minimal (10–20) | 512px | Transcript |
| Whiteboard / slides / diagrams / on-screen text | High (60–100) | 1024px | Frames |
| Screen recording / UI bug repro | High (60–100) | 512–1024px | Frames |
| Fast action / frame-exact events | Warn user: 2 fps will miss things | — | N/A |

State the chosen method and rough token cost to the user before running.

**Cost guidance:** 80 frames @ 512px ≈ 50–80k image tokens. 1024px roughly doubles it. Whisper adds API cost. Flag this before large batches.

## Step 1: Verify source accessibility (single test before any batch)

| Source type | Action |
|---|---|
| Public URL (YouTube, Vimeo, Wistia, TikTok, X, Twitch, HLS/.m3u8) | yt-dlp works as-is |
| Login/paywalled with session | Try `yt-dlp --cookies-from-browser chrome`; check ToS |
| DRM-protected (Widevine, etc.) | CANNOT download — stop and report |
| Local file path | Skip download, go straight to frames + transcript |

Test one video before committing to a batch. If download fails, diagnose the player/host (inspect for embed or .m3u8 URL) and report whether it's fixable or hard DRM.

## Step 2: Download the video (if URL)

```powershell
# Install if missing
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg

# Download (best quality, single file)
yt-dlp -o "$env:TEMP\watch_tmp\video.%(ext)s" "<URL>"
```

For a known segment (question targets specific timestamp range):
```powershell
yt-dlp --download-sections "*00:05:00-00:15:00" -o "$env:TEMP\watch_tmp\video.%(ext)s" "<URL>"
```

## Step 3: Extract frames

Scale frame count to duration. Hard caps: **2 fps, 100 frames max**.

```powershell
# Auto-scale: ~30 frames for short clips, sparse for long ones
# Example: 2 fps, max 100 frames, JPEG at chosen resolution
$resolution = 512  # or 1024 for visually dense content
ffmpeg -i "$env:TEMP\watch_tmp\video.*" `
  -vf "fps=2,scale=${resolution}:-1" `
  -frames:v 100 `
  "$env:TEMP\watch_tmp\frame_%04d.jpg"
```

Then Read each frame image file in sequence.

## Step 4: Get the transcript

### Option A — Native captions (free, preferred)
```powershell
yt-dlp --write-auto-sub --skip-download --sub-format vtt `
  -o "$env:TEMP\watch_tmp\subs" "<URL>"
```
Parse the `.vtt` file for timestamped text.

### Option B — Whisper via Groq API (fast, cheap)
Extract audio first (25 MB / ~50 min cap per file):
```powershell
ffmpeg -i "$env:TEMP\watch_tmp\video.*" -vn -ar 16000 -ac 1 `
  "$env:TEMP\watch_tmp\audio.mp3"
```
Then call Groq Whisper API with the audio file. If file exceeds 25 MB, split into chunks first.

### Option C — OpenAI Whisper fallback
Same audio extraction; swap in the OpenAI transcription endpoint.

For videos over ~50 min: split audio into ≤50-min chunks before transcribing, then concatenate with timestamps.

## Step 5: Reason and answer

Read all extracted frame images alongside the transcript. Answer the user's question, citing timestamps for specific claims (e.g., "At 3:42, the diagram shows...").

Explicitly note anything the 2 fps sampling rate may have missed.

## Step 6: Clean up

```powershell
Remove-Item -Recurse -Force "$env:TEMP\watch_tmp" -ErrorAction SilentlyContinue
```

Skip cleanup if the user will likely ask follow-up questions about the same video.

---

## Batch Ingestion (full course or playlist)

### Prerequisites
Pass the single-video accessibility test (Step 1) before starting the batch.

### Workflow
1. Enumerate all video URLs (from playlist page, sitemap, or user-provided list).
2. Process ONE video at a time (Whisper 25 MB cap).
3. Save each result to `<project>/<NN>-<slug>.md`:
   - Metadata (title, URL, duration, date)
   - Timestamped transcript
   - Descriptions of key on-screen frames
4. **Checkpoint to disk after every video** — the job must be resumable after interruption.
5. Cap concurrency at 5. Back off exponentially on rate limits. Never silently skip — log failures with reason.
6. After all videos: synthesize a reference doc from per-video notes if the goal is a knowledge base.

---

## Using Output for Decisions

If the ingested content feeds business or strategy work, treat video frameworks as a **lens**, not as answers — ground conclusions in the user's own data and context. Present decision work as a memo to pressure-test, not autopilot.

---

## Critical Rules
- **Never ask the user to run commands** — use Bash/PowerShell tools yourself
- **Use `python`, not `python3`** on Windows 11
- **Never imply you saw something the sampling couldn't capture** — report failures and sampling gaps plainly
- **Never proceed to batch ingestion** until one test video downloads successfully
- **Whisper cap is 25 MB / ~50 min** — split longer audio before transcribing
- For fast-action content where 2 fps will miss events: warn the user upfront rather than producing a confident-sounding but incomplete analysis
