import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import HistoryList from './HistoryList';
import SummaryCard from './SummaryCard';
import type { HistoryItem } from '../shared/types';

vi.mock('./SummaryCard', () => ({ default: () => null }));
vi.mock('./HistoryList', () => ({ default: () => null }));
vi.mock('../lib/summarize', () => ({ summarizeArticle: async () => ({ ok: false, text: '摘要' }) }));
let renderer: ReactTestRenderer | undefined;
let stored: Record<string, unknown>;
const oldSaved: HistoryItem = { id: 'old-saved', createdAt: 1, url: 'https://example.test/old', siteName: 'Test', title: '旧收藏', raw: '旧摘要', saved: true };

beforeEach(() => {
  stored = {
    settings: { presetId: 'ollama', baseURL: 'http://localhost:11434/v1', model: 'test', apiKey: '' },
    history: [...Array.from({ length: 30 }, (_, i) => ({ ...oldSaved, id: `recent-${i}`, saved: false })), oldSaved],
  };
  vi.stubGlobal('chrome', {
    storage: { local: {
      get: async (key: string) => ({ [key]: stored[key] }),
      set: async (value: Record<string, unknown>) => { Object.assign(stored, value); },
    } },
    tabs: {
      query: async () => [{ id: 1, url: 'https://example.test/article' }],
      sendMessage: async () => ({ ok: true, via: 'readability', url: 'https://example.test/article', siteName: 'Test', title: '新文章', text: '文章正文', byline: '' }),
    },
    scripting: { executeScript: async () => [] },
  });
});
afterEach(() => { act(() => renderer?.unmount()); vi.unstubAllGlobals(); });

async function openHistory() {
  await act(async () => { renderer = create(<App />); });
  await act(async () => { await renderer!.root.findByType(SummaryCard).props.onOpenHistory(); });
}

it('synchronizes the list with storage when cancelling an old bookmark prunes it', async () => {
  await openHistory();
  expect(renderer!.root.findByType(HistoryList).props.items).toHaveLength(31);
  await act(async () => { await renderer!.root.findByType(HistoryList).props.onToggleSave(oldSaved); });
  const items = renderer!.root.findByType(HistoryList).props.items;
  expect(items).toEqual(stored.history);
  expect(items).toHaveLength(30);
  expect(items.some((item: HistoryItem) => item.id === oldSaved.id)).toBe(false);
});

it('returns from a pruned saved card to the retained history list', async () => {
  await openHistory();
  act(() => renderer!.root.findByType(HistoryList).props.onOpen(oldSaved));
  await act(async () => { await renderer!.root.findByType(SummaryCard).props.onToggleSave(oldSaved); });
  expect(renderer!.root.findAllByType(SummaryCard)).toHaveLength(0);
  expect(renderer!.root.findByType(HistoryList).props.items).toEqual(stored.history);
});
