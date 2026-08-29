import { useEffect, useState } from 'react';
import { PRESETS, presetById } from '../lib/presets';
import { getSettings, saveSettings, setOnboarded } from '../lib/storage';
import { testConnection } from '../lib/llm';

interface Props {
  onDone: () => void;
}

type Status = { type: 'idle' | 'busy' | 'ok' | 'error'; msg?: string };

/** 弹窗内首次配置引导：选预设 → 填 Key → 测试通过 → 授权 + 保存 → 自动开始摘要 */
export default function Onboarding({ onDone }: Props) {
  const [presetId, setPresetId] = useState('zhipu');
  const preset = presetById(presetId)!;
  const [baseURL, setBaseURL] = useState(preset.baseURL);
  const [model, setModel] = useState(preset.model);
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<Status>({ type: 'idle' });

  // 已有配置（比如从设置页配过）就回填，别让用户重填
  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      if (!s) return;
      setPresetId(s.presetId);
      setBaseURL(s.baseURL);
      setModel(s.model);
      setApiKey(s.apiKey);
    })();
  }, []);

  const applyPreset = (id: string) => {
    const p = presetById(id)!;
    setPresetId(id);
    setBaseURL(p.baseURL);
    setModel(p.model);
    setStatus({ type: 'idle' });
  };

  const handleSave = async () => {
    // ---- 同步校验（必须先于任何 await，保持在用户手势里） ----
    const url = baseURL.trim().replace(/\/+$/, '');
    let origin: string;
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad protocol');
      origin = u.origin;
    } catch {
      setStatus({ type: 'error', msg: '端点地址不合法：要完整 URL，如 https://api.example.com/v1' });
      return;
    }
    if (!model.trim()) {
      setStatus({ type: 'error', msg: '模型名不能为空' });
      return;
    }
    if (preset.needsKey && !apiKey.trim()) {
      setStatus({ type: 'error', msg: `先填 API Key（${preset.hint}）` });
      return;
    }

    // ---- 用户手势内先弹授权（文档 §4：拒绝则保存失败） ----
    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    } catch {
      granted = false;
    }
    if (!granted) {
      setStatus({
        type: 'error',
        msg: '你拒绝授权这个端点域名，保存失败。快读需要它才能把正文发给你选的服务。',
      });
      return;
    }

    // ---- 保存前跑一次测试连接 ----
    setStatus({ type: 'busy' });
    const settings = { presetId, baseURL: url, apiKey: apiKey.trim(), model: model.trim() };
    try {
      await testConnection(settings);
    } catch (e) {
      setStatus({
        type: 'error',
        msg: `连接测试没过：${e instanceof Error ? e.message : String(e)}`,
      });
      return;
    }
    await saveSettings(settings);
    await setOnboarded();
    onDone();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="q-header">
        <span className="text-[13px] tracking-[0.3em] font-semibold opacity-80">快 读</span>
        <span className="q-meta">FIRST RUN</span>
      </header>
      <div className="flex-1 px-3 py-3 min-h-0 retro-scroll overflow-y-auto">
        <div className="q-card">
          <div className="q-card-inner">
            <h1 className="q-title text-[15px]">先花 30 秒配一个免费端点</h1>
            <div className="q-rule" />
            <div className="space-y-2.5">
              <label className="block">
                <span className="q-label">1 端点</span>
                <select
                  className="q-select"
                  value={presetId}
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
                <span className="q-label">地址</span>
                <input
                  className="q-input"
                  value={baseURL}
                  onChange={(e) => setBaseURL(e.target.value)}
                  placeholder="https://…（OpenAI 兼容）"
                  spellCheck={false}
                />
              </label>
              <div className="flex gap-2">
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
                  <span className="q-label">Key{preset.needsKey ? '' : '（可空）'}</span>
                  <input
                    className="q-input"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={preset.needsKey ? 'sk-…' : '不需要'}
                    spellCheck={false}
                  />
                </label>
              </div>
              <p className="q-meta">{preset.hint}</p>
              {status.type !== 'idle' && (
                <p
                  className="text-[12px] leading-relaxed"
                  style={{ color: status.type === 'error' ? 'var(--color-brick)' : 'var(--color-pine)' }}
                >
                  {status.type === 'busy'
                    ? '测试连接中…'
                    : status.type === 'ok'
                      ? '✓ 连接成功'
                      : status.msg}
                </p>
              )}
              <button
                className="q-btn q-btn--primary w-full"
                disabled={status.type === 'busy'}
                onClick={() => void handleSave()}
              >
                {status.type === 'busy' ? '测试中…' : '测试连接 · 通过后保存并开始'}
              </button>
              <p className="q-meta leading-relaxed">
                点「保存」时会弹一次授权框，只授权上面这个端点域名；拒绝则保存失败。
                <br />
                要更多说明和数据管理，去
                <button
                  className="underline underline-offset-2"
                  onClick={() => void chrome.runtime.openOptionsPage()}
                >
                  完整设置页
                </button>
                。Key 只存本机，正文只发给你选的端点。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
