// 仅开发用：在浏览器里预览弹窗组件视觉（不依赖 chrome.*，不进 dist）
import React from 'react';
import ReactDOM from 'react-dom/client';
import SummaryCard from '../src/popup/SummaryCard';
import HistoryList from '../src/popup/HistoryList';
import Onboarding from '../src/popup/Onboarding';
import SkeletonPreview from './SkeletonPreview';
import type { HistoryItem } from '../src/shared/types';
import '../src/shared/retro.css';

const now = Date.now();

const GOOD: HistoryItem = {
  id: 'a1',
  createdAt: now,
  url: 'https://www.36kr.com/p/2680000000000',
  siteName: '36氪',
  title: '为什么 Manifest V3 把浏览器扩展行业搅了个底朝天',
  byline: '林一',
  result: {
    tldr: 'MV3 用 service worker 和权限收紧重写了扩展的游戏规则，开发者怨声载道但隐私确实变好了。',
    points: [
      '后台常驻页面被 service worker 取代，五分钟休眠一次',
      'webRequest 阻塞式拦截改成了 declarativeNetRequest 规则表',
      '广告拦截器是最大的受伤者，过滤规则上限卡脖子',
      '远程代码全面禁止，所有逻辑必须打包在扩展里',
      '迁移成本高的老扩展选择留在 V2 通道直到 2025',
    ],
    verdict: 'must-read',
    keywords: ['浏览器扩展', 'MV3', '隐私'],
    bestLine: '权限模型从"装的时候全都要"变成了"用的时候才给你"。',
  },
  saved: true,
};

const DEGRADED: HistoryItem = {
  id: 'a2',
  createdAt: now - 3600_000,
  url: 'https://example.com/blog/mv2',
  siteName: 'example.com',
  title: 'A short note on extension permissions',
  result: undefined,
  raw: '这篇短文讲了扩展权限申请的最佳实践：只在真正用到时申请 host 权限，把用途写在弹窗说明里，用户拒绝时给出替代路径。作者建议在商店审核前自查一遍 permissions 列表。',
};

const HISTORY: HistoryItem[] = [
  GOOD,
  DEGRADED,
  {
    id: 'a3',
    createdAt: now - 86_400_000,
    url: 'https://mp.weixin.qq.com/s/abc',
    siteName: '少数派',
    title: '我的 2025 年度效率工具盘点',
    result: {
      tldr: '作者盘点了十件效率工具，一半是旧物新用。',
      points: ['快捷键是第一生产力', '自动化脚本省下的时间被折腾吃掉了'],
      verdict: 'skim',
      keywords: ['效率', '工具'],
      bestLine: '工具越少，执行越多。',
    },
    saved: false,
  },
];

const VIEWS: Record<string, () => React.ReactNode> = {
  card: () => (
    <PopupFrame>
      <SummaryCard item={GOOD} onOpenHistory={() => {}} onToggleSave={async () => true} />
    </PopupFrame>
  ),
  degraded: () => (
    <PopupFrame>
      <SummaryCard item={DEGRADED} onOpenHistory={() => {}} onToggleSave={async () => true} />
    </PopupFrame>
  ),
  history: () => (
    <PopupFrame>
      <HistoryList
        items={HISTORY}
        onOpen={() => {}}
        onBack={() => {}}
        onToggleSave={async () => true}
        onRemove={() => {}}
        onClear={() => {}}
      />
    </PopupFrame>
  ),
  onboard: () => (
    <PopupFrame>
      <Onboarding onDone={() => {}} />
    </PopupFrame>
  ),
  skeleton: () => (
    <PopupFrame>
      <SkeletonPreview />
    </PopupFrame>
  ),
  all: () => (
    <div className="p-6 flex gap-8 flex-wrap items-start">
      {Object.entries(VIEWS)
        .filter(([k]) => k !== 'all')
        .map(([k, V]) => (
          <section key={k}>
            <h2 className="mb-2 font-bold">{k}</h2>
            <V />
          </section>
        ))}
    </div>
  ),
};

function PopupFrame({ children }: { children: React.ReactNode }) {
  // 复刻 popup 宿主：380×560 窗口（.popup-body 的 CSS 只匹配 body，这里用内联尺寸）
  return (
    <div
      className="relative bg-paper overflow-hidden"
      style={{ width: 380, height: 560, border: '2px dashed #999' }}
    >
      <div className="grain" />
      <div className="relative h-full flex flex-col bg-paper">{children}</div>
    </div>
  );
}

function App() {
  const view = new URLSearchParams(location.search).get('view') ?? 'all';
  return VIEWS[view]?.() ?? VIEWS.all!();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
