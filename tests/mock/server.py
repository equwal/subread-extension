"""A stand-in for a YouTube watch page, to try the content script by hand:

    python tests/mock/server.py        then open http://localhost:8432/watch?v=mock

It has what the script looks for (#movie_player with a <video>, the /watch?v=
address) and a silent video made in the page, so no media file is needed.
"""
import http.server, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
PAGE = b"""<!doctype html><meta charset=utf-8><title>mock watch page</title>
<link rel=stylesheet href=/src/content.css>
<body style="margin:0;background:#111">
<div id=movie_player style="position:relative;width:960px;height:540px;background:#000;overflow:hidden">
  <video style="width:100%;height:100%" muted loop></video>
</div>
<script>
  // A silent moving picture from a canvas: a video element with a real clock.
  const c = document.createElement('canvas'); c.width = 320; c.height = 180;
  const g = c.getContext('2d'); let n = 0;
  setInterval(() => { g.fillStyle = '#123'; g.fillRect(0, 0, 320, 180); g.fillStyle = '#fff'; g.fillText(String(n++), 10, 20); }, 100);
  const v = document.querySelector('video'); v.srcObject = c.captureStream(10); v.play();
</script>
<script src=/src/srt.js></script><script src=/src/content.js></script>
<script>
  // ?demo : subtitles loaded and the panel open, for a screenshot.
  if (location.search.includes('demo')) setTimeout(() => {
    const srt = '1\\n00:00:00,000 --> 09:00:00,000\\n\\u543e\\u8f29\\u306f\\u732b\\u3067\\u3042\\u308b\\u3002\\u540d\\u524d\\u306f\\u307e\\u3060\\u7121\\u3044\\u3002\\n';
    const input = document.querySelector('.subread-file'), dt = new DataTransfer();
    dt.items.add(new File([srt], 'wagahai.ja.srt')); input.files = dt.files; input.dispatchEvent(new Event('change'));
    document.querySelector('.subread-button').click();
  }, 800);
</script>"""

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT), **k)
    def do_GET(self):
        if self.path.split('?')[0] == '/watch':
            self.send_response(200); self.send_header('Content-Type', 'text/html'); self.end_headers(); self.wfile.write(PAGE)
        else: super().do_GET()

http.server.ThreadingHTTPServer(('127.0.0.1', 8432), Handler).serve_forever()
