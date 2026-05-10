import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { KbView } from './components/KbView';
import { SettingsView } from './components/SettingsView';
import { useSettings } from './hooks/useSettings';
import { useSSE } from './hooks/useSSE';
import './styles/tokens.css';
import './styles/layout.css';

export default function App() {
  const [view, setView] = useState('chat');
  const { settings } = useSettings();
  const { messages, streaming, send, stop } = useSSE(settings.tenantId);
  const [totalTokens, setTotalTokens] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [latency, setLatency] = useState('—');
  const [connected, setConnected] = useState(true);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (streaming && !startTimeRef.current) startTimeRef.current = Date.now();
    if (!streaming && startTimeRef.current) {
      setLatency(((Date.now() - startTimeRef.current) / 1000).toFixed(1) + 's');
      startTimeRef.current = 0;
    }
  }, [streaming]);

  useEffect(() => {
    const agentMsgs = messages.filter(m => m.role === 'agent');
    if (agentMsgs.length) {
      setTotalTokens(prev => prev + agentMsgs[agentMsgs.length - 1].content.length);
    }
    const thinkingMsgs = messages.filter(m => m.role === 'status' && m.content && m.content.includes('思考'));
    if (thinkingMsgs.length > rounds) setRounds(thinkingMsgs.length);
  }, [messages]);

  useEffect(() => {
    const i = setInterval(() => {
      fetch('/health').then(r => setConnected(r.ok)).catch(() => setConnected(false));
    }, 30000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="app">
      <Sidebar active={view} onNav={setView} tokens={totalTokens} rounds={rounds} latency={latency}
        provider={settings.provider} model={settings.model} />
      <main className="main">
        <div className="topbar">
          <span className={`dot ${connected ? 'dot-green' : 'dot-red'}`} />
          <span className="provider-badge">{settings.provider} · {settings.model}</span>
          <span className="page-title">{{ chat: '对话', kb: '知识库', settings: '设置' }[view]}</span>
        </div>
        {view === 'chat' && <ChatView messages={messages} streaming={streaming} onSend={send} onStop={stop} />}
        {view === 'kb' && <KbView />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
