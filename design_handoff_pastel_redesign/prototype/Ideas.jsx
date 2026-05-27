/* global React */
const { useState: useStateIdeas } = React;

const RECS = {
  software: [
    {
      title: 'Neighborhood transit planner',
      ribbon: 'Quickest to ship',
      tone: 'featured',
      diff: 'Beginner',
      p: 'A weekly transit-plan tool for students juggling class, work, and extracurriculars. Small scope, real users — your classmates — clean story.',
      m: { Timeline: '8 wks', Weekly: '6 hrs', Finish: '9/10', Wow: '7/10' },
    },
    {
      title: 'Ambient study-buddy for ADHD brains',
      ribbon: 'Strongest portfolio story',
      tone: 'cyan',
      diff: 'Intermediate',
      p: 'A low-friction companion app that nudges, not reminds. One novel interaction, one believable user, one defensible claim at the end.',
      m: { Timeline: '10 wks', Weekly: '7 hrs', Finish: '7/10', Wow: '9/10' },
    },
    {
      title: 'Climate-data explainer for your school',
      ribbon: 'Most community reach',
      tone: 'plain',
      diff: 'Beginner',
      p: 'Turn a public dataset into a small, opinionated explainer site about your town or campus. Data + design, finishable with care.',
      m: { Timeline: '6 wks', Weekly: '5 hrs', Finish: '9/10', Wow: '7/10' },
    },
  ],
  research: [
    { title: 'Survey of LLM hallucination benchmarks', ribbon: 'Lowest risk', tone: 'cyan',
      diff: 'Intermediate', p: 'A careful lit review on a sharp question, with a small original analysis at the end. Feasible with library access.',
      m: { Timeline: '10 wks', Weekly: '6 hrs', Finish: '9/10', Wow: '7/10' } },
    { title: 'Micro-study: peer learning in high-school CS', ribbon: 'Most original', tone: 'featured',
      diff: 'Advanced', p: 'Run a small, IRB-light observational study inside a club. Real evidence, real writing, realistic if you start early.',
      m: { Timeline: '12 wks', Weekly: '7 hrs', Finish: '6/10', Wow: '9/10' } },
    { title: 'Replication: a tiny but finishable HCI paper', ribbon: 'Steadiest path', tone: 'plain',
      diff: 'Intermediate', p: 'Pick one figure from a 2018 paper. Reproduce it. Write 6 honest pages on what changed and why. Boring, defensible, real.',
      m: { Timeline: '8 wks', Weekly: '5 hrs', Finish: '8/10', Wow: '8/10' } },
  ],
};

function Ideas() {
  const [track, setTrack] = useStateIdeas('software');
  const list = RECS[track];

  return (
    <div>
      {/* Mini topbar */}
      <div className="row between center" style={{ gap: 24, marginBottom: 8 }}>
        <div className="row center" style={{ gap: 14 }}>
          <div style={{ width: 44, height: 44, background: 'var(--ink)', color: 'var(--yellow)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: 22, borderRadius: 4 }}>S</div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, letterSpacing: '.14em' }}>AMMAR</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, letterSpacing: '.14em' }}>IDEAS</div>
          </div>
        </div>
        <h1 className="display" style={{ fontSize: 'clamp(56px, 7vw, 96px)', margin: 0 }}>3 PATHS</h1>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, letterSpacing: '.14em', lineHeight: 1.4 }}>
          <div>BASED ON</div>
          <div style={{ fontWeight: 600 }}>YOUR ONBOARDING</div>
        </div>
      </div>
      <hr className="solid-thin" />

      <div className="meta-strip" style={{ marginTop: 12 }}>
        <span><span className="pink-star">✦</span> 3 OPTIONS</span>
        <span>2 TRACKS</span>
        <span>EACH HONESTLY DIFFERENT</span>
      </div>
      <hr className="dashed" />

      <div style={{ position: 'relative', marginTop: 28 }}>
        <div className="handnote" style={{ color: 'var(--pink)', marginBottom: 4 }}>~ pick honestly ~</div>
        <h1 className="display big" style={{ margin: 0, maxWidth: 980 }}>
          three <span className="hl-yellow">actually</span> different<br/> directions<span style={{ color: 'var(--pink)' }}>.</span>
        </h1>
        <Squiggle style={{ top: 30, right: 60 }} />
      </div>

      <p style={{ fontSize: 18, lineHeight: 1.5, fontWeight: 500, color: 'var(--ink-soft)', marginTop: 24, maxWidth: 700 }}>
        The strongest recommendation isn't the most theatrical one. It's the one that still looks thoughtful when you're busy, tired, and halfway through the semester.
      </p>

      {/* Track switch */}
      <div className="row" style={{ gap: 12, marginTop: 28, marginBottom: 12 }}>
        {['software', 'research'].map(t => (
          <button key={t} className={`tab ${track===t?'is-active':''}`} onClick={() => setTrack(t)} style={{ width: 'auto', minWidth: 160, justifyContent: 'center', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            {track===t && '→ '}{t}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '.18em', color: 'var(--ink-muted)', alignSelf: 'center' }}>
          KEYBOARD: 1 · 2 · 3 TO PICK
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26, marginTop: 28 }}>
        {list.map((r, i) => (
          <div key={i} className={`rec-card ${r.tone === 'featured' ? 'featured' : r.tone === 'cyan' ? 'cyan' : ''}`}>
            <div className="ribbon" style={{ background: r.tone==='featured' ? 'var(--pink)' : 'var(--ink)', color: r.tone==='featured' ? 'var(--ink)' : 'var(--paper-card)' }}>{r.ribbon}</div>

            <div className="row between center">
              <span className="kicker"><span className="star">✦</span>OPTION 0{i+1}</span>
              <span className="kicker" style={{ color: 'var(--ink-muted)' }}>{r.diff}</span>
            </div>

            <h3 className="title">{r.title}</h3>
            <p className="body">{r.p}</p>

            <div className="meta-grid">
              {Object.entries(r.m).map(([k, v]) => (
                <div key={k}>
                  <div className="k">{k}</div>
                  <div className="v">{v}</div>
                </div>
              ))}
            </div>

            <div className="row" style={{ gap: 8 }}>
              <button className="btn" style={{ background: 'var(--ink)', color: 'var(--paper-card)', flex: 1, justifyContent: 'center' }}>pick this →</button>
              <button className="btn ghost" style={{ borderColor: 'var(--ink)' }}>save</button>
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontFamily: 'var(--font-hand)', fontWeight: 700, fontSize: 22, color: 'var(--ink-muted)', marginTop: 56, textAlign: 'center' }}>
        — finishability beats theatre, every time —
      </p>
    </div>
  );
}

window.Ideas = Ideas;
