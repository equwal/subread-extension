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

  const { parse, cueAt, subtitleTime } = globalThis.SubReadSrt;
  const store = (typeof chrome !== 'undefined' && chrome.storage?.local) || null;
  const KEEP = 8;                     // videos whose subtitles are kept
  const DEFAULTS = { offset: 0, rate: 1, size: 26, shown: true };

  let videoId = null, cues = [], settings = { ...DEFAULTS }, fileName = '';
  let box, panel, button, line, status, shownCue = null;

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
      el('label', { className: 'subread-row' }, [shown, ' Show', ' ', forget]),
      el('div', { className: 'subread-row subread-help' }, [
        'No subtitles for this book? ',
        el('a', { href: 'https://subread.space', target: '_blank', rel: 'noopener', textContent: 'Make them from the audiobook and its ebook' }),
        ': free, in your browser.',
      ]),
    ]);
    panel._controls = { offsetOut, rate, size, shown };
    for (const type of ['click', 'dblclick', 'keydown', 'keyup', 'keypress', 'wheel']) {
      panel.addEventListener(type, (e) => e.stopPropagation());       // or the player takes the keys and the clicks
    }

    button = el('button', { type: 'button', className: 'subread-button', textContent: 'SR', title: 'SubRead: your subtitles' });
    button.addEventListener('click', (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; });

    host.append(box, button, panel);
    return true;
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
    status.textContent = cues.length ? `${fileName}: ${cues.length} lines` : 'Choose the .srt of this video.';
    box.style.fontSize = settings.size + 'px';
    button.classList.toggle('subread-on', cues.length > 0 && settings.shown);
    shownCue = undefined;               // draw again
    tick();
  }

  function tick() {
    const v = video();
    if (!box || !v) return;
    const cue = cues.length && settings.shown ? cueAt(cues, subtitleTime(v.currentTime, settings.offset, settings.rate)) : null;
    if (cue === shownCue) return;
    shownCue = cue;
    line.textContent = cue ? cue.text : '';
    box.hidden = !cue;
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
  setInterval(() => { if (currentId() && (!box || !box.isConnected || currentId() !== videoId)) arrive(); }, 1500);
  setInterval(tick, 100);
  arrive();
})();
