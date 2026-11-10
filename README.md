# Tellscreen for AI agents

AI coding agents can't watch a video. Tellscreen turns a screen recording into a change list they
can act on: every change you asked for, with your exact words, where on screen it is, how to check
it's done, and a screenshot of that moment. Record your screen and talk, or hand over a video you
already have. [tellscreen.com](https://tellscreen.com)

## Claude Code

```
/plugin marketplace add theguysaccount/tellscreen
/plugin install tellscreen@tellscreen
```

Adds a Record screen button above the prompt, and teaches Claude Code what to do with a video file.

## Codex, Cursor and other agents that read skills

```
npx skills add theguysaccount/tellscreen
```

## Gemini CLI

```
gemini extensions install https://github.com/theguysaccount/tellscreen
```

## Any MCP client (Claude Desktop, Cursor, VS Code, Windsurf)

Add the remote server `https://tellscreen.com/mcp`. Nothing to sign in to. It's also listed in the
official MCP Registry as `com.tellscreen/tellscreen`.

## Or just one command

```
curl -fsS -T recording.mov "https://tellscreen.com/api/v1/convert?wait=110"
```

Prints the change list as Markdown. The video is uploaded as a private video.

### Public YouTube links

Give a public YouTube link to an agent with the Tellscreen skill installed. With yt-dlp and
FFmpeg available, the agent can fetch the selected video, validate it, and send the file to
Tellscreen's private converter. For a talk, ask for every distinct slide to get a separate visual
pass over the complete recording. The hosted converter continues to accept files and direct
media links.

## What leaves your computer

Only the recording or video you choose, sent to tellscreen.com to be transcribed and turned into
the change list. See the [privacy policy](https://tellscreen.com/privacy).
