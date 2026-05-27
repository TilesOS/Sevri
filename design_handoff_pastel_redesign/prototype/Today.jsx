/* global React */
function Squiggle({ style }) {
  return (
    <svg className="deco-squiggle" width="180" height="40" viewBox="0 0 180 40" fill="none" style={style}>
      <path d="M2 22 C 18 4, 36 40, 54 22 S 90 4, 108 22 S 144 40, 162 22 L 178 22"
            stroke="var(--pink)" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}
window.Squiggle = Squiggle;

function MiniTopBar({ section, right }) {
  return (
    <>
      <div className="row between center" style={{ gap: 24, marginBottom: 8 }}>
        <div className="row center" style={{ gap: 14 }}>
          <div style={{ width: 44, height: 44, background: 'var(--ink)', color: 'var(--yellow)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: 22, borderRadius: 4 }}>S</div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, letterSpacing: '.14em' }}>AMMAR</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, letterSpacing: '.14em' }}>{section}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, letterSpacing: '.14em', lineHeight: 1.4 }}>
          {right}
        </div>
      </div>
      <hr className="solid-thin" />
    </>
  );
}
window.MiniTopBar = MiniTopBar;

function Today({ goIdeas, goProject, goOnboarding }) {
  return (
    <div style={{ position: 'relative' }}>
      <MiniTopBar section="DASHBOARD" right={<><div>TUE, 21 APR 2026</div><div style={{ fontWeight: 600 }}>WK 04 / 08</div></>} />

      {/* Greeting — replaces the original "Welcome back." */}
      <div style={{ position: 'relative', marginTop: 32 }}>
        <div className="kicker" style={{ marginBottom: 10 }}><span className="star">✦</span>WORKSPACE</div>
        <h1 className="display big" style={{ margin: 0 }}>
          welcome <span className="hl-yellow">back</span><span style={{ color: 'var(--pink)' }}>.</span>
        </h1>
        <Squiggle style={{ top: 30, right: 30 }} />
      </div>

      {/* Current project — the contrast card from the original, restyled */}
      <div className="coach" style={{ marginTop: 36, padding: '28px 30px', boxShadow: '6px 6px 0 var(--pink)' }}>
        <span className="kicker"><span className="star" style={{ color: 'var(--cyan)' }}>✦</span>CURRENT PROJECT</span>
        <h3 style={{ fontSize: 36, margin: '12px 0 10px', maxWidth: 720 }}>Neighborhood transit planner</h3>
        <p style={{ maxWidth: 560 }}>You're on step 3 of 5. Workflow draft is saved.</p>
        <div className="row" style={{ gap: 10, marginTop: 18 }}>
          <button className="btn primary" onClick={goProject}>open project →</button>
        </div>
      </div>

      {/* Two-up: Start a new direction · Saved ideas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, marginTop: 22 }}>
        <div className="rec-card" style={{ background: 'var(--paper-card)' }}>
          <span className="kicker"><span className="star">✦</span>START A NEW DIRECTION</span>
          <h3 className="title">Run onboarding again</h3>
          <p className="body">Four short pages. Useful when your interests shift or a deadline changes.</p>
          <div className="row">
            <button className="btn" style={{ background: 'var(--paper-card)', color: 'var(--ink)' }} onClick={goOnboarding}>start onboarding →</button>
          </div>
        </div>

        <div className="rec-card" style={{ background: 'var(--cyan)' }}>
          <span className="kicker"><span className="star">✦</span>SAVED IDEAS</span>
          <h3 className="title">2 directions saved for later</h3>
          <p className="body" style={{ color: 'var(--ink)' }}>Ambient study-buddy · Climate explainer for your school</p>
          <div className="row">
            <button className="btn" style={{ background: 'var(--ink)', color: 'var(--paper-card)' }} onClick={goIdeas}>see ideas →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Today = Today;
