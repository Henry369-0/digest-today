export interface Preset {
  id: string;
  label: string;
  baseURL: string;
  model: string;
  needsKey: boolean;
  hint: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'zhipu',
    label: '智谱 GLM-4-Flash（免费 · 国内推荐）',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    needsKey: true,
    hint: 'Key 在 open.bigmodel.cn 控制台 → API Keys 获取',
  },
  {
    id: 'groq',
    label: 'Groq（免费额度大 · 速度快）',
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    needsKey: true,
    hint: 'Key 在 console.groq.com → API Keys 获取',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter 免费档',
    baseURL: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-chat-v3-0324:free',
    needsKey: true,
    hint: '模型选带 :free 后缀的；Key 在 openrouter.ai/keys',
  },
  {
    id: 'ollama',
    label: '本地 Ollama（完全离线 · 隐私最优）',
    baseURL: 'http://localhost:11434/v1',
    model: 'qwen2.5:3b',
    needsKey: false,
    hint: '先在终端 ollama pull qwen2.5:3b，无需 Key',
  },
  {
    id: 'custom',
    label: '自定义 OpenAI 兼容端点',
    baseURL: '',
    model: '',
    needsKey: true,
    hint: '填任意 OpenAI 兼容地址（如自建 freellmapi 聚合网关）',
  },
];

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function needsKeyOf(presetId: string): boolean {
  return presetById(presetId)?.needsKey ?? true;
}
