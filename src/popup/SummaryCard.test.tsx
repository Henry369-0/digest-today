import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { toPng } from 'html-to-image';
import SummaryCard from './SummaryCard';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));
let renderer: ReactTestRenderer | undefined;
afterEach(() => {
  act(() => renderer?.unmount());
  vi.unstubAllGlobals();
});

it('shows a visible PNG export failure and allows a retry', async () => {
  vi.stubGlobal('window', { speechSynthesis: { cancel: vi.fn() } });
  vi.mocked(toPng).mockRejectedValue(new Error('image export failed'));
  act(() => {
    renderer = create(<SummaryCard item={{ id: 'card', createdAt: 0, url: 'https://example.test', siteName: 'Test', title: '测试卡片', raw: '摘要' }} />, { createNodeMock: () => ({}) });
  });
  const pngButton = () => renderer!.root.findAllByType('button').find(button => button.children.includes('存 PNG'))!;
  await act(async () => { await pngButton().props.onClick(); });
  const alerts = renderer!.root.findAll(node => node.props.role === 'alert');
  expect(alerts).toHaveLength(1);
  expect(alerts[0].children.join('')).toContain('导出失败');
  expect(pngButton().props.disabled).toBe(false);
});
