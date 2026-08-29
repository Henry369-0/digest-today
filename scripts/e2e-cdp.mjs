// E2E 验收驱动：通过 CDP 控制带 --remote-debugging-port=9223 的临时 Edge 实例。
// 用法：node scripts/e2e-cdp.mjs setup|article|verify|storagewipe
// 注意：点「保存」用的是 Input.dispatchMouseEvent（真实输入事件，带用户手势），
// 这样扩展里的 chrome.permissions.request 才能弹出授权框。
const CDP_HTTP = 'http://127.0.0.1:9223';
const EXT_ID = 'cidibnnopgedcmjolinnokcdjbbbiemo';
const OPTIONS_URL = `chrome-extension://${EXT_ID}/src/options/index.html`;
const ARTICLE_URL = 'http://127.0.0.1:11434/article';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
let msgId = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJs(expression) {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) throw new Error('page eval failed: ' + JSON.stringify(res.exceptionDetails).slice(0, 300));
  return res.result?.value;
}

async function main() {
  const mode = process.argv[2] ?? 'setup';
  const targets = await (await fetch(`${CDP_HTTP}/json`)).json();
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error('ws error'));
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');

  if (mode === 'setup') {
    await send('Page.navigate', { url: OPTIONS_URL });
    await sleep(1800);
    const info = await evalJs(`(() => {
      const sel = document.querySelector('select');
      sel.value = 'ollama';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      const inputs = [...document.querySelectorAll('input')];
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('保存'));
      const r = btn.getBoundingClientRect();
      return {
        preset: sel.value,
        baseURL: inputs[0].value,
        model: inputs[1].value,
        keyEmpty: inputs[2].value === '',
        btn: { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) },
      };
    })()`);
    console.log('form:', JSON.stringify(info));
    if (info.preset !== 'ollama' || !info.baseURL.includes('11434') || !info.keyEmpty) {
      throw new Error('表单状态不符合预期，中止');
    }
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...info.btn, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...info.btn, button: 'left', clickCount: 1 });
    console.log('save clicked at', JSON.stringify(info.btn), '→ 应已弹出授权框');
  }

  if (mode === 'article') {
    await send('Target.createTarget', { url: ARTICLE_URL, background: false });
    await sleep(1500);
    console.log('article tab opened & activated');
  }

  if (mode === 'verify') {
    const data = await evalJs(`(async () => {
      const o = await chrome.storage.local.get(null);
      return o;
    })()`);
    console.log(JSON.stringify(data, null, 2));
  }

  if (mode === 'storagewipe') {
    await evalJs(`(async () => { await chrome.storage.local.clear(); })()`);
    console.log('storage cleared');
  }

  ws.close();
}

main().catch((e) => {
  console.error('E2E-ERROR:', e.message);
  process.exit(1);
});
