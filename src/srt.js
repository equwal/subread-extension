/* Subtitles as data: read an .srt (or .vtt), and find the cue for a moment of
 * the video. No browser APIs here, so Node can test it.
 *
 * The video on YouTube is often not the same file as the audio the subtitles
 * were made from: an intro was added, or the speed differs a little. So the
 * time of the video is first moved onto the clock of the subtitles:
 *
 *     subtitle time = (video time - offset) * rate
 *
 * The transcript panel needs the other way round, from a cue's time back to a
 * video time to seek to:
 *
 *     video time = subtitle time / rate + offset
 */
(function (root) {
  'use strict';

  const STAMP = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

  function seconds(stamp) {
    const m = STAMP.exec(stamp);
    if (!m) return NaN;
    return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4].padEnd(3, '0')) / 1000;
  }

  /** Cues in order of start: [{ start, end, text }]. Blocks that are not cues are passed over. */
  function parse(source) {
    const cues = [];
    const blocks = String(source).replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
    for (const block of blocks) {
      const lines = block.split('\n');
      const at = lines.findIndex((l) => l.includes('-->'));
      if (at < 0) continue;
      const [from, to] = lines[at].split('-->');
      const start = seconds(from), end = seconds(to);
      const text = lines.slice(at + 1).join('\n').replace(/<[^>]*>/g, '').trim();
      if (Number.isFinite(start) && Number.isFinite(end) && end > start && text) cues.push({ start, end, text });
    }
    return cues.sort((a, b) => a.start - b.start);
  }

  /** The cue that is on at `t` (seconds on the clock of the subtitles), or null. */
  function cueAt(cues, t) {
    let lo = 0, hi = cues.length - 1, found = -1;
    while (lo <= hi) {                       // the last cue that starts at or before t
      const mid = (lo + hi) >> 1;
      if (cues[mid].start <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    // Cues can overlap a little; the latest one that is still on wins.
    for (let i = found; i >= 0 && i > found - 4; i--) if (t < cues[i].end) return cues[i];
    return null;
  }

  const subtitleTime = (videoT, offset, rate) => (videoT - offset) * rate;

  // The inverse: a moment on the clock of the subtitles, back to a moment of the video.
  // Used by the transcript panel to seek: videoTime(subtitleTime(t, offset, rate), offset, rate) is t.
  const videoTime = (subTime, offset, rate) => subTime / rate + offset;

  const api = { parse, cueAt, subtitleTime, videoTime, seconds };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SubReadSrt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
