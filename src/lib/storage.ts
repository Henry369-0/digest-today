import type { HistoryItem, LlmSettings } from '../shared/types';

const KEY_SETTINGS = 'settings';
const KEY_HISTORY = 'history';
const KEY_ONBOARDED = 'onboarded';
export const HISTORY_LIMIT = 30;

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
  const list = [item, ...(await getHistory())].slice(0, HISTORY_LIMIT);
  await chrome.storage.local.set({ [KEY_HISTORY]: list });
}

export async function toggleSaved(id: string): Promise<HistoryItem[]> {
  const list = (await getHistory()).map((h) => (h.id === id ? { ...h, saved: !h.saved } : h));
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
