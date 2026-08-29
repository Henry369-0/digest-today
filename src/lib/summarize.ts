import type { ExtractedArticle, LlmSettings, SummaryResult, Verdict } from '../shared/types';
import { chatCompletion, type ChatOptions } from './llm';

/** 送入模型的正文上限（在页面里已截断过，这里兜底） */
export const MAX_CHARS = 8000;

export const SYSTEM_PROMPT = `你是编辑部摘要员。基于给定文章正文，只输出一个 JSON 对象，格式：
{"tldr":"一句话总结，≤40字",
 "points":["要点1","要点2","要点3"],
 "verdict":"must-read|skim|skip",
 "keywords":["关键词","关键词"],
 "bestLine":"原文中最值得记住的一句话"}
要求：tldr 不超过 40 字；points 为 3-5 条、忠实原文、不编造；信息量低就给 skip；keywords 2-4 个；bestLine 必须是原文中出现过的句子。用中文输出，不要输出 JSON 以外的任何文字。`;

export function buildUserPrompt(article: ExtractedArticle): string {
  const meta = [
    article.siteName && `站点：${article.siteName}`,
    article.byline && `作者：${article.byline}`,
  ]
    .filter(Boolean)
    .join('\n');
  const text = article.text.slice(0, MAX_CHARS);
  return `${meta ? meta + '\n' : ''}标题：${article.title}\n\n正文：\n${text}`;
}

// ---------- 容错解析 ----------

export interface ParseOk {
  ok: true;
  result: SummaryResult;
}
export interface ParseFail {
  ok: false;
  /** 降级为自由摘要的纯文本 */
  text: string;
}
export type ParseOutcome = ParseOk | ParseFail;

export function normalizeVerdict(v: unknown): Verdict {
  return v === 'must-read' || v === 'skim' || v === 'skip' ? v : 'skim';
}

function toList(v: unknown, max: number): string[] {
  const arr = Array.isArray(v)
    ? v
    : typeof v === 'string'
      ? v.split(/[,，;；、\n]+/)
      : [];
  return arr
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, max);
}

/** 去掉 ```json 围栏 */
function stripFences(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return m ? m[1] : text;
}

/** 找第一个配平的 {...} 块（考虑字符串与转义），比裸正则稳 */
export function extractJsonBlock(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * 三级容错：直接 parse → 摘出 {...} 再 parse → 降级纯文本。
 * 解析成功但 tldr 缺失/为空，视为解析失败（降级）。
 */
export function parseSummary(raw: string): ParseOutcome {
  const cleaned = stripFences(raw.trim());
  const candidates = [cleaned, extractJsonBlock(cleaned)];
  for (const c of candidates) {
    if (!c) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(c);
    } catch {
      continue;
    }
    if (!obj || typeof obj !== 'object') continue;
    const r = obj as Record<string, unknown>;
    const tldr = typeof r.tldr === 'string' ? r.tldr.trim() : '';
    if (!tldr) continue;
    const points = toList(r.points, 5);
    const keywords = toList(r.keywords, 4);
    return {
      ok: true,
      result: {
        tldr,
        points,
        verdict: normalizeVerdict(r.verdict),
        keywords,
        bestLine: typeof r.bestLine === 'string' ? r.bestLine.trim() : '',
      },
    };
  }
  const text = cleaned
    .replace(/^好的?[，,！!.。:]?\s*/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { ok: false, text: text || raw.trim() };
}

export async function summarizeArticle(
  settings: LlmSettings,
  article: ExtractedArticle,
  opts?: ChatOptions,
): Promise<ParseOutcome> {
  const raw = await chatCompletion(
    settings,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(article) },
    ],
    opts,
  );
  return parseSummary(raw);
}
