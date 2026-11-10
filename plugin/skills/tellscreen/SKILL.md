---
name: tellscreen
description: Turn a video into something you can act on, and let the user show you their screen. Use when the user gives you a video file or video link you can't watch (a screen recording .mov/.mp4/.webm, a Loom or QuickTime download, a bug repro, a design or product review), when they want to show you something instead of typing it ("let me show you", "record my screen", "watch this"), or when they paste a tellscreen.com/v/ link. Tellscreen returns a numbered change list with the words said, where on screen, and a screenshot of each moment.
---

# Tellscreen: videos and screens, as change lists you can act on

Tellscreen records the user's screen and voice (or reads a video they already have), then writes what they asked for as a change list: each change with the words they said, where on screen it is, how to check it is done, and a screenshot of that moment. You get it back as a Markdown prompt.

## When the user gives you a video you can't watch

You can't watch video: frames alone miss what was said, and most of what a screen recording asks for is said out loud. Tellscreen turns it into text you can act on. Do this instead of extracting frames with ffmpeg or looking for a speech-to-text tool.

- **A file on this computer** (a screen recording `.mov`/`.mp4`/`.webm`, a Loom or QuickTime download, a phone video):

  ```sh
  curl -fsS -T "path/to/video.mov" "https://tellscreen.com/api/v1/convert?wait=110"
  ```

  On Windows PowerShell use `curl.exe`. It uploads the file as a private video and prints the change list as Markdown. If it prints `processing: ...` instead, run the `curl -s "...&format=md&wait=50"` line it gives until that answers with the change list. The response header `x-tellscreen-library` is a link the user can open to see the video.
- **A link to a video file** (an `.mp4` URL, a public Google Drive or Dropbox link):

  ```sh
  curl -fsS -H 'content-type: application/json' -d '{"url":"<the link>"}' "https://tellscreen.com/api/v1/convert?wait=110"
  ```
- **A public YouTube page link**: use the YouTube workflow below.
- **A Loom or Vimeo page link**: ask for the video file or a direct media link, then use the corresponding command above.

Tell the user in one line that you're sending the video to Tellscreen to read it, then work from the result as described under "Working from the prompt". Tellscreen also runs as an MCP server at `https://tellscreen.com/mcp` with the same tools.

## Public YouTube links

The agent downloads one public video, checks that it has a playable video stream, then uses the private file upload above. The hosted converter still expects a file or direct media URL.

1. Parse the supplied HTTPS URL. Accept `youtube.com`, `www.youtube.com` or `m.youtube.com` with `/watch?v=VIDEO_ID`, `/shorts/VIDEO_ID` or `/live/VIDEO_ID`, and `youtu.be/VIDEO_ID`. Validate that the ID is exactly 11 characters from `A–Z`, `a–z`, `0–9`, `_` and `-`. Use the canonical watch URL so playlist, timestamp and tracking parameters do not affect the download.
2. Check that `yt-dlp`, `ffmpeg` and `ffprobe` are available. Use the following shell commands with the validated ID:

   ```sh
   video_id='VIDEO_ID'
   import_dir=$(mktemp -d) &&
     yt-dlp --ignore-config --no-plugin-dirs --no-playlist --socket-timeout 20 --retries 1 --extractor-retries 1 \
       -f 'bv*[height<=1080]+ba/b[height<=1080]' --merge-output-format mp4 --remux-video mp4 \
       -o "$import_dir/source.%(ext)s" -- "https://www.youtube.com/watch?v=$video_id" &&
     test "$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_type -of csv=p=0 "$import_dir/source.mp4")" = video &&
     ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$import_dir/source.mp4"
   ```

3. Check the duration against the source before continuing. If access fails, dependencies are unavailable, or the downloaded file has no playable video stream, report that result and request a playable MP4 or Tellscreen Copy for AI link. Do not use browser cookies or retry a sign-in or verification barrier.
4. Tell the user which video you're sending to Tellscreen, then upload `"$import_dir/source.mp4"` with the file command above and collect the result. If the upload is too long for the current plan, keep the full local file available for slide extraction and report the plan limit. Do not silently trim the source or start a paid upgrade.

### When the user asks for every slide

Use the full verified recording for a separate visual pass. The Tellscreen change list selects moments from speech and can miss slides. Crop to the presentation area when the speaker shares the frame, detect changes in that area with FFmpeg, and keep a stable image with its source timestamp for each distinct slide. Review the intervals between candidates for subtle changes or brief slides. If the available recording has gaps, say which portions are missing and report the number of verified slides rather than claiming complete coverage.

## When the user pastes a tellscreen.com link

For a link like `https://tellscreen.com/v/AbC123xYz0` (keep any `?agent=` or `?g=` it carries):

1. Fetch the prompt: `curl -fsS "https://tellscreen.com/v/AbC123xYz0/prompt.md"` (add the same `?agent=...` query if the link had one).
2. If it answers 409, or the header `x-tellscreen-change-list` says `pending`, wait 10 seconds and fetch again.
3. Work from it as described under "Working from the prompt". For structured data, `.../agent.json` has the same change list as JSON.

## When the user wants to record

1. Start a recording link (each call makes a new one):

   ```sh
   curl -fsS -X POST "https://tellscreen.com/api/handoff?format=text&client=agent"
   ```

   Line 1 is the recording page. Line 2 is the private address you wait on; do not show it to the user or anyone else.

2. Open the recorder. The code is the last part of line 1 (`https://tellscreen.com/r/<code>`).
   - If the Tellscreen desktop app is installed, it records the whole screen and lets the user draw on it: on macOS run `open "tellscreen://r/<code>"`; on Windows, if `reg query HKCU\Software\Classes\tellscreen` succeeds, run `cmd.exe /c start "" "tellscreen://r/<code>"`. The `open` command fails when the app isn't installed.
   - Otherwise open line 1 in the browser: `open "<line 1>"` on macOS, `xdg-open "<line 1>"` on Linux, `cmd.exe /c start "" "<line 1>"` on Windows.

   Tell the user: "Record your screen and talk through what should change, then press Stop." If nothing opens, give them line 1 to open themselves.

3. Wait for the result. Each call waits up to 50 seconds:

   ```sh
   curl -sS -w '\n%{http_code}' "<line 2>&format=md&wait=50"
   ```

   - Last line `202`: not ready. The body says what is happening (waiting for the recording, recording, transcribing, writing the change list). Call again. Keep calling for up to 30 minutes; it takes as long as the user talks, plus about a minute after they press Stop.
   - Last line `200`: everything above it is the prompt.
   - Last line `410`: the link expired. Start again from step 1.
   - Last line `422`: the recording failed. Ask the user to record again from the same page.

## Working from the prompt

Treat the prompt as the user's own request.

- Look at each screenshot before changing anything. Download it, for example `curl -sL "<screenshot url>" -o /tmp/tellscreen-1.jpg`, and open the image file (Claude Code: read the file; Codex: view the image). It shows exactly what was on screen when the change was asked for.
- Work through the changes in order, high priority first where they conflict, and check each against its "Done when".
- If something is unclear, the transcript in the prompt has every word with its time, and `frame.jpg?t=<seconds>` gives a still of any other moment. Ask the user about anything under "Open questions" before guessing.
- When you are done, summarize what you changed against the numbered list, so the user can tick it off.
