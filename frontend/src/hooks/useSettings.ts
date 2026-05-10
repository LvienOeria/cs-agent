import { useState, useEffect, useCallback } from 'react';

interface Settings {
  provider: string;
  model: string;
  tenantId: string;
  apiKeys: Record<string, string>;
}

const DEFAULTS: Settings = { provider: 'deepseek', model: 'deepseek-chat', tenantId: '', apiKeys: {} };

function load(): Settings {
  try {
    return {
      provider: JSON.parse(localStorage.getItem('cs-agent-provider') || 'null') || DEFAULTS.provider,
      model: JSON.parse(localStorage.getItem('cs-agent-model') || 'null') || DEFAULTS.model,
      tenantId: JSON.parse(localStorage.getItem('cs-agent-tenantId') || 'null') || DEFAULTS.tenantId,
      apiKeys: JSON.parse(localStorage.getItem('cs-agent-apiKeys') || 'null') || {},
    };
  } catch { return DEFAULTS; }
}

function persist(s: Settings) {
  localStorage.setItem('cs-agent-provider', JSON.stringify(s.provider));
  localStorage.setItem('cs-agent-model', JSON.stringify(s.model));
  localStorage.setItem('cs-agent-tenantId', JSON.stringify(s.tenantId));
  localStorage.setItem('cs-agent-apiKeys', JSON.stringify(s.apiKeys));
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => { persist(settings); }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  const setApiKey = useCallback((provider: string, key: string) => {
    setSettings(prev => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [provider]: key },
    }));
  }, []);

  return { settings, update, setApiKey };
}
