import { describe, expect, it } from 'vitest';
import { cardToMarkdown, cardToSpeech, pngSafeName } from './md';
import type { HistoryItem } from '../shared/types';

const ITEM: HistoryItem = {
  id: 'test-id',
  // 本地时区构造，测试不随机器时区漂移
  createdAt: new Date(2026, 7, 29, 10, 0, 0).getTime(),
  url: 'https://example.com/post/1',
  siteName: '示例站',
  title: '一篇关于浏览器扩展的文章',
  byline: '作者甲',
  result: {
    tldr: 'MV3 架构下扩展要走按需注入的路子',
    points: ['activeTab 最小权限', '正文在页面里抽取', '坏 JSON 要兜底'],
    verdict: 'must-read',
    keywords: ['浏览器扩展', 'MV3'],
    bestLine: '权限即知情同意。',
  },
};

describe('cardToMarkdown', () => {
  it('按 标题/TLDR/要点/关键词/金句/原文 结构输出', () => {
    const md = cardToMarkdown(ITEM);
    expect(md).toContain('## 一篇关于浏览器扩展的文章');
    expect(md).toContain('> MV3 架构下扩展要走按需注入的路子');
    expect(md).toContain('- activeTab 最小权限');
    expect(md).toContain('#浏览器扩展 #MV3');
    expect(md).toContain('> 「权限即知情同意。」');
    expect(md).toContain('[原文](https://example.com/post/1)');
  });

  it('带空格的关键词转连字符，防止碎成两个 tag', () => {
    const md = cardToMarkdown({
      ...ITEM,
      result: { ...ITEM.result!, keywords: ['deep work', 'MV3'] },
    });
    expect(md).toContain('#deep-work #MV3');
  });

  it('降级卡片（无 result，有 raw）也能出 Markdown', () => {
    const md = cardToMarkdown({ ...ITEM, result: undefined, raw: '这是一段自由摘要。' });
    expect(md).toContain('> 这是一段自由摘要。');
    expect(md).not.toContain('#浏览器扩展');
    expect(md).toContain('[原文](https://example.com/post/1)');
  });
});

describe('cardToSpeech', () => {
  it('标题 + TLDR + 要点串成可读文本', () => {
    const s = cardToSpeech(ITEM);
    expect(s).toContain('一篇关于浏览器扩展的文章');
    expect(s).toContain('要点：');
    expect(s).toContain('activeTab 最小权限。正文在页面里抽取');
  });

  it('降级卡片朗读 raw 文本', () => {
    const s = cardToSpeech({ ...ITEM, result: undefined, raw: '自由摘要内容' });
    expect(s).toContain('自由摘要内容');
  });
});

describe('pngSafeName', () => {
  it('文件名安全：站点名去掉非法字符，带日期', () => {
    expect(pngSafeName(ITEM)).toBe('快读-示例站-20260829.png');
    expect(
      pngSafeName({ ...ITEM, siteName: '36氪/后天?', createdAt: new Date(2020, 0, 2).getTime() }),
    ).toBe('快读-36氪后天-20200102.png');
    expect(pngSafeName({ ...ITEM, siteName: '' })).toBe('快读-卡片-20260829.png');
  });
});
