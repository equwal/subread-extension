/* node --test tests */
const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, cueAt, subtitleTime, videoTime, seconds } = require('../src/srt.js');

test('an .srt is read: numbers, stamps, text of more than one line, tags removed', () => {
  const cues = parse('﻿1\r\n00:00:01,500 --> 00:00:04,000\r\nIt was a <i>dark</i> night;\r\nthe rain fell.\r\n\r\n' +
    '2\r\n01:02:03,004 --> 01:02:05,000\r\n吾輩は猫である。\r\n');
  assert.deepEqual(cues, [
    { start: 1.5, end: 4, text: 'It was a dark night;\nthe rain fell.' },
    { start: 3723.004, end: 3725, text: '吾輩は猫である。' },
  ]);
});

test('the text of each checked language is kept as it is: accents, inverted marks, quotes, kana', () => {
  const lines = {
    en: 'It was a dark night; the rain fell.',
    pt: '— Não me parece bonito — disse ela, à porta.',
    es: '¿Qué es esto? ¡Ñandú, señor Quijote!',
    ru: '«Ёлка, — сказал он, — и её огни».',
    ja: '「女のいない男たち」　東京で暮らしている。',
  };
  const source = Object.values(lines).map((text, i) => `${i + 1}\n00:00:0${i},000 --> 00:00:0${i},900\n${text}\n`).join('\n');
  const cues = parse(source);
  assert.deepEqual(cues.map((c) => c.text), Object.values(lines));
  Object.values(lines).forEach((text, i) => assert.equal(cueAt(cues, i + 0.5).text, text));
});

test('a .vtt is read too, and what is not a cue is passed over', () => {
  const cues = parse('WEBVTT\n\nNOTE made by hand\n\n00:01.000 --> 00:02.5\nHello\n\nbroken --> block\nx\n\n3\n00:00:09,000 --> 00:00:08,000\nends before it starts\n');
  assert.deepEqual(cues, [{ start: 1, end: 2.5, text: 'Hello' }]);
});

test('stamps', () => {
  assert.equal(seconds('00:00:00,004'), 0.004);
  assert.equal(seconds('10:00:00.5'), 36000.5);
  assert.ok(Number.isNaN(seconds('soon')));
});

test('the cue for a moment is the one a slow search finds, for any cues and any moment', () => {
  let seed = 11;
  const random = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  for (let round = 0; round < 300; round++) {
    const cues = [];
    let t = random() * 5;
    for (let i = 0; i < Math.floor(random() * 40); i++) {
      const start = t, end = start + 0.2 + random() * 5;
      cues.push({ start, end, text: String(i) });
      t = end + (random() < 0.5 ? 0 : random() * 3);        // back to back, or a gap
    }
    for (let k = 0; k < 60; k++) {
      const at = random() * (t + 5) - 1;
      const slow = cues.filter((c) => c.start <= at && at < c.end).pop() ?? null;
      assert.equal(cueAt(cues, at), slow);
    }
  }
  assert.equal(cueAt([], 3), null);
});

test('a cue that overlaps the one after it gives way to the later one', () => {
  const cues = [{ start: 0, end: 10, text: 'long' }, { start: 4, end: 6, text: 'short' }];
  assert.equal(cueAt(cues, 5).text, 'short');
  assert.equal(cueAt(cues, 8).text, 'long');
});

test('the time of the video is moved onto the clock of the subtitles', () => {
  assert.equal(subtitleTime(100, 0, 1), 100);
  assert.equal(subtitleTime(100, 12.5, 1), 87.5);            // the upload has a 12.5 s intro
  assert.ok(Math.abs(subtitleTime(3600, 0, 1.001) - 3603.6) < 1e-9);   // and runs a little slow
});

test('the transcript panel moves a cue time back onto the clock of the video', () => {
  assert.equal(videoTime(100, 0, 1), 100);
  assert.equal(videoTime(87.5, 12.5, 1), 100);               // the 12.5 s intro comes back
  assert.ok(Math.abs(videoTime(3603.6, 0, 1.001) - 3600) < 1e-9);
});

test('videoTime undoes subtitleTime, and subtitleTime undoes videoTime, for many offsets and rates', () => {
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  for (let round = 0; round < 500; round++) {
    const offset = (random() - 0.5) * 40;         // seconds, either side of 0
    const rate = 0.9 + random() * 0.2;            // the panel limits rate to 0.9 .. 1.1
    const videoT = random() * 7200;               // up to two hours in
    const subT = subtitleTime(videoT, offset, rate);
    assert.ok(Math.abs(videoTime(subT, offset, rate) - videoT) < 1e-9);
    assert.ok(Math.abs(subtitleTime(videoTime(subT, offset, rate), offset, rate) - subT) < 1e-9);
  }
});
