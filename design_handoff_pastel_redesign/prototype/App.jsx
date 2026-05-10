/* global React, Sidebar, Today, Ideas, Project */
const { useState, useEffect } = React;

function App() {
  const KEY = 'sevri-redesign-route';
  const [route, setRoute] = useState(() => localStorage.getItem(KEY) || 'today');
  useEffect(() => { localStorage.setItem(KEY, route); }, [route]);

  return (
    <div className="app">
      <Sidebar route={route} setRoute={setRoute} />
      <main className="main-pane">
        {route === 'today'   && <Today goIdeas={() => setRoute('ideas')} goProject={() => setRoute('project')} goOnboarding={() => setRoute('today')} />}
        {route === 'ideas'   && <Ideas />}
        {route === 'project' && <Project />}
        {route === 'roadmap' && <Project />}
        {(route === 'files' || route === 'activity' || route === 'settings') && (
          <div style={{ paddingTop: 80, textAlign: 'center' }}>
            <div className="handnote" style={{ color: 'var(--pink)' }}>~ not in this pass ~</div>
            <h1 className="display big" style={{ marginTop: 8 }}>{route}<span style={{ color: 'var(--pink)' }}>.</span></h1>
            <p style={{ fontSize: 16, marginTop: 16, color: 'var(--ink-soft)' }}>
              Keep the redesign focused. Try <button className="btn" style={{ background: 'var(--yellow)', color: 'var(--ink)' }} onClick={() => setRoute('today')}>today</button>, <button className="btn" style={{ background: 'var(--cyan)', color: 'var(--ink)' }} onClick={() => setRoute('ideas')}>ideas</button>, or <button className="btn" style={{ background: 'var(--pink)', color: 'var(--ink)' }} onClick={() => setRoute('project')}>project</button>.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
