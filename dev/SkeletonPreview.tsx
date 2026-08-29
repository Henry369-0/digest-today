// 仅开发用：骨架屏预览（复用 popup/App.tsx 的 Skeleton 视觉，独立副本避免 export 链）
export default function SkeletonPreview() {
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
        已抓到《网页摘要的三种做法…》· 8,214 字
        <div className="mt-1 animate-pulse text-ink">编辑部正在写摘要…</div>
      </footer>
    </div>
  );
}
