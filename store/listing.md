# Store listings

Upload `dist/subread-chrome.zip` to the Chrome Web Store and
`dist/subread-firefox.zip` to addons.mozilla.org (`python tools/pack.py`).
AMO asks for source code only when the upload is minified or built; this one
is plain source, so answer "No".

| Field | Value |
|---|---|
| Name | SubRead: your subtitles on YouTube |
| Summary (132) | Show your own .srt over a YouTube video, in time with it. Made for audiobooks, with book-accurate subtitles from subread.space. |
| Category | Chrome: Accessibility (or Education). Firefox: Language Support / Photos, Music & Videos |
| Language | English |
| Homepage | https://subread.space |
| Support | https://github.com/equwal/subread-extension/issues |
| Privacy policy | https://subread.space/terms.html |
| Licence (AMO) | GNU Affero General Public License v3.0 |
| Contributions URL (AMO) | https://ko-fi.com/truex |

## Description

```
Read along with an audiobook on YouTube, with subtitles whose words come from the book itself.

1. Open the video. Press SR at the top right of the player.
2. Choose the .srt of that recording.
3. If the video has an intro that your file does not have, play to the first line and press "First line is now". A speed control is there for an upload that runs a little fast or slow.

The subtitles and the settings are kept for each video, so they are there the next time.

No subtitles yet? https://subread.space makes them from the audiobook and its ebook: free, in your browser, nothing uploaded. A small speech model only listens for where the narrator is; the text of each line is the book's own, so names, spelling and punctuation are right. For language learners, and for anyone who wants text and voice together.

Private: the extension does not read, record or download the video or its sound, and it sends nothing anywhere. Its one permission keeps your subtitles in your browser. Open source (AGPL-3.0).
```

## Chrome Web Store: privacy tab

| Question | Answer |
|---|---|
| Single purpose | Shows a subtitle file that the user chooses over the YouTube video player, in time with the video. |
| `storage` justification | Keeps the subtitle file that the user chose, and its timing settings, for each video, in the browser. |
| Host permission (`https://www.youtube.com/*`, content script) | The caption box and its controls are drawn inside the YouTube player, and the script reads the current time of the video element to pick the line. |
| Remote code | No |
| Data usage | Collects none of the listed kinds of data. All three certifications: yes |

## Graphics

`python tools/graphics.py` makes `store/graphics/screenshot-1280x800.png` and
`store/graphics/promo-440x280.png` for Chrome. AMO wants none but shows
screenshots when there are some. The icon is `icons/128.png`.

The screenshot comes from the stand-in page, and its file button shows the
language of the browser that took it. Replace it with a shot of a real YouTube
audiobook, with the panel open and a line on screen.
