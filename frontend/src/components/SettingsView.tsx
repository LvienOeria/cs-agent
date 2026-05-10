import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';

const PROVIDERS = [
  { id: 'deepseek', label: 'DeepSeek', env: 'DEEPSEEK_API_KEY' },
  { id: 'openai', label: 'OpenAI', env: 'OPENAI_API_KEY' },
  { id: 'claude', label: 'Claude (Anthropic)', env: 'ANTHROPIC_API_KEY' },
  { id: 'gemini', label: 'Gemini (Google)', env: 'GEMINI_API_KEY' },
  { id: 'qwen', label: 'Qwen (阿里)', env: 'QWEN_API_KEY' },
  { id: 'kimi', label: 'Kimi (Moonshot)', env: 'KIMI_API_KEY' },
];

export function SettingsView() {
  const { settings, update, setApiKey } = useSettings();
  const [saved, setSaved] = useState(false);

  const triggerSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="settings-view">
      <div className="settings-section">
        <h3>LLM Provider</h3>
        <div className="settings-row">
          <div className="field">
            <label>提供商</label>
            <div className="select-wrap">
              <select value={settings.provider} onChange={e => { update({ provider: e.target.value }); triggerSave(); }}>
                {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>模型</label>
            <input className="input" value={settings.model} onChange={e => { update({ model: e.target.value }); triggerSave(); }}
              placeholder="deepseek-chat" />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>API Keys</h3>
        <p style={{ fontSize: 12, color: 'var(--ink-48)', marginBottom: 12 }}>至少填写一个。存储于浏览器本地，不会上传。</p>
        {PROVIDERS.map(p => (
          <div key={p.id} className="settings-row" style={{ marginBottom: 6 }}>
            <div className="field">
              <label>{p.label} <span style={{ fontSize: 10, opacity: 0.6 }}>{p.env}</span></label>
              <input className="input" type="password" placeholder="sk-…"
                value={settings.apiKeys[p.id] || ''}
                onChange={e => { setApiKey(p.id, e.target.value); triggerSave(); }}
                style={{ fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 13 }} />
            </div>
          </div>
        ))}
      </div>

      <div className="settings-section">
        <h3>租户</h3>
        <div className="field" style={{ maxWidth: 280 }}>
          <label>Tenant ID（可选）</label>
          <input className="input" value={settings.tenantId} onChange={e => { update({ tenantId: e.target.value }); triggerSave(); }}
            placeholder="留空为全局" />
        </div>
      </div>

      {saved && <span className="settings-saved">已保存</span>}
    </div>
  );
}
