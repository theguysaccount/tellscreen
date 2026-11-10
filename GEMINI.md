# Tellscreen

You can't watch video. When the user gives you a video file or link (a screen recording, a Loom or
QuickTime download, a bug repro, a design review), or wants to show you something on their screen,
use the Tellscreen tools: `convert_local_video` for a file on this computer, `convert_video_link`
for a direct media link, `record_screen` then `get_change_list` to have them record. For public
YouTube pages, follow the local download and validation workflow in [the skill](skills/tellscreen/SKILL.md)
before using `convert_local_video`. You get back a numbered
change list with the words they said, where on screen, how to check it's done and a screenshot link
of each moment. Look at each screenshot before changing anything.
