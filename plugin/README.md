# Tellscreen

Claude can't watch a video. This plugin teaches it what to do when you hand it one: a screen
recording, a Loom or QuickTime download, a bug repro or a design review. It sends the video to
Tellscreen, which returns a numbered change list: every change you asked for, with your exact words,
where on screen it is, how to check it's done, and a screenshot of that moment.

## What it runs and what it sends

The plugin is one skill (instructions, no code). When you give Claude a video, the skill tells it to
run one command with your approval:

    curl -fsS -T "your-video.mov" "https://tellscreen.com/api/v1/convert?wait=110"

That uploads the video you chose to tellscreen.com as a private video and prints the change list.
Nothing else is read or sent. When you say "let me show you", it can instead open a Tellscreen
recording page for you to record your screen. Privacy policy: https://tellscreen.com/privacy

## Also

- Any MCP client: add `https://tellscreen.com/mcp`.
- The Record screen button above Claude Code's prompt: `/plugin install tellscreen --marketplace https://tellscreen.com/claude/marketplace.json`
