import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryItem } from '../shared/types';
import { addHistory, getHistory, toggleSaved } from './storage';

let stored: Record<string, unknown>;
const item = (id: string, saved = false): HistoryItem => ({ id, createdAt: Number(id) || 0, url: 'https://example.test/article', siteName: 'Test', title: id, raw: '摘要', saved });

beforeEach(() => {
  stored = {};
  vi.stubGlobal('chrome', { storage: { local: {
    get: async (key: string | null) => key ? { [key]: stored[key] } : { ...stored },
    set: async (value: Record<string, unknown>) => { Object.assign(stored, value); },
  } } });
});
afterEach(() => vi.unstubAllGlobals());

describe('history retention', () => {
  it('keeps older saved cards when 30 unsaved cards have accumulated', async () => {
    stored.history = [...Array.from({ length: 30 }, (_, i) => item(String(30 - i))), item('saved', true)];
    await addHistory(item('31'));
    const history = await getHistory();
    expect(history.some(card => card.id === 'saved' && card.saved)).toBe(true);
    expect(history.filter(card => !card.saved)).toHaveLength(30);
    expect(history.some(card => card.id === '1')).toBe(false);
  });

  it('keeps all saved cards even when there are more than 30', async () => {
    stored.history = Array.from({ length: 35 }, (_, i) => item(`saved-${i}`, true));
    await addHistory(item('new'));
    const history = await getHistory();
    expect(history.filter(card => card.saved)).toHaveLength(35);
    expect(history.filter(card => !card.saved)).toHaveLength(1);
  });

  it('reapplies the recent-card limit after cancelling a bookmark', async () => {
    stored.history = [...Array.from({ length: 30 }, (_, i) => item(String(30 - i))), item('old-saved', true)];
    const history = await toggleSaved('old-saved');
    expect(history.filter(card => !card.saved)).toHaveLength(30);
    expect(history.some(card => card.id === 'old-saved')).toBe(false);
  });

  it('does not duplicate an existing card when it is saved again', async () => {
    stored.history = [item('same', true)];
    await addHistory(item('same', true));
    expect(await getHistory()).toHaveLength(1);
  });
});
