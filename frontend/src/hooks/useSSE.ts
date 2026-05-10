import { useState, useCallback, useRef } from 'react';
import { streamChat } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'agent' | 'status';
  content: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; round: number; success?: boolean }>;
  time: string;
}

export function useSSE(tenantId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const historyRef = useRef<Array<{ role: string; content: string }>>([]);
  const abortRef = useRef<AbortController | null>(null);

  const addMsg = useCallback((m: Message) => {
    setMessages(prev => [...prev, m]);
  }, []);

  const updateLast = useCallback((fn: (m: Message) => Message) => {
    setMessages(prev => {
      const copy = [...prev];
      if (copy.length) copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });
  }, []);

  const send = useCallback(async (text: string) => {
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    addMsg({ id: crypto.randomUUID(), role: 'user', content: text, time: now });
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let agentContent = '';
    let lastStatusId = '';

    await streamChat(text, historyRef.current, tenantId, (e) => {
      switch (e.type) {
        case 'status':
          if (e.status === 'thinking') {
            const id = crypto.randomUUID();
            lastStatusId = id;
            addMsg({ id, role: 'status', content: '思考中…', time: '' });
          }
          break;
        case 'tool_call':
          addMsg({
            id: crypto.randomUUID(),
            role: 'status',
            content: '',
            toolCalls: [{ name: e.name!, args: e.args!, round: e.round! }],
            time: '',
          });
          break;
        case 'tool_result':
          updateLast(m => ({
            ...m,
            toolCalls: m.toolCalls?.map((tc, i) =>
              i === (m.toolCalls!.length - 1) ? { ...tc, success: e.success } : tc
            ),
          }));
          setMessages(prev => prev.filter(m => m.id !== lastStatusId));
          break;
        case 'done':
          agentContent = e.content || '';
          addMsg({ id: crypto.randomUUID(), role: 'agent', content: agentContent, time: now });
          break;
        case 'error':
          addMsg({ id: crypto.randomUUID(), role: 'status', content: '❌ ' + (e.message || '错误'), time: '' });
          break;
      }
    }, controller.signal).finally(() => {
      setStreaming(false);
      setMessages(prev => prev.filter(m => m.role !== 'status'));
    });

    if (agentContent) {
      historyRef.current.push({ role: 'user', content: text });
      historyRef.current.push({ role: 'assistant', content: agentContent });
      if (historyRef.current.length > 20) historyRef.current = historyRef.current.slice(-20);
    }
  }, [addMsg, updateLast, tenantId]);

  const stop = useCallback(() => { abortRef.current?.abort(); }, []);

  return { messages, streaming, send, stop };
}
