/* global React */
function Sidebar({ route, setRoute }) {
  const pages = [
    { id: 'today',     label: 'today',     ico: '☐' },
    { id: 'ideas',     label: 'ideas',     ico: '✦' },
    { id: 'project',   label: 'project',   ico: '◐' },
    { id: 'roadmap',   label: 'roadmap',   ico: '↗' },
    { id: 'files',     label: 'files',     ico: '▤' },
  ];
  const steps = [
    { id: 's1', code: '01', name: 'Scope',    meta: 'done',        tone: 'green'  },
    { id: 's2', code: '02', name: 'Users',    meta: 'done',        tone: 'green'  },
    { id: 's3', code: '03', name: 'Workflow', meta: 'in progress', tone: 'cyan'   },
    { id: 's4', code: '04', name: 'Build',    meta: 'locked',      tone: 'paper'  },
    { id: 's5', code: '05', name: 'Ship',     meta: 'locked',      tone: 'paper'  },
  ];
  const archive = [
    { id: 'activity', label: 'activity', ico: '∿' },
    { id: 'settings', label: 'settings', ico: '⚙' },
  ];

  const stepBg = (t) => t === 'green' ? '#7BB661' : t === 'cyan' ? '#5BD0D6' : '#FBF6E9';

  return (
    <aside className="sidebar">
      <div className="user-tab">
        <div style={{ width: 36, height: 36, borderRadius: 999, border: '2px solid var(--ink)', background: 'var(--paper-card)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: 16 }}>A</div>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Ammar</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '.08em' }}>Wk 04 / 08</div>
        </div>
      </div>

      <div className="hand-label">~ pages ~ <span className="dashes"></span></div>
      <div className="col" style={{ gap: 8 }}>
        {pages.map(p => (
          <button key={p.id} className={`tab ${route===p.id?'is-active':''}`} onClick={() => setRoute(p.id)}>
            <span style={{ width: 18, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{p.ico}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      <div className="hand-label">~ roadmap ~ <span className="dashes"></span></div>
      <div className="col" style={{ gap: 8 }}>
        {steps.map(s => (
          <div key={s.id} className="course-tile" style={{ boxShadow: s.meta==='locked' ? 'none' : '3px 3px 0 var(--ink)', opacity: s.meta==='locked'?0.55:1 }}>
            <div className="badge" style={{ background: stepBg(s.tone) }}>{s.code}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
              <div className="meta">{s.meta}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="hand-label">~ archive ~ <span className="dashes"></span></div>
      <div className="col" style={{ gap: 8 }}>
        {archive.map(a => (
          <button key={a.id} className="tab flat" onClick={() => setRoute(a.id)} style={{ boxShadow: 'none', background: 'transparent', borderColor: 'transparent' }}>
            <span style={{ width: 18, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{a.ico}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
window.Sidebar = Sidebar;
