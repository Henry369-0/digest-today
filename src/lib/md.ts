import type { HistoryItem } from '../shared/types';

/**
 * 卡片 → Markdown，直接可贴进笔记：
 * ## 标题 / > TL;DR / - 要点 / #关键词 / 金句 / [原文](url)
 */
export function cardToMarkdown(item: HistoryItem): string {
  const lines: string[] = [];
  lines.push(`## ${item.title}`);
  lines.push('');
  if (item.result) {
    lines.push(`> ${item.result.tldr}`);
    lines.push('');
    for (const p of item.result.points) lines.push(`- ${p}`);
    if (item.result.points.length) lines.push('');
  }
  if (item.raw) {
    lines.push(`> ${item.raw.replace(/\n+/g, ' ')}`);
    lines.push('');
  }
  if (item.result?.keywords.length) {
    lines.push(item.result.keywords.map((k) => `#${k.replace(/\s+/g, '-')}`).join(' '));
    lines.push('');
  }
  if (item.result?.bestLine) {
    lines.push(`> 「${item.result.bestLine}」`);
    lines.push('');
  }
  lines.push(`[原文](${item.url})`);
  return lines.join('\n').trim() + '\n';
}

/** 朗读用的纯文本：标题 + TL;DR + 要点（+金句） */
export function cardToSpeech(item: HistoryItem): string {
  const parts: string[] = [item.title];
  if (item.result?.tldr) parts.push(item.result.tldr);
  if (item.result?.points.length) parts.push(`要点：${item.result.points.join('。')}`);
  if (item.result?.bestLine) parts.push(`原文金句：${item.result.bestLine}`);
  if (item.raw) parts.push(item.raw);
  return parts.filter(Boolean).join('。') + '。';
}

export function shortDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function pngSafeName(item: HistoryItem): string {
  const d = new Date(item.createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const site = (item.siteName || '卡片').replace(/[\\/:*?"<>|\s]+/g, '');
  return `快读-${site}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.png`;
}
