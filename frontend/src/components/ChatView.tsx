import { useState, useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';

interface Message {
  id: string;
  role: 'user' | 'agent' | 'status';
  content: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; round: number; success?: boolean }>;
  time: string;
}

interface Props {
  messages: Message[];
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

const SUGGESTIONS = ['退货政策是什么', '怎么查订单', '会员有什么等级', '客服电话多少'];

export function ChatView({ messages, streaming, onSend, onStop }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    onSend(text);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="messages">
        {messages.length === 0 && (
          <div className="empty">
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>💬</div>
            <p>你好，我是智能客服助手</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>可以帮你查订单、搜知识库、了解公司政策</p>
          </div>
        )}
        {messages.map(m => (
          <MessageBubble key={m.id} role={m.role} content={m.content} time={m.time} toolCalls={m.toolCalls} />
        ))}
        {streaming && <div className="msg-group status"><div className="msg-bubble"><span className="cursor-blink">|</span></div></div>}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-area">
        <div className="input-row">
          <input className="input" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="输入消息…" disabled={streaming} autoFocus />
          {streaming
            ? <button className="btn" onClick={onStop} style={{ background: '#ff3b30' }}>停止</button>
            : <button className="btn" onClick={handleSend} disabled={!input.trim()}>发送</button>
          }
        </div>
        <div className="suggestions">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => { setInput(s); onSend(s); }} disabled={streaming}>{s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
