import type { HistoryItem, LlmSettings } from '../shared/types';

const KEY_SETTINGS = 'settings';
const KEY_HISTORY = 'history';
const KEY_ONBOARDED = 'onboarded';
export const HISTORY_LIMIT = 30;

/** 未收藏保留最近 30 条；收藏不参与自动裁剪。列表维持新到旧顺序。 */
function retainHistory(items: HistoryItem[]): HistoryItem[] {
  let recent = 0;
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return item.saved || ++recent <= HISTORY_LIMIT;
  });
}

export async function getSettings(): Promise<LlmSettings | null> {
  const o = await chrome.storage.local.get(KEY_SETTINGS);
  const s = o[KEY_SETTINGS] as LlmSettings | undefined;
  return s && s.baseURL && s.model ? s : null;
}

export async function saveSettings(s: LlmSettings): Promise<void> {
  await chrome.storage.local.set({ [KEY_SETTINGS]: s });
}

export async function isOnboarded(): Promise<boolean> {
  const o = await chrome.storage.local.get(KEY_ONBOARDED);
  return Boolean(o[KEY_ONBOARDED]);
}

export async function setOnboarded(): Promise<void> {
  await chrome.storage.local.set({ [KEY_ONBOARDED]: true });
}

export async function getHistory(): Promise<HistoryItem[]> {
  const o = await chrome.storage.local.get(KEY_HISTORY);
  return (o[KEY_HISTORY] as HistoryItem[] | undefined) ?? [];
}

export async function addHistory(item: HistoryItem): Promise<void> {
  const list = retainHistory([item, ...(await getHistory())]);
  await chrome.storage.local.set({ [KEY_HISTORY]: list });
}

export async function toggleSaved(id: string): Promise<HistoryItem[]> {
  const list = retainHistory((await getHistory()).map((h) => (h.id === id ? { ...h, saved: !h.saved } : h)));
  await chrome.storage.local.set({ [KEY_HISTORY]: list });
  return list;
}

export async function removeHistoryItem(id: string): Promise<HistoryItem[]> {
  const list = (await getHistory()).filter((h) => h.id !== id);
  await chrome.storage.local.set({ [KEY_HISTORY]: list });
  return list;
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove(KEY_HISTORY);
}

/** 导出全部数据（Key 打码），JSON 字符串 */
export async function exportAllData(): Promise<string> {
  const o = await chrome.storage.local.get(null);
  const settings = o[KEY_SETTINGS] as LlmSettings | undefined;
  const safe = {
    ...o,
    settings: settings ? { ...settings, apiKey: settings.apiKey ? '******（已隐藏）' : '' } : undefined,
    _note: '快读导出 · Key 不随导出泄露',
  };
  return JSON.stringify(safe, null, 2);
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
}
