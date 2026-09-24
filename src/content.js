/* Your own subtitles over a YouTube video.
 *
 * The extension reads an .srt that you give it, and shows each line over the
 * player in time with the video. It does not read, record or download the
 * video or its sound, and it sends nothing anywhere: the subtitles stay in
 * this browser, kept for each video so that they are there the next time.
 */
(function () {
  'use strict';
  if (window.__subreadLoaded) return;
  window.__subreadLoaded = true;

  const { parse, cueAt, subtitleTime, videoTime } = globalThis.SubReadSrt;
  const store = (typeof chrome !== 'undefined' && chrome.storage?.local) || null;
  const KEEP = 8;                     // videos whose subtitles are kept
  const DEFAULTS = { offset: 0, rate: 1, size: 26, shown: true, transcript: false };

  let videoId = null, cues = [], settings = { ...DEFAULTS }, fileName = '';
  let box, panel, button, line, status, shownCue = null;

  // The transcript panel: built once, moved in and out of the page as needed.
  let transcriptPanel, transcriptList, transcriptRowByCue = new WeakMap();
  let transcriptCuesRef = null, transcriptClock = { offset: NaN, rate: NaN };
  let transcriptCurrentRow = null, transcriptUserScrollAt = 0, transcriptLastAutoScroll = 0;

  const get = (key) => new Promise((done) => (store ? store.get(key, (v) => done(v?.[key])) : done(undefined)));
  const set = (key, value) => new Promise((done) => (store ? store.set({ [key]: value }, done) : done()));
  const remove = (key) => new Promise((done) => (store ? store.remove(key, done) : done()));

  const currentId = () => (location.pathname === '/watch' ? new URLSearchParams(location.search).get('v') : null);
  const player = () => document.querySelector('#movie_player');
  const video = () => document.querySelector('#movie_player video');

  function el(tag, props = {}, children = []) {
    const node = Object.assign(document.createElement(tag), props);
    for (const c of children) node.append(c);
    return node;
  }

  /* ------------------------------------------------------------------ build */

  function build() {
    const host = player();
    if (!host || host.querySelector('.subread-box')) return !!host;

    line = el('span', { className: 'subread-line' });
    box = el('div', { className: 'subread-box' }, [line]);

    status = el('div', { className: 'subread-status' });
    const file = el('input', { type: 'file', accept: '.srt,.vtt,text/plain', className: 'subread-file' });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      await load(await f.text(), f.name);
      file.value = '';
    });

    const nudge = (label, title, by) => {
      const b = el('button', { type: 'button', textContent: label, title });
      b.addEventListener('click', () => change({ offset: Math.round((settings.offset + by) * 10) / 10 }));
      return b;
    };
    const offsetOut = el('output', { className: 'subread-offset' });
    const here = el('button', { type: 'button', textContent: 'First line is now',
      title: 'Play to where the narrator reads the first line of the subtitles, then press this' });
    here.addEventListener('click', () => {
      if (cues.length && video()) change({ offset: Math.round((video().currentTime - cues[0].start / settings.rate) * 10) / 10 });
    });

    const rate = el('input', { type: 'number', step: '0.0005', min: '0.9', max: '1.1', className: 'subread-rate',
      title: 'Above 1 if the subtitles fall behind as the book goes on; below 1 if they run ahead' });
    rate.addEventListener('change', () => change({ rate: Math.min(1.1, Math.max(0.9, +rate.value || 1)) }));
    const size = el('input', { type: 'range', min: '14', max: '48', className: 'subread-size', title: 'Text size' });
    size.addEventListener('input', () => change({ size: +size.value }));
    const shown = el('input', { type: 'checkbox' });
    shown.addEventListener('change', () => change({ shown: shown.checked }));
    const transcript = el('input', { type: 'checkbox' });
    transcript.addEventListener('change', () => change({ transcript: transcript.checked }));
    const forget = el('button', { type: 'button', textContent: 'Remove' });
    forget.addEventListener('click', async () => { await remove('v:' + videoId); cues = []; fileName = ''; render(); });

    panel = el('div', { className: 'subread-panel', hidden: true }, [
      el('div', { className: 'subread-title', textContent: 'SubRead: your subtitles' }),
      status,
      el('label', { className: 'subread-row' }, ['Subtitles (.srt) ', file]),
      el('div', { className: 'subread-row' }, ['Start ', nudge('−1s', 'Subtitles earlier', -1), nudge('−0.1', 'Subtitles earlier', -0.1),
        offsetOut, nudge('+0.1', 'Subtitles later', 0.1), nudge('+1s', 'Subtitles later', 1)]),
      el('div', { className: 'subread-row' }, [here]),
      el('label', { className: 'subread-row' }, ['Speed ', rate]),
      el('label', { className: 'subread-row' }, ['Size ', size]),
      el('label', { className: 'subread-row' }, [shown, ' Show', ' ', transcript, ' Transcript', ' ', forget]),
      el('div', { className: 'subread-row subread-help' }, [
        'No subtitles for this book? ',
        el('a', { href: 'https://subread.space', target: '_blank', rel: 'noopener', textContent: 'Make them from the audiobook and its ebook' }),
        ': free, in your browser.',
      ]),
    ]);
    panel._controls = { offsetOut, rate, size, shown, transcript };
    for (const type of ['click', 'dblclick', 'keydown', 'keyup', 'keypress', 'wheel']) {
      panel.addEventListener(type, (e) => e.stopPropagation());       // or the player takes the keys and the clicks
    }

    button = el('button', { type: 'button', className: 'subread-button', textContent: 'SR', title: 'SubRead: your subtitles' });
    button.addEventListener('click', (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; });

    host.append(box, button, panel);
    return true;
  }

  /* ------------------------------------------------------------- transcript */

  // m:ss, or h:mm:ss past the first hour.
  function stamp(t) {
    t = Math.max(0, Math.round(t));
    const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
  }

  function buildTranscript() {
    const list = el('div', { className: 'subread-transcript-list' });
    list.addEventListener('scroll', () => {
      // Setting scrollTop ourselves also fires 'scroll'; tell it apart by when it happened.
      if (Date.now() - transcriptLastAutoScroll > 150) transcriptUserScrollAt = Date.now();
    });
    const close = el('button', { type: 'button', className: 'subread-transcript-close', textContent: '×', title: 'Close the transcript' });
    close.addEventListener('click', () => change({ transcript: false }));
    const header = el('div', { className: 'subread-transcript-header' }, [
      el('span', { className: 'subread-transcript-title', textContent: 'SubRead transcript' }),
      close,
    ]);
    transcriptPanel = el('div', { className: 'subread-transcript' }, [header, list]);
    transcriptList = list;
  }

  // Put the panel at the top of the related-videos column, or below the player when that column is not there.
  function attachTranscript() {
    const side = document.querySelector('#secondary-inner') || document.querySelector('#secondary');
    if (side) { side.insertBefore(transcriptPanel, side.firstChild); return; }
    const below = document.querySelector('#below');
    if (below) below.insertBefore(transcriptPanel, below.firstChild);
  }

  // One row per cue, with the cue's start shown on the clock of the video.
  function renderTranscriptRows() {
    transcriptList.textContent = '';
    transcriptRowByCue = new WeakMap();
    transcriptCurrentRow = null;
    for (const cue of cues) {
      const time = el('span', { className: 'subread-transcript-stamp', textContent: stamp(videoTime(cue.start, settings.offset, settings.rate)) });
      const text = el('span', { className: 'subread-transcript-text', textContent: cue.text });
      const row = el('div', { className: 'subread-transcript-row' }, [time, text]);
      row.addEventListener('click', () => { const v = video(); if (v) v.currentTime = videoTime(cue.start, settings.offset, settings.rate); });
      transcriptList.append(row);
      transcriptRowByCue.set(cue, row);
    }
  }

  // The Start offset or Speed changed: the video time shown for each cue moves, but not the rows.
  function updateTranscriptStamps() {
    const rows = transcriptList.children;
    cues.forEach((cue, i) => { rows[i].firstChild.textContent = stamp(videoTime(cue.start, settings.offset, settings.rate)); });
  }

  // Build, attach, and fill the panel if the toggle is on and there are cues; else take it down.
  function ensureTranscript() {
    const want = settings.transcript && cues.length > 0;
    if (!want) { if (transcriptPanel) transcriptPanel.remove(); return; }
    if (!transcriptPanel) buildTranscript();
    if (!transcriptPanel.isConnected) attachTranscript();
    if (transcriptCuesRef !== cues) {
      renderTranscriptRows();
      transcriptCuesRef = cues;
      transcriptClock = { offset: settings.offset, rate: settings.rate };
    } else if (transcriptClock.offset !== settings.offset || transcriptClock.rate !== settings.rate) {
      updateTranscriptStamps();
      transcriptClock = { offset: settings.offset, rate: settings.rate };
    }
  }

  // Highlight the row of the cue on screen now, and scroll it into view unless the user just scrolled the list.
  function highlightTranscript(cue) {
    if (!transcriptPanel || !transcriptPanel.isConnected) return;
    const row = cue ? transcriptRowByCue.get(cue) : null;
    if (row === transcriptCurrentRow) return;
    if (transcriptCurrentRow) transcriptCurrentRow.classList.remove('subread-current');
    transcriptCurrentRow = row || null;
    if (!row) return;
    row.classList.add('subread-current');
    if (Date.now() - transcriptUserScrollAt < 4000) return;
    const list = transcriptList;
    const target = Math.max(0, Math.min(row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2, list.scrollHeight - list.clientHeight));
    if (Math.abs(list.scrollTop - target) < 1) return;
    transcriptLastAutoScroll = Date.now();
    list.scrollTop = target;
  }

  /* ------------------------------------------------------------------- state */

  async function load(source, name) {
    const parsed = parse(source);
    if (!parsed.length) { status.textContent = `No subtitles could be read from ${name}.`; return; }
    cues = parsed;
    fileName = name;
    settings = { ...settings, shown: true };
    await save();
    render();
  }

  async function save() {
    if (!videoId) return;
    await set('v:' + videoId, { cues, fileName, settings, at: Date.now() });
    // Keep the newest few: a book of subtitles is megabytes.
    const index = ((await get('index')) || []).filter((id) => id !== videoId);
    index.unshift(videoId);
    for (const old of index.splice(KEEP)) await remove('v:' + old);
    await set('index', index);
  }

  function change(patch) {
    settings = { ...settings, ...patch };
    render();
    if (cues.length) save();
  }

  function render() {
    if (!panel) return;
    const c = panel._controls;
    c.offsetOut.textContent = `${settings.offset >= 0 ? '+' : ''}${settings.offset.toFixed(1)} s`;
    c.rate.value = settings.rate;
    c.size.value = settings.size;
    c.shown.checked = settings.shown;
    c.transcript.checked = settings.transcript;
    status.textContent = cues.length ? `${fileName}: ${cues.length} lines` : 'Choose the .srt of this video.';
    box.style.fontSize = settings.size + 'px';
    button.classList.toggle('subread-on', cues.length > 0 && settings.shown);
    shownCue = undefined;               // draw again
    ensureTranscript();
    tick();
  }

  function tick() {
    const v = video();
    if (!box || !v) return;
    const cue = cues.length ? cueAt(cues, subtitleTime(v.currentTime, settings.offset, settings.rate)) : null;
    highlightTranscript(cue);
    const shown = settings.shown ? cue : null;
    if (shown === shownCue) return;
    shownCue = shown;
    line.textContent = shown ? shown.text : '';
    box.hidden = !shown;
  }

  async function arrive() {
    const id = currentId();
    if (id === videoId && box?.isConnected) return;
    videoId = id;
    cues = []; fileName = ''; settings = { ...DEFAULTS };
    if (!id) { if (box) box.hidden = true; return; }
    if (!build()) return;
    const saved = await get('v:' + id);
    if (saved && id === videoId) ({ cues, fileName } = saved), (settings = { ...DEFAULTS, ...saved.settings });
    render();
  }

  // YouTube changes pages without loading a new one, and builds its player late.
  document.addEventListener('yt-navigate-finish', arrive);
  setInterval(() => {
    if (currentId() && (!box || !box.isConnected || currentId() !== videoId)) { arrive(); return; }
    // The related-videos column can be rebuilt (theatre mode, layout change) without a navigation.
    if (transcriptPanel && settings.transcript && !transcriptPanel.isConnected) ensureTranscript();
  }, 1500);
  setInterval(tick, 100);
  arrive();
})();
