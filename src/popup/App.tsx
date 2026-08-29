import { useCallback, useEffect, useState } from 'react';
import type { ExtractedArticle, HistoryItem, LlmSettings } from '../shared/types';
import {
  addHistory,
  clearHistory,
  getHistory,
  getSettings,
  removeHistoryItem,
  toggleSaved,
} from '../lib/storage';
import { needsKeyOf } from '../lib/presets';
import { summarizeArticle } from '../lib/summarize';
import { LlmError } from '../lib/llm';
import Onboarding from './Onboarding';
import SummaryCard from './SummaryCard';
import HistoryList from './HistoryList';

/** 主流程状态（历史/回看是覆盖层，不打断主流程） */
type Flow =
  | { s: 'boot' }
  | { s: 'onboard' }
  | { s: 'extract' }
  | { s: 'llm'; article: ExtractedArticle }
  | { s: 'card'; item: HistoryItem }
  | { s: 'degraded'; item: HistoryItem }
  | { s: 'error'; title: string; showSettings?: boolean };

type View = { kind: 'history' } | { kind: 'item'; item: HistoryItem } | null;

/** 页面本身不能快读（内置页 / PDF / 非文章），错误文案更明确 */
class NotArticleError extends Error {}

function hostOfUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

export default function App() {
  const [flow, setFlow] = useState<Flow>({ s: 'boot' });
  const [view, setView] = useState<View>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  const run = useCallback(async (settings: LlmSettings) => {
    setFlow({ s: 'extract' });
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url ?? '';
      if (!tab?.id || !/^https?:/i.test(url)) {
        throw new NotArticleError('这个页面不能快读，换一篇普通文章页试试（仅支持 http/https）');
      }
      if (/\.pdf($|[?#])/i.test(url)) {
        throw new NotArticleError('v1 还不支持 PDF 摘要，v2 再见');
      }

      // 按需注入抽取脚本（activeTab 临时权限），再取抽取结果
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-extract.js'],
      });
      const article = (await chrome.tabs.sendMessage(tab.id, {
        type: 'DIGEST_EXTRACT',
      })) as ExtractedArticle | undefined;
      if (!article?.ok) {
        throw new NotArticleError('这个页面看起来不是文章（登录页 / 搜索页 / 正文太短）');
      }

      setFlow({ s: 'llm', article });
      const outcome = await summarizeArticle(settings, article);

      const item: HistoryItem = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        url: article.url,
        siteName: article.siteName || hostOfUrl(article.url),
        title: article.title,
        byline: article.byline || undefined,
      };
      if (outcome.ok) {
        item.result = outcome.result;
      } else {
        item.raw = outcome.text;
      }
      await addHistory(item);
      setFlow(outcome.ok ? { s: 'card', item } : { s: 'degraded', item });
    } catch (e) {
      if (e instanceof NotArticleError) {
        setFlow({ s: 'error', title: e.message });
      } else if (e instanceof LlmError) {
        setFlow({ s: 'error', title: e.message, showSettings: true });
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        const denied =
          /cannot access|cannot inject|chrome:|edge:|about:|Extension context/i.test(msg);
        setFlow({
          s: 'error',
          title: denied ? '这个页面不能快读（浏览器限制）' : `出错了：${msg}`,
          showSettings: true,
        });
      }
    }
  }, []);

  const bootstrap = useCallback(async () => {
    // 「是否已配置」以有效设置为准（设置页直接配置也要认），onboarded 只是辅助标记
    const settings = await getSettings();
    if (!settings || (needsKeyOf(settings.presetId) && !settings.apiKey)) {
      setFlow({ s: 'onboard' });
      return;
    }
    void run(settings);
  }, [run]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const onOnboarded = useCallback(async () => {
    const settings = await getSettings();
    if (settings) void run(settings);
    else setFlow({ s: 'error', title: '设置好像没存上，去设置页看看' });
  }, [run]);

  const openHistory = useCallback(async () => {
    setHistoryItems(await getHistory());
    setView({ kind: 'history' });
  }, []);

  /** 收藏切换：卡片 / 回看 / 历史列表三处共享 */
  const handleToggleSave = useCallback(async (item: HistoryItem): Promise<boolean> => {
    const list = await toggleSaved(item.id);
    const saved = list.find((h) => h.id === item.id)?.saved ?? false;
    setHistoryItems((prev) => prev.map((h) => (h.id === item.id ? { ...h, saved } : h)));
    setFlow((f) =>
      (f.s === 'card' || f.s === 'degraded') && f.item.id === item.id
        ? { ...f, item: { ...f.item, saved } }
        : f,
    );
    setView((v) =>
      v?.kind === 'item' && v.item.id === item.id ? { kind: 'item', item: { ...v.item, saved } } : v,
    );
    return saved;
  }, []);

  const handleClearHistory = useCallback(async () => {
    if (!window.confirm('清空全部历史卡片？此操作不可恢复。')) return;
    await clearHistory();
    setHistoryItems([]);
  }, []);

  const handleRemoveItem = useCallback(async (id: string) => {
    setHistoryItems(await removeHistoryItem(id));
  }, []);

  // ---------- 渲染 ----------
  let body: React.ReactNode;

  if (view?.kind === 'history') {
    body = (
      <HistoryList
        items={historyItems}
        onOpen={(item) => setView({ kind: 'item', item })}
        onBack={() => setView(null)}
        onToggleSave={handleToggleSave}
        onRemove={handleRemoveItem}
        onClear={handleClearHistory}
      />
    );
  } else if (view?.kind === 'item') {
    body = <SummaryCard item={view.item} onBack={() => setView({ kind: 'history' })} onToggleSave={handleToggleSave} />;
  } else {
    switch (flow.s) {
      case 'boot':
        body = <Skeleton note="准备中…" />;
        break;
      case 'onboard':
        body = <Onboarding onDone={() => void onOnboarded()} />;
        break;
      case 'extract':
        body = <Skeleton note="正在抓取正文…" />;
        break;
      case 'llm':
        body = (
          <Skeleton
            note={`已抓到《${flow.article.title.slice(0, 18)}${flow.article.title.length > 18 ? '…' : ''}》· ${flow.article.text.length.toLocaleString()} 字`}
            busy="编辑部正在写摘要…"
          />
        );
        break;
      case 'card':
      case 'degraded':
        body = (
          <SummaryCard item={flow.item} onOpenHistory={() => void openHistory()} onToggleSave={handleToggleSave} />
        );
        break;
      case 'error':
        body = (
          <ErrorCard
            title={flow.title}
            showSettings={flow.showSettings}
            onRetry={() => void bootstrap()}
          />
        );
        break;
    }
  }

  return (
    <div className="relative h-full flex flex-col bg-paper">
      <div className="grain" />
      {body}
    </div>
  );
}

function Skeleton({ note, busy }: { note: string; busy?: string }) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="q-header">
        <span className="text-[13px] tracking-[0.3em] font-semibold opacity-80">快 读</span>
        <span className="q-meta">SUMMARY CARD</span>
      </header>
      <div className="flex-1 px-3 py-3 min-h-0">
        <div className="q-card h-full">
          <div className="q-card-inner animate-pulse">
            <div className="q-skel h-5 w-3/4" />
            <div className="q-skel h-5 w-1/2 mt-2" />
            <div className="q-rule" />
            <div className="q-skel h-3.5 w-full" />
            <div className="q-skel h-3.5 w-11/12 mt-2" />
            <div className="q-skel h-3.5 w-4/5 mt-2" />
            <div className="mt-4 flex justify-end">
              <div className="q-skel h-9 w-24 rotate-[-6deg]" />
            </div>
            <div className="q-skel h-3 w-2/3 mt-4" />
          </div>
        </div>
      </div>
      <footer className="px-4 pb-4 text-center q-meta">
        {note}
        {busy && <div className="mt-1 animate-pulse text-ink">{busy}</div>}
      </footer>
    </div>
  );
}

function ErrorCard({
  title,
  showSettings,
  onRetry,
}: {
  title: string;
  showSettings?: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="q-header">
        <span className="text-[13px] tracking-[0.3em] font-semibold opacity-80">快 读</span>
        <span className="q-meta">OOPS</span>
      </header>
      <div className="flex-1 px-3 py-3 min-h-0">
        <div className="q-card h-full">
          <div className="q-card-inner flex flex-col items-center justify-center text-center gap-4 h-full">
            <div className="stamp text-[color:var(--color-ink-soft)]" style={{ fontSize: 13 }}>
              卡不上
            </div>
            <p className="text-[14px] leading-relaxed px-2">{title}</p>
            <div className="flex gap-2">
              <button className="q-btn q-btn--primary" onClick={onRetry}>
                重试
              </button>
              {showSettings && (
                <button
                  className="q-btn"
                  onClick={() => void chrome.runtime.openOptionsPage()}
                >
                  打开设置
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
