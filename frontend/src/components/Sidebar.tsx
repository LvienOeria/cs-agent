interface Props {
  active: string;
  onNav: (view: string) => void;
  tokens: number;
  rounds: number;
  latency: string;
  provider: string;
  model: string;
}

export function Sidebar({ active, onNav, tokens, rounds, latency, provider, model }: Props) {
  const items = [
    { id: 'chat', icon: '💬', label: '对话' },
    { id: 'kb', icon: '📚', label: '知识库' },
    { id: 'settings', icon: '⚙', label: '设置' },
  ];

  return (
    <aside className="sidebar">
      <div className="logo"><h1>CS Agent</h1><span>v0.3.0</span></div>
      {items.map(it => (
        <button key={it.id} className={`nav-item${active === it.id ? ' active' : ''}`} onClick={() => onNav(it.id)}>
          <span className="icon">{it.icon}</span><span>{it.label}</span>
        </button>
      ))}
      <div className="spacer" />
      <div className="sidebar-footer">
        <div className="row"><span>Provider</span><span>{provider}</span></div>
        <div className="row"><span>Model</span><span>{model}</span></div>
        <div className="row"><span>Token</span><span>{tokens.toLocaleString()}</span></div>
        <div className="row"><span>轮次</span><span>{rounds}</span></div>
        <div className="row"><span>响应</span><span>{latency}</span></div>
      </div>
    </aside>
  );
}
