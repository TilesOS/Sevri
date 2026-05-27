/* global React */
const { useState: useStateProj } = React;

const STEPS = [
  { id: 'scope',    code: '01', t: 'Write the one-sentence pitch',           done: true,  active: false },
  { id: 'users',    code: '02', t: 'Describe a single believable user',      done: true,  active: false },
  { id: 'workflow', code: '03', t: 'Map the core workflow, end to end',      done: false, active: true  },
  { id: 'build',    code: '04', t: 'Pick a stack that matches your skills',  done: false, active: false },
  { id: 'ship',     code: '05', t: "Define 'done enough to share'",          done: false, active: false },
];

function Project() {
  const [sel, setSel] = useStateProj('workflow');
  const step = STEPS.find(s => s.id === sel);

  return (
    <div>
      {/* Mini topbar */}
      <div className="row between center" style={{ gap: 24, marginBottom: 8 }}>
        <div className="row center" style={{ gap: 14 }}>
          <div style={{ width: 44, height: 44, background: 'var(--ink)', color: 'var(--yellow)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: 22, borderRadius: 4 }}>S</div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, letterSpacing: '.14em' }}>AMMAR</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, letterSpacing: '.14em' }}>PROJECT</div>
          </div>
        </div>
        <h1 className="display" style={{ fontSize: 'clamp(48px, 6vw, 80px)', margin: 0, textAlign: 'center' }}>TRANSIT&nbsp;PLANNER</h1>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, letterSpacing: '.14em', lineHeight: 1.4 }}>
          <div>WK 04 / 08</div>
          <div style={{ fontWeight: 600 }}>32 / 56 HRS</div>
        </div>
      </div>
      <hr className="solid-thin" />
      <div className="meta-strip" style={{ marginTop: 12 }}>
        <span><span className="pink-star">✦</span> SOFTWARE</span>
        <span>8 WEEKS</span>
        <span>6 HRS / WK</span>
        <span>NEXT → WORKFLOW</span>
      </div>
      <hr className="dashed" />

      {/* Title block */}
      <div style={{ position: 'relative', marginTop: 24 }}>
        <div className="handnote" style={{ color: 'var(--pink)', marginBottom: 4 }}>~ active project ~</div>
        <h1 className="display big" style={{ margin: 0, maxWidth: 980 }}>
          neighborhood<br/><span className="hl-yellow">transit planner</span><span style={{ color: 'var(--pink)' }}>.</span>
        </h1>
        <p style={{ fontSize: 17, fontWeight: 500, color: 'var(--ink-soft)', marginTop: 22, maxWidth: 720, lineHeight: 1.5 }}>
          A weekly transit-aware planner for students juggling class, work, and extracurriculars. Small scope. Real users. Honest story.
        </p>
      </div>

      {/* SECTION 01 — roadmap */}
      <div className="row" style={{ alignItems: 'flex-end', gap: 28, marginTop: 56, marginBottom: 22 }}>
        <div className="section-num">01</div>
        <div style={{ flex: 1 }}>
          <h2 className="display" style={{ fontSize: 44, margin: '0 0 4px' }}>the roadmap</h2>
          <div className="handnote">five steps. no detours.</div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '.18em', color: 'var(--ink-muted)' }}>2 / 5 DONE</div>
      </div>
      <hr className="solid-thin" />

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 22, marginTop: 24, alignItems: 'start' }}>
        {/* Steps */}
        <div className="col" style={{ gap: 12 }}>
          {STEPS.map(s => {
            const klass = s.done ? 'done' : s.active ? 'active' : 'locked';
            return (
              <button key={s.id} onClick={() => setSel(s.id)} className={`step-row ${klass} ${sel===s.id ? '' : ''}`}
                style={{ cursor: s.done || s.active ? 'pointer' : 'default', textAlign: 'left', font: 'inherit',
                         outline: sel===s.id ? '3px solid var(--pink)' : 'none', outlineOffset: 2 }}>
                <div className="num" style={{ background: s.active ? 'var(--ink)' : s.done ? 'var(--green)' : 'var(--paper-card)', color: s.active ? 'var(--yellow)' : 'var(--ink)', border: '2px solid var(--ink)', borderRadius: 4, width: 56, height: 56, display: 'grid', placeItems: 'center', fontSize: 26 }}>
                  {s.done ? '✓' : s.code}
                </div>
                <div>
                  <div className="sub">step {s.code}</div>
                  <div className="ttl">{s.t}</div>
                </div>
                {s.done ? <span className="kicker" style={{ color: 'var(--ink-muted)' }}>DONE</span>
                  : s.active ? <span className="pill"><span className="dot"></span>IN PROGRESS</span>
                  : <span className="kicker" style={{ color: 'var(--ink-muted)' }}>LOCKED</span>}
              </button>
            );
          })}
        </div>

        {/* Right column: detail + coach */}
        <div className="col" style={{ gap: 18, position: 'sticky', top: 24 }}>
          <div className="rec-card" style={{ background: 'var(--paper-card)' }}>
            <span className="kicker"><span className="star">✦</span>STEP {step.code}</span>
            <h3 className="title" style={{ fontSize: 30 }}>{step.t}</h3>
            <p className="body">
              Draft the shortest honest version of the path a real user takes — first open to finishing a week. Don't dress it up.
            </p>
            <textarea defaultValue={"1. User opens the app on Sunday night.\n2. Enters fixed classes, work shifts, commute legs.\n3. Sevri proposes a transit-aware plan for the week.\n4. User edits it. Reminders go out each weekday morning."}
              style={{ width: '100%', minHeight: 150, border: '2px solid var(--ink)', borderRadius: 4, background: 'var(--paper)', padding: 14, fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6, resize: 'vertical', boxShadow: '3px 3px 0 var(--ink)' }} />
            <div className="row" style={{ gap: 10 }}>
              <button className="btn primary">save draft</button>
              <button className="btn" style={{ background: 'var(--paper-card)', color: 'var(--ink)' }}>ask sevri</button>
            </div>
          </div>

          <div className="coach">
            <span className="kicker"><span className="star" style={{ color: 'var(--cyan)' }}>✦</span>SEVRI · LIVE FEEDBACK</span>
            <h3>Step 3 is doing two things.</h3>
            <p>Planning and routing are different jobs. Pick one for v1. "Reminders are emailed" is a promise — decide now whether it's in scope for 8 weeks, or cut it. Keep the first version honest about what's in and out.</p>
            <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <span className="pill" style={{ background: 'transparent', color: 'var(--paper-card)', borderColor: 'var(--paper-card)' }}>Scope risk</span>
              <span className="pill" style={{ background: 'transparent', color: 'var(--paper-card)', borderColor: 'var(--paper-card)' }}>Honesty check</span>
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontFamily: 'var(--font-hand)', fontWeight: 700, fontSize: 22, color: 'var(--ink-muted)', marginTop: 56, textAlign: 'center' }}>
        — scope matters. finishability matters. —
      </p>
    </div>
  );
}

window.Project = Project;
