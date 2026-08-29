// 注入页面上下文执行（ISOLATED world）：Readability 抽正文 + 回退链。
// 由 popup 通过 chrome.scripting.executeScript({ files: ['content-extract.js'] }) 按需注入，
// 注入后 popup 发 { type: 'DIGEST_EXTRACT' } 消息，这里完成抽取并回传。
// 不做任何网络请求（页面 CORS 会拦），只回传截断后的纯文本。
import { Readability } from '@mozilla/readability';
import type { ExtractedArticle } from '../shared/types';

/** 回传给模型的正文上限 */
const MAX_CHARS = 8000;
/** 回退链正文最短长度：低于此值按"不是文章"处理 */
const MIN_CHARS = 200;
/** 回退链（title + meta description + innerText）截断长度 */
const FALLBACK_CHARS = 3000;

function metaContent(doc: Document, names: string[]): string {
  for (const n of names) {
    const el = doc.querySelector(`meta[name="${n}"], meta[property="${n}"]`);
    const c = el?.getAttribute('content')?.trim();
    if (c) return c;
  }
  return '';
}

function squash(text: string): string {
  return text.replace(/\s*\n\s*/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}

// 回退：title + meta description + body innerText 前 3000 字符
function fallbackExtract(url: string): ExtractedArticle | null {
  const title = document.title?.trim() || '';
  const desc = metaContent(document, ['description', 'og:description', 'twitter:description']);
  const bodyText = squash(document.body?.innerText || document.body?.textContent || '');
  const text = squash(`${desc ? desc + '\n' : ''}${bodyText}`).slice(0, FALLBACK_CHARS);
  if (!title && !text) return null;
  if (text.length < 80) return null; // 太短，基本不是文章
  return {
    ok: true,
    via: 'fallback',
    url,
    title: title || '（无标题）',
    byline: '',
    siteName: '',
    text,
  };
}

function readabilityExtract(url: string): ExtractedArticle | null {
  try {
    const clone = document.cloneNode(true) as Document;
    const parsed = new Readability(clone).parse();
    const text = squash(parsed?.textContent || '');
    if (!parsed || text.length < MIN_CHARS) return null;
    return {
      ok: true,
      via: 'readability',
      url,
      title: parsed.title?.trim() || document.title?.trim() || '（无标题）',
      byline: parsed.byline?.trim() || '',
      siteName: parsed.siteName?.trim() || '',
      text: text.slice(0, MAX_CHARS),
    };
  } catch {
    return null;
  }
}

function extract(): ExtractedArticle {
  const url = location.href;
  const article = readabilityExtract(url) ?? fallbackExtract(url);
  if (article) return article;
  return {
    ok: false,
    via: 'none',
    url,
    title: document.title?.trim() || '',
    byline: '',
    siteName: '',
    text: '',
    reason: 'not-article',
  };
}

// 每次注入都会注册一个监听器；重复注入也幂等（抽取是无副作用的）
chrome.runtime.onMessage.addListener((msg: { type?: string }, _sender, sendResponse) => {
  if (msg?.type === 'DIGEST_EXTRACT') {
    sendResponse(extract());
  }
  return false; // 同步回传，不需要 keepAlive
});
