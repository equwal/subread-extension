// Load an .srt into SubRead on a video, seek, and save a 1280x800 screenshot.
// args: url srtPath seconds outPng panel(0|1)
import { writeFileSync } from 'node:fs';
export default async (p, [url, srt, seconds, out, panel = '0']) => {
  await p.send('Page.enable');
  await p.send('DOM.enable');
  await p.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await p.send('Page.navigate', { url });
  await p.sleep(3000);
  await p.evaluate(`(async () => {
    for (let i = 0; i < 40 && !(document.querySelector('video') && document.querySelector('.subread-button')); i++) await new Promise(r => setTimeout(r, 500));
    const v = document.querySelector('video'); v.pause();
    const cc = document.querySelector('.ytp-subtitles-button');
    if (cc?.getAttribute('aria-pressed') === 'true') cc.click();
    if (!document.querySelector('ytd-watch-flexy[theater]')) document.querySelector('.ytp-size-button')?.click();
    await new Promise(r => setTimeout(r, 1500));
    document.querySelector('.subread-button').click();
  })()`);
  const { result } = await p.send('Runtime.evaluate', { expression: `document.querySelector('.subread-file')` });
  await p.send('DOM.setFileInputFiles', { files: [srt], objectId: result.objectId });
  await p.sleep(1000);
  const status = await p.evaluate(`(async () => {
    const v = document.querySelector('video');
    v.currentTime = ${Number(seconds)};
    await new Promise(r => v.addEventListener('seeked', r, { once: true }));
    v.pause();
    ${panel === '1' ? '' : "document.querySelector('.subread-button').click();"}
    window.scrollTo(0, 0);
    document.querySelector('#movie_player')?.dispatchEvent(new MouseEvent('mouseleave'));
    await new Promise(r => setTimeout(r, 2500));
    return [document.querySelector('.subread-status')?.textContent, document.querySelector('.subread-line')?.textContent].join(' | ');
  })()`);
  const shot = await p.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  return status;
};
