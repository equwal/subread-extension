# SubRead for YouTube (Chrome and Firefox)

Shows your own `.srt` over a YouTube video, in time with it. It is made for
audiobooks on YouTube: make book-accurate subtitles at
[subread.space](https://subread.space) from the audiobook and its ebook (free,
in the browser), then read along on the video.

Press **SR** at the top right of the player, and choose the `.srt`.

![The caption over the player, and the SR panel: file, start, speed, size](docs/screenshots/player.png)

The picture is from the stand-in page in `tests/mock/` (`/watch?v=mock&demo`), not from YouTube.

- **Start**: the video on YouTube often has an intro that your audio file does
  not. Play to where the narrator reads the first line and press
  **First line is now**, or move the start by 0.1 s and 1 s.
- **Speed**: for an upload that runs a little faster or slower than your file.
- The subtitles and these settings are kept for each video (the newest 8).

## What it does not do

It does not read, record or download the video or its sound, and it sends
nothing anywhere. The one permission is `storage`, to keep your subtitles in
the browser. The stores do not allow an extension that takes media from
YouTube, and YouTube's terms do not allow it; this one only draws text.

## Layout

| Path | What |
|---|---|
| `manifest.json` | Manifest V3, the same for both browsers (`browser_specific_settings` is for Firefox) |
| `src/srt.js` | Reads .srt and .vtt; finds the cue for a moment. No browser APIs, so Node tests it |
| `src/content.js`, `src/content.css` | The caption box, the **SR** button and the panel, inside `#movie_player` |
| `popup.html` | How to use it |
| `tests/srt.test.cjs` | `node --test tests/srt.test.cjs` |
| `tests/mock/server.py` | A stand-in for a watch page, to try the content script by hand |
| `tools/pack.py` | Makes `dist/subread-chrome.zip` and `dist/subread-firefox.zip` |
| `tools/graphics.py` | Makes the Chrome promo tiles in `store/graphics/` |
| `tools/shots/` | Takes the store screenshots in Brave over CDP |
| `store/listing.md` | The texts and answers for the two stores |

## Try it

Chrome: `chrome://extensions` > Developer mode > Load unpacked > this folder.
Firefox: `about:debugging` > This Firefox > Load Temporary Add-on > `manifest.json`.

## Licence

AGPL-3.0: see `LICENSE`.
