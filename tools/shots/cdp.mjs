// Minimal CDP client for the Brave instance on port 9334.
// Usage: node cdp.mjs <script.mjs>  — the script default-exports async (page) => result.
const port = 9334;
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
let target = targets.find(t => t.type === 'page');
if (!target) target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const listeners = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  else listeners.forEach(f => f(m));
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const page = { send, sleep, evaluate, listeners };
const mod = await import(new URL(process.argv[2], `file:///${process.cwd().replace(/\\/g, '/')}/`).href);
try { const out = await mod.default(page, process.argv.slice(3)); if (out !== undefined) console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1)); }
finally { ws.close(); }
