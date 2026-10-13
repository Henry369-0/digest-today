import { useEffect, useState } from 'react';
import { PRESETS, presetById, needsKeyOf } from '../lib/presets';
import {
  clearAllData,
  clearHistory,
  exportAllData,
  getSettings,
  saveSettings,
  setOnboarded,
} from '../lib/storage';
import { hostOf, testConnection } from '../lib/llm';

type Status = { type: 'idle' | 'busy' | 'ok' | 'error'; msg?: string };

export default function App() {
  const [presetId, setPresetId] = useState('zhipu');
  const [baseURL, setBaseURL] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<Status>({ type: 'idle' });
  const [toast, setToast] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      if (s) {
        setPresetId(s.presetId);
        setBaseURL(s.baseURL);
        setModel(s.model);
        setApiKey(s.apiKey);
      }
      setLoaded(true);
    })();
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const applyPreset = (id: string) => {
    const p = presetById(id)!;
    setPresetId(id);
    setBaseURL(p.baseURL);
    setModel(p.model);
    setStatus({ type: 'idle' });
  };

  const validate = (): { baseURL: string; model: string; apiKey: string } | string => {
    const url = baseURL.trim().replace(/\/+$/, '');
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
    } catch {
      return '端点地址不合法：要完整 URL，如 https://api.example.com/v1';
    }
    if (!model.trim()) return '模型名不能为空';
    if (needsKeyOf(presetId) && !apiKey.trim()) return 'API Key 不能为空';
    return { baseURL: url, model: model.trim(), apiKey: apiKey.trim() };
  };

  const handleTest = async () => {
    const v = validate();
    if (typeof v === 'string') {
      setStatus({ type: 'error', msg: v });
      return;
    }
    setStatus({ type: 'busy' });
    try {
      await testConnection({ presetId, ...v });
      setStatus({ type: 'ok', msg: '✓ 连接成功，这个端点能用' });
    } catch (e) {
      setStatus({ type: 'error', msg: e instanceof Error ? e.message : String(e) });
    }
  };

  /** 保存 = 授权（手势内同步调用）→ 测试连接 → 落盘 */
  const handleSave = async () => {
    const v = validate();
    if (typeof v === 'string') {
      setStatus({ type: 'error', msg: v });
      return;
    }
    const origin = new URL(v.baseURL).origin;
    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    } catch {
      granted = false;
    }
    if (!granted) {
      setStatus({
        type: 'error',
        msg: `没有授权 ${hostOf(v.baseURL)}，保存失败。快读需要这个权限才能把正文发给你选的端点。`,
      });
      return;
    }
    setStatus({ type: 'busy', msg: '已授权，测试连接中…' });
    try {
      await testConnection({ presetId, ...v });
    } catch (e) {
      setStatus({
        type: 'error',
        msg: `端点通了权限这关，但连接测试没过：${e instanceof Error ? e.message : String(e)}`,
      });
      return;
    }
    await saveSettings({ presetId, ...v });
    await setOnboarded();
    setStatus({ type: 'ok', msg: '✓ 已保存' });
    flash('设置已保存');
  };

  const handleExport = async () => {
    const json = await exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'digest-today-数据导出.json';
    a.click();
    URL.revokeObjectURL(a.href);
    flash('已导出（Key 已打码）');
  };

  const handleClearHistory = async () => {
    if (!window.confirm('清空全部历史卡片？不可恢复。')) return;
    await clearHistory();
    flash('历史已清空');
  };

  const handleClearAll = async () => {
    if (!window.confirm('清空全部数据（设置 + 历史 + 授权）？清完要重新配置。')) return;
    await clearAllData();
    setPresetId('zhipu');
    setBaseURL('');
    setModel('');
    setApiKey('');
    setStatus({ type: 'idle' });
    flash('已全部清空，扩展回到初始状态');
  };

  const endpointHost = (() => {
    try {
      return hostOf(baseURL.trim());
    } catch {
      return '—';
    }
  })();

  return (
    <div className="min-h-screen">
      <div className="grain" />
      <div className="max-w-[640px] mx-auto px-5 py-8">
        <header className="mb-6">
          <div className="flex items-baseline justify-between">
            <h1
              className="text-[28px] font-black tracking-[0.18em]"
              style={{ textShadow: '2px 2px 0 rgba(181,72,42,0.22)' }}
            >
              快读 · 设置
            </h1>
            <span className="q-meta">DIGEST.TODAY · v1.0.1</span>
          </div>
          <div className="q-rule mt-3" />
        </header>

        {/* 端点配置 */}
        <section className="q-card mb-5">
          <div className="q-card-inner">
            <h2 className="text-[15px] font-black tracking-[0.2em] mb-3">LLM 端点（BYO-Key）</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="q-label">预设</span>
                <select
                  className="q-select"
                  value={presetId}
                  disabled={!loaded}
                  onChange={(e) => applyPreset(e.target.value)}
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="q-label">端点地址</span>
                <input
                  className="q-input"
                  value={baseURL}
                  onChange={(e) => {
                    setBaseURL(e.target.value);
                    setStatus({ type: 'idle' });
                  }}
                  placeholder="https://…（OpenAI 兼容 /chat/completions）"
                  spellCheck={false}
                />
              </label>
              <div className="flex gap-3">
                <label className="block flex-1">
                  <span className="q-label">模型</span>
                  <input
                    className="q-input"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="glm-4-flash"
                    spellCheck={false}
                  />
                </label>
                <label className="block flex-1">
                  <span className="q-label">API Key {needsKeyOf(presetId) ? '' : '（可空）'}</span>
                  <div className="flex gap-1">
                    <input
                      className="q-input"
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-…"
                      spellCheck={false}
                    />
                    <button className="q-btn shrink-0" onClick={() => setShowKey((v) => !v)}>
                      {showKey ? '隐藏' : '显示'}
                    </button>
                  </div>
                </label>
              </div>
              <p className="q-meta">{presetById(presetId)?.hint}</p>

              {status.type !== 'idle' && (
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: status.type === 'error' ? 'var(--color-brick)' : 'var(--color-pine)' }}
                >
                  {status.type === 'busy' ? status.msg ?? '测试连接中…' : status.msg}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  className="q-btn"
                  disabled={status.type === 'busy'}
                  onClick={() => void handleTest()}
                >
                  测试连接
                </button>
                <button
                  className="q-btn q-btn--primary"
                  disabled={status.type === 'busy'}
                  onClick={() => void handleSave()}
                >
                  保存（会先弹一次端点授权）
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 隐私三句 */}
        <section className="q-card mb-5">
          <div className="q-card-inner">
            <h2 className="text-[15px] font-black tracking-[0.2em] mb-3">隐私说明（就三句）</h2>
            <ol className="text-[13px] leading-relaxed space-y-1 list-decimal list-inside">
              <li>API Key 只存本机（chrome.storage.local），不进任何我们的服务器——本项目根本没有服务器。</li>
              <li>文章正文只发给你自己在上面配置的那个端点：现在配置的是 <b>{endpointHost || '（还没配置）'}</b>，正文会发到这里。</li>
              <li>历史记录只存本机，可随时在下方一键清空或导出。</li>
            </ol>
            <p className="q-meta mt-2">
              扩展平时对任何页面"零感知"：只有你按下快捷键 / 点图标那一刻，才临时访问当前标签页（activeTab）。
            </p>
          </div>
        </section>

        {/* 数据管理 */}
        <section className="q-card mb-5">
          <div className="q-card-inner">
            <h2 className="text-[15px] font-black tracking-[0.2em] mb-3">数据管理</h2>
            <div className="flex gap-2 flex-wrap">
              <button className="q-btn" onClick={() => void handleExport()}>
                导出全部数据 JSON
              </button>
              <button className="q-btn" onClick={() => void handleClearHistory()}>
                清空历史
              </button>
              <button
                className="q-btn"
                style={{ color: 'var(--color-brick)', borderColor: 'var(--color-brick)' }}
                onClick={() => void handleClearAll()}
              >
                清空全部（回到初始）
              </button>
            </div>
            <p className="q-meta mt-2">未收藏保留最近 30 条，收藏保留至取消或删除。导出文件里 Key 已打码，可以放心分享排错。</p>
          </div>
        </section>

        {/* 关于 */}
        <section className="q-card mb-10">
          <div className="q-card-inner">
            <h2 className="text-[15px] font-black tracking-[0.2em] mb-3">关于</h2>
            <ul className="text-[13px] leading-relaxed space-y-1 list-disc list-inside q-meta" style={{ fontSize: 12.5 }}>
              <li>用法：在文章页按 Alt+Shift+S（或点工具栏图标），3-8 秒出卡片。</li>
              <li>已知限制：摘要和朗读在弹窗里进行，弹窗一关就停，v2 用侧边栏根治。</li>
              <li>限流重试：429/5xx/断网自动指数退避重试 2 次；免费小模型吐坏 JSON 时自动降级为自由摘要卡片。</li>
              <li>手工作坊系列 #03 · 纸墨复古视觉与 #01/#02 同套色板。</li>
            </ul>
          </div>
        </section>
      </div>

      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 border border-ink bg-ink text-paper px-4 py-2 text-[13px] tracking-wider"
          style={{ boxShadow: '3px 3px 0 rgba(43,43,38,0.25)' }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
