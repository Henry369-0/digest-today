import type { LlmSettings } from '../shared/types';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  retries?: number;
}

export type LlmErrorKind =
  | 'auth'
  | 'rate'
  | 'network'
  | 'server'
  | 'bad-response'
  | 'no-permission';

export class LlmError extends Error {
  kind: LlmErrorKind;
  constructor(message: string, kind: LlmErrorKind) {
    super(message);
    this.kind = kind;
  }
}

export const DEFAULT_TIMEOUT_MS = 30_000;

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + path;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 该端点是否已授予 host 权限（未授权时浏览器会以 CORS 报错拦截 fetch） */
async function hasOriginPermission(baseURL: string): Promise<boolean> {
  try {
    if (typeof chrome === 'undefined' || !chrome.permissions) return true;
    const origin = new URL(baseURL).origin;
    return await chrome.permissions.contains({ origins: [`${origin}/*`] });
  } catch {
    return true;
  }
}

async function requestOnce(
  settings: LlmSettings,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(joinUrl(settings.baseURL, '/chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 600,
      }),
      signal: ctrl.signal,
    });

    if (res.status === 401 || res.status === 403) {
      throw new LlmError('API Key 无效或没有权限，去设置页检查一下', 'auth');
    }
    if (res.status === 429) {
      throw new LlmError('端点限流了（429），稍等几秒再试', 'rate');
    }
    if (!res.ok) {
      throw new LlmError(`端点返回 HTTP ${res.status}，服务可能不稳，稍后再试`, 'server');
    }

    const data: unknown = await res.json();
    const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]
      ?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new LlmError('端点返回里没有找到回复内容，检查模型名是否正确', 'bad-response');
    }
    return content;
  } catch (e) {
    if (e instanceof LlmError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new LlmError(`请求超时（${Math.round((opts.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000)} 秒），端点可能太慢`, 'network');
    }
    // fetch 网络层失败：多半是地址不通，或 host 权限被拒（表现为 CORS）
    if (await hasOriginPermission(settings.baseURL)) {
      throw new LlmError('连不上端点：检查网络、端点地址拼写', 'network');
    }
    throw new LlmError('还没有授权这个端点，去设置页重新保存一次', 'no-permission');
  } finally {
    clearTimeout(timer);
  }
}

const RETRYABLE: LlmErrorKind[] = ['rate', 'network', 'server'];

/** OpenAI 兼容 chat/completions，429/5xx/网络错误指数退避重试 */
export async function chatCompletion(
  settings: LlmSettings,
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<string> {
  const retries = opts.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await requestOnce(settings, messages, opts);
    } catch (e) {
      lastErr = e;
      const kind = e instanceof LlmError ? e.kind : 'network';
      if (!RETRYABLE.includes(kind) || attempt === retries) throw e;
      await sleep(800 * 2 ** attempt + Math.random() * 300);
    }
  }
  throw lastErr;
}

/** 设置页「测试连接」：一条极小请求，通了才允许保存 */
export async function testConnection(settings: LlmSettings): Promise<void> {
  await chatCompletion(
    settings,
    [{ role: 'user', content: '回复 OK 两个字母即可' }],
    { maxTokens: 1, temperature: 0, retries: 0, timeoutMs: 15_000 },
  );
}

export function hostOf(baseURL: string): string {
  try {
    return new URL(baseURL).host;
  } catch {
    return baseURL;
  }
}
