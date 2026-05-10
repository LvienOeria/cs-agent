import { renderMarkdown } from '../lib/markdown';

interface Props {
  role: 'user' | 'agent' | 'status';
  content: string;
  time: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; round: number; success?: boolean }>;
}

export function MessageBubble({ role, content, time, toolCalls }: Props) {
  if (toolCalls?.length) {
    return (
      <div className="msg-group status" style={{ animation: 'slideUp .3s ease' }}>
        {toolCalls.map((tc, i) => (
          <details key={i} className="tool-inline">
            <summary className="tool-header">
              <span>🔧</span>
              <span className="name">{tc.name}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10, opacity: 0.5 }}>Round {tc.round}</span>
              {tc.success !== undefined && <span style={{ fontSize: 10 }}>{tc.success ? '✅' : '❌'}</span>}
            </summary>
            <div className="tool-body">{JSON.stringify(tc.args, null, 2)}</div>
          </details>
        ))}
      </div>
    );
  }

  if (role === 'status') {
    return <div className="msg-group status" style={{ animation: 'slideUp .3s ease' }}><div className="msg-bubble">{content}</div></div>;
  }

  const cls = role === 'user' ? 'user' : 'agent';
  return (
    <div className={`msg-group ${cls}`} style={{ animation: 'slideUp .3s ease' }}>
      <div className="msg-bubble" dangerouslySetInnerHTML={role === 'user' ? { __html: content } : { __html: renderMarkdown(content) }} />
      <div className="msg-time">{time}</div>
    </div>
  );
}
