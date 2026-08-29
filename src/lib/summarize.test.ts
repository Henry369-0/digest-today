import { describe, expect, it } from 'vitest';
import {
  extractJsonBlock,
  normalizeVerdict,
  parseSummary,
  buildUserPrompt,
  SYSTEM_PROMPT,
} from './summarize';

const GOOD = {
  tldr: '作者用十年数据证明番茄工作法对深度工作无效',
  points: ['长任务切换成本被低估', '25 分钟不适合心流', '建议 90 分钟块', '休息也要离屏'],
  verdict: 'must-read',
  keywords: ['生产力', '深度工作'],
  bestLine: '打断的不是时间，是上下文。',
};

describe('parseSummary', () => {
  it('直接解析干净 JSON', () => {
    const out = parseSummary(JSON.stringify(GOOD));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.tldr).toBe(GOOD.tldr);
      expect(out.result.verdict).toBe('must-read');
      expect(out.result.points).toHaveLength(4);
      expect(out.result.bestLine).toContain('上下文');
    }
  });

  it('解析带 ```json 围栏的输出', () => {
    const out = parseSummary('```json\n' + JSON.stringify(GOOD) + '\n```');
    expect(out.ok).toBe(true);
  });

  it('解析前后带闲聊的 JSON（免费小模型常见）', () => {
    const out = parseSummary(`好的，以下是摘要：\n${JSON.stringify(GOOD)}\n希望对你有帮助！`);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.result.verdict).toBe('must-read');
  });

  it('JSON 语法坏了 → 降级为自由文本', () => {
    const broken = '{"tldr":"测试","points":["缺个引号,"verdict":"skip"}';
    const out = parseSummary(broken);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.text).toContain('tldr');
  });

  it('纯文本输出 → 降级，不抛异常', () => {
    const out = parseSummary('这篇文章主要讲了浏览器扩展的 MV3 架构。');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.text).toContain('MV3');
  });

  it('JSON 解析成功但缺 tldr → 降级', () => {
    const out = parseSummary('{"points":["只有要点"],"verdict":"skip"}');
    expect(out.ok).toBe(false);
  });

  it('verdict 非法值归为 skim', () => {
    const out = parseSummary(JSON.stringify({ ...GOOD, verdict: '神作' }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.result.verdict).toBe('skim');
  });

  it('points 超过 5 条裁剪到 5', () => {
    const out = parseSummary(
      JSON.stringify({ ...GOOD, points: ['1', '2', '3', '4', '5', '6', '7'] }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.result.points).toHaveLength(5);
  });

  it('points 是逗号分隔字符串也能拆开', () => {
    const out = parseSummary(JSON.stringify({ ...GOOD, points: '要点一，要点二；要点三' }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.result.points).toEqual(['要点一', '要点二', '要点三']);
  });

  it('keywords 缺省允许为空数组，bestLine 缺省为空串', () => {
    const out = parseSummary(JSON.stringify({ tldr: '只有一句话总结' }));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.keywords).toEqual([]);
      expect(out.result.bestLine).toBe('');
    }
  });
});

describe('normalizeVerdict', () => {
  it('白名单三值原样返回，其余归 skim', () => {
    expect(normalizeVerdict('must-read')).toBe('must-read');
    expect(normalizeVerdict('skim')).toBe('skim');
    expect(normalizeVerdict('skip')).toBe('skip');
    expect(normalizeVerdict('must read')).toBe('skim');
    expect(normalizeVerdict(undefined)).toBe('skim');
    expect(normalizeVerdict(42)).toBe('skim');
  });
});

describe('extractJsonBlock', () => {
  it('能取出第一个配平的 {...} 块', () => {
    expect(extractJsonBlock('前言 {"a":1} 后记')).toBe('{"a":1}');
    expect(extractJsonBlock('x {"a":{"b":"包含}引号}的事"},"c":2} y')).toBe(
      '{"a":{"b":"包含}引号}的事"},"c":2}',
    );
  });

  it('字符串里的花括号不算深度', () => {
    expect(extractJsonBlock('{"s":"}{"}')).toBe('{"s":"}{"}');
  });

  it('没有配平块返回 null', () => {
    expect(extractJsonBlock('{"a":1')).toBeNull();
    expect(extractJsonBlock('没有花括号')).toBeNull();
  });
});

describe('buildUserPrompt', () => {
  it('拼标题 + 元信息 + 截断正文', () => {
    const p = buildUserPrompt({
      ok: true,
      via: 'readability',
      url: 'https://example.com/a',
      title: '标题',
      byline: '作者甲',
      siteName: '示例站',
      text: 'x'.repeat(9000),
    });
    expect(p).toContain('站点：示例站');
    expect(p).toContain('作者：作者甲');
    expect(p).toContain('标题：标题');
    expect(p).toContain('x'.repeat(8000));
    expect(p).not.toContain('x'.repeat(8001));
  });

  it('system prompt 要求只输出 JSON', () => {
    expect(SYSTEM_PROMPT).toContain('只输出一个 JSON 对象');
  });
});
