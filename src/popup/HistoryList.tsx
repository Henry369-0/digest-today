import { VERDICT_INFO, type HistoryItem } from '../shared/types';
import { shortDate } from '../lib/md';

interface Props {
  items: HistoryItem[];
  onOpen: (item: HistoryItem) => void;
  onBack: () => void;
  onToggleSave: (item: HistoryItem) => Promise<boolean>;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export default function HistoryList({
  items,
  onOpen,
  onBack,
  onToggleSave,
  onRemove,
  onClear,
}: Props) {
  const savedItems = items.filter((h) => h.saved);
  const recentItems = items.filter((h) => !h.saved);

  const Row = ({ h }: { h: HistoryItem }) => {
    const v = h.result ? VERDICT_INFO[h.result.verdict] : null;
    return (
      <li className="border border-ink/60 bg-[#faf5ea]">
        <div className="flex items-stretch">
          <button className="flex-1 min-w-0 text-left px-2.5 py-2" onClick={() => onOpen(h)}>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ background: v?.color ?? 'var(--color-mustard)' }}
                title={v?.label ?? '降级摘要'}
              />
              <span className="text-[13px] font-semibold truncate">{h.title}</span>
            </div>
            <div className="q-meta mt-0.5">
              {h.siteName} · {shortDate(h.createdAt)}
              {h.result?.tldr ? ` · ${h.result.tldr.slice(0, 22)}…` : ' · 降级摘要'}
            </div>
          </button>
          <div className="flex flex-col justify-center gap-0.5 px-1.5 border-l border-ink/30">
            <button
              className="q-btn"
              style={{ fontSize: 11, padding: '2px 5px' }}
              title={h.saved ? '取消收藏' : '收藏'}
              onClick={() => void onToggleSave(h)}
            >
              {h.saved ? '★' : '☆'}
            </button>
            <button
              className="q-btn"
              style={{ fontSize: 11, padding: '2px 5px' }}
              title="删除"
              onClick={() => onRemove(h.id)}
            >
              ✕
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="q-header">
        <span className="text-[13px] font-semibold">历史与收藏</span>
        <button className="q-btn" onClick={onBack}>
          ← 返回
        </button>
      </header>
      <div className="flex-1 px-3 py-3 min-h-0 retro-scroll overflow-y-auto">
        <p className="q-meta mb-3">未收藏保留最近 30 条；收藏保留至取消或删除。</p>
        {items.length === 0 ? (
          <div className="q-card">
            <div className="q-card-inner text-center py-10">
              <p className="text-[14px]">还没有卡片</p>
              <p className="q-meta mt-2">去读篇文章，按 Alt+Shift+S 试试</p>
            </div>
          </div>
        ) : (
          <>
            {savedItems.length > 0 && (
              <>
                <div className="q-label mb-2" style={{ borderColor: 'var(--color-mustard)' }}>
                  ★ 已收藏
                </div>
                <ul className="space-y-1.5 mb-4">
                  {savedItems.map((h) => (
                    <Row key={h.id} h={h} />
                  ))}
                </ul>
                <div className="q-label mb-2">最近未收藏</div>
              </>
            )}
            <ul className="space-y-1.5">
              {recentItems.map((h) => (
                <Row key={h.id} h={h} />
              ))}
            </ul>
            <div className="text-center mt-4">
              <button className="q-btn" onClick={onClear}>
                清空历史
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
