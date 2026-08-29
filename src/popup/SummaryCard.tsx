import { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { VERDICT_INFO, type HistoryItem } from '../shared/types';
import { cardToMarkdown, cardToSpeech, pngSafeName } from '../lib/md';

interface Props {
  item: HistoryItem;
  /** 回看模式：显示返回按钮 */
  onBack?: () => void;
  /** 卡片模式：显示历史入口 */
  onOpenHistory?: () => void;
  onToggleSave?: (item: HistoryItem) => Promise<boolean>;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRateState] = useState(1);
  const rateRef = useRef(1);
  const textRef = useRef('');

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    textRef.current = '';
    setSpeaking(false);
    setPaused(false);
  }, []);

  const speak = useCallback((text: string) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    textRef.current = text;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = rateRef.current;
    const zh = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('zh'));
    if (zh) u.voice = zh;
    u.onend = () => {
      setSpeaking(false);
      setPaused(false);
    };
    u.onerror = () => {
      setSpeaking(false);
      setPaused(false);
    };
    synth.speak(u);
    setSpeaking(true);
    setPaused(false);
  }, []);

  const togglePause = useCallback(() => {
    const synth = window.speechSynthesis;
    if (synth.paused) {
      synth.resume();
      setPaused(false);
    } else if (synth.speaking) {
      synth.pause();
      setPaused(true);
    }
  }, []);

  const setRate = useCallback(
    (r: number) => {
      setRateState(r);
      rateRef.current = r;
      // Chrome 只在 utterance 开始时读速率：播放中调速就重播一遍
      if (textRef.current && window.speechSynthesis.speaking) speak(textRef.current);
    },
    [speak],
  );

  // 已知限制：弹窗关闭即停止朗读（v2 侧边栏根治）
  useEffect(() => () => window.speechSynthesis.cancel(), []);

  return { speaking, paused, rate, setRate, speak, stop, togglePause };
}

export default function SummaryCard({ item, onBack, onOpenHistory, onToggleSave }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [pngBusy, setPngBusy] = useState(false);
  const speech = useSpeech();

  const r = item.result;
  const verdict = r ? VERDICT_INFO[r.verdict] : null;
  const saved = Boolean(item.saved);

  const handleCopy = useCallback(async () => {
    const ok = await copyText(cardToMarkdown(item));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [item]);

  const handlePng = useCallback(async () => {
    if (!cardRef.current || pngBusy) return;
    setPngBusy(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#f2ead9',
      });
      const a = document.createElement('a');
      a.download = pngSafeName(item);
      a.href = dataUrl;
      a.click();
    } finally {
      setPngBusy(false);
    }
  }, [item, pngBusy]);

  const handleStar = useCallback(async () => {
    await onToggleSave?.(item);
  }, [item, onToggleSave]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="q-header">
        <span className="text-[13px] font-semibold truncate">
          快读<span className="opacity-60"> · {item.siteName || '未知站点'}</span>
        </span>
        {onBack ? (
          <button className="q-btn" onClick={onBack}>
            ← 返回
          </button>
        ) : (
          <button className="q-btn" onClick={onOpenHistory}>
            ✎ 历史
          </button>
        )}
      </header>

      <div className="flex-1 px-3 py-3 min-h-0 retro-scroll overflow-y-auto">
        <div ref={cardRef} className="q-card" style={{ width: 348 }}>
          <div className="q-card-inner">
            {item.byline && <div className="q-meta mb-1">文 / {item.byline}</div>}
            <h1 className="q-title">{item.title}</h1>
            <div className="q-rule" />

            {r ? (
              <>
                <p className="q-tldr">
                  <span className="q-label">一句话</span>
                  {r.tldr}
                </p>
                {r.points.length > 0 && (
                  <ul className="q-points">
                    {r.points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                )}
                <div className="flex justify-end mt-3 mb-2">
                  {verdict && (
                    <span className="stamp" style={{ color: verdict.color }}>
                      {verdict.label}
                    </span>
                  )}
                </div>
                {r.keywords.length > 0 && (
                  <div className="q-keywords mt-2">
                    {r.keywords.map((k, i) => (
                      <span key={i}>#{k}</span>
                    ))}
                  </div>
                )}
                {r.bestLine && (
                  <>
                    <div className="q-rule q-rule--thin mt-3" />
                    <p className="q-bestline mt-2">“{r.bestLine}”</p>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="mb-2">
                  <span
                    className="q-label"
                    style={{ borderColor: 'var(--color-mustard)', background: 'var(--color-paper-deep)' }}
                  >
                    降级 · 自由摘要
                  </span>
                </div>
                <p className="q-tldr whitespace-pre-wrap">{item.raw}</p>
                <p className="q-meta mt-3">
                  小模型没吐出标准 JSON，这是兜底的纯文本摘要。
                </p>
              </>
            )}

            <div className="q-rule q-rule--thin mt-3" />
            <div className="flex justify-between items-center q-meta mt-1">
              <span>{item.siteName}</span>
              <span>快读 · digest.today</span>
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 mt-3 justify-center flex-wrap">
          <button className="q-btn" onClick={() => void handleCopy()}>
            {copied ? '已复制 ✓' : '复制 MD'}
          </button>
          <button className="q-btn" disabled={pngBusy} onClick={() => void handlePng()}>
            {pngBusy ? '生成中…' : '存 PNG'}
          </button>
          <button
            className="q-btn"
            onClick={() => (speech.speaking ? speech.stop() : speech.speak(cardToSpeech(item)))}
          >
            {speech.speaking ? '■ 停止' : '▶ 朗读'}
          </button>
          {speech.speaking && (
            <button className="q-btn" onClick={speech.togglePause}>
              {speech.paused ? '继续' : '暂停'}
            </button>
          )}
          <button
            className="q-btn"
            style={saved ? { background: 'var(--color-mustard)' } : undefined}
            onClick={() => void handleStar()}
            title={saved ? '取消收藏' : '收藏（进 v2 周报原料库）'}
          >
            {saved ? '★ 已藏' : '⭐'}
          </button>
        </div>

        {speech.speaking && (
          <div className="flex items-center gap-2 mt-2 justify-center">
            <span className="q-meta">速率</span>
            <input
              type="range"
              min={0.8}
              max={1.5}
              step={0.1}
              value={speech.rate}
              onChange={(e) => speech.setRate(Number(e.target.value))}
              style={{ accentColor: 'var(--color-brick)', width: 120 }}
            />
            <span className="q-meta">{speech.rate.toFixed(1)}x</span>
          </div>
        )}
        <p className="q-meta text-center mt-2 opacity-70">
          提示：弹窗一关，朗读就停（v2 侧边栏根治）
        </p>
      </div>
    </div>
  );
}
