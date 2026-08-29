export type Verdict = 'must-read' | 'skim' | 'skip';

export interface SummaryResult {
  /** 一句话总结，≤40 字 */
  tldr: string;
  /** 3-5 条要点 */
  points: string[];
  verdict: Verdict;
  /** 2-4 个关键词 */
  keywords: string[];
  /** 原文金句 */
  bestLine: string;
}

export type ExtractVia = 'readability' | 'fallback' | 'none';

/** content script 回传的抽取结果 */
export interface ExtractedArticle {
  ok: boolean;
  via: ExtractVia;
  url: string;
  title: string;
  byline: string;
  siteName: string;
  text: string;
  reason?: 'not-article';
}

export interface LlmSettings {
  presetId: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface HistoryItem {
  id: string;
  createdAt: number;
  url: string;
  siteName: string;
  title: string;
  byline?: string;
  /** 正常摘要；坏 JSON 降级时缺省 */
  result?: SummaryResult;
  /** 降级的自由摘要文本 */
  raw?: string;
  saved?: boolean;
}

export const VERDICT_INFO: Record<Verdict, { label: string; color: string }> = {
  'must-read': { label: '值得一读', color: '#b5482a' },
  skim: { label: '随便看看', color: '#3f5c4e' },
  skip: { label: '可以跳过', color: '#6f6f66' },
};
