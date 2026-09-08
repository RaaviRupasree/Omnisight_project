import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [bugType, setBugType] = useState('clipping');
  const [viewport, setViewport] = useState('mobile');
  const [scanning, setScanning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [prs, setPrs] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [selectedPrId, setSelectedPrId] = useState(null);
  const [iframeUrl, setIframeUrl] = useState(`${API_BASE}/static/mock_site/index.html`);

  const consoleEndRef = useRef(null);

  // Load initial data
  useEffect(() => {
    fetchPrs();
    fetchHistory();
  }, []);

  // Auto-scroll console
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const fetchPrs = async (forceSelectId = null) => {
    try {
      const res = await fetch(`${API_BASE}/api/prs`);
      if (res.ok) {
        const data = await res.json();
        setPrs(data);
        if (forceSelectId !== null) {
          // After a new scan, always jump to the newly created PR
          setSelectedPrId(forceSelectId);
        } else if (data.length > 0 && !selectedPrId) {
          // On initial load, pick the newest PR
          setSelectedPrId(data[data.length - 1].id);
        }
      }
    } catch (err) {
      console.error('Error fetching PRs:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const triggerScan = async () => {
    if (scanning) return;

    setScanning(true);
    setLogs(['[Orchestrator] Requesting Playwright browser spawn...']);
    setActiveRun(null);

    try {
      const res = await fetch(`${API_BASE}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bug_type: bugType, viewport })
      });

      if (!res.ok) {
        throw new Error('Scan failed');
      }

      const result = await res.json();
      
      // Play back logs line-by-line to look cinematic
      let lineIndex = 0;
      setLogs([result.logs[0]]);
      const newPrId = result.pr ? result.pr.id : null;
      
      const timer = setInterval(() => {
        lineIndex++;
        if (lineIndex < result.logs.length) {
          setLogs(prev => [...prev, result.logs[lineIndex]]);
        } else {
          clearInterval(timer);
          setScanning(false);
          setActiveRun(result);
          // Pass newPrId so fetchPrs always selects the latest PR
          fetchPrs(newPrId);
          fetchHistory();
          // Reload iframe
          setIframeUrl(`${API_BASE}/static/mock_site/index.html?t=${Date.now()}`);
        }
      }, 550); // Playback log delay (ms)

    } catch (err) {
      setScanning(false);
      setLogs(prev => [...prev, `[Error] Run failed: ${err.message}`]);
    }
  };

  const handlePrAction = async (prId, action) => {
    try {
      const res = await fetch(`${API_BASE}/api/prs/${prId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (res.ok) {
        fetchPrs();
        fetchHistory();
        // Force iframe reload
        setIframeUrl(`${API_BASE}/static/mock_site/index.html?t=${Date.now()}`);
      } else {
        const errData = await res.json();
        alert(`Failed to ${action} PR: ${errData.detail}`);
      }
    } catch (err) {
      alert(`Error connection to API: ${err.message}`);
    }
  };

  const deletePr = async (prId, e) => {
    e.stopPropagation(); // Prevent PR card selection
    try {
      const res = await fetch(`${API_BASE}/api/prs/${prId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (selectedPrId === prId) {
          setSelectedPrId(null);
        }
        fetchPrs();
      } else {
        const errData = await res.json();
        alert(`Failed to delete PR: ${errData.detail}`);
      }
    } catch (err) {
      alert(`Error connection to API: ${err.message}`);
    }
  };

  const selectedPr = prs.find(p => p.id === selectedPrId);

  // Format CSS diff line-by-line
  const renderDiffContent = (diff) => {
    if (!diff) return null;
    return diff.split('\n').map((line, idx) => {
      if (line.startsWith('+')) {
        return <span key={idx} className="diff-line-add">{line}</span>;
      } else if (line.startsWith('-')) {
        return <span key={idx} className="diff-line-del">{line}</span>;
      }
      return <span key={idx}>{line}</span>;
    });
  };

  const getLogClass = (line) => {
    if (line.includes('[Error]')) return 'console-line error';
    if (line.includes('PASS') || line.includes('successfully') || line.includes('passes')) return 'console-line success';
    if (line.includes('FAIL') || line.includes('Detected:')) return 'console-line warning';
    if (line.includes('[Orchestrator]') || line.includes('[VLM Engine]')) return 'console-line info';
    return 'console-line';
  };

  return (
    <div className="app-container">
      {/* Navbar Header */}
      <header className="navbar-header">
        <div className="navbar-content">
          <div className="brand">
            <div className="logo-icon">👁️</div>
            <div className="brand-text">
              <h1>OmniSight</h1>
              <p>Multimodal UI Self-Healing & Autonomous RPA</p>
            </div>
          </div>

          <div className="nav-tabs">
            <button 
              className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Operations Studio
            </button>
            <button 
              className={`tab-btn ${activeTab === 'prs' ? 'active' : ''}`}
              onClick={() => setActiveTab('prs')}
            >
              🔀 Pull Requests {prs.filter(p => p.status === 'OPEN').length > 0 && (
                <span style={{background: 'var(--danger)', color: '#fff', fontSize: '0.65rem', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>
                  {prs.filter(p => p.status === 'OPEN').length}
                </span>
              )}
            </button>
            <button 
              className={`tab-btn ${activeTab === 'target-app' ? 'active' : ''}`}
              onClick={() => setActiveTab('target-app')}
            >
              🛍️ Target Website
            </button>
          </div>

          <div className="status-badge">
            <div className="status-dot"></div>
            OmniSight Node: ONLINE
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="dashboard-body">
        
        {activeTab === 'dashboard' && (
          <div className="dashboard-grid">
            
            {/* Left Column Controls */}
            <div className="controls-col">
              
              {/* Scan Configuration */}
              <div className="glass-card">
                <div className="card-header">
                  <h2>⚙️ Scan Controller</h2>
                </div>
                <div className="card-body">
                  <div className="form-section">
                    <label>Target Bug Injection</label>
                    <select 
                      className="select-input"
                      value={bugType}
                      onChange={(e) => setBugType(e.target.value)}
                      disabled={scanning}
                    >
                      <option value="clipping">Checkout Button Clipping (Mobile)</option>
                      <option value="overlap">Text Overlapping Subtitle (Global)</option>
                      <option value="contrast">Low Contrast Totals Block (WCAG)</option>
                      <option value="hidden">Hidden Submit Button (RPA Block)</option>
                      <option value="none">No Bug (Baseline Check)</option>
                    </select>
                  </div>

                  <div className="form-section">
                    <label>Device Profile Viewport</label>
                    <select 
                      className="select-input"
                      value={viewport}
                      onChange={(e) => setViewport(e.target.value)}
                      disabled={scanning}
                    >
                      <option value="mobile">Mobile View (390x844)</option>
                      <option value="desktop">Desktop View (1280x800)</option>
                    </select>
                  </div>

                  <button 
                    className="action-btn"
                    onClick={triggerScan}
                    disabled={scanning}
                  >
                    {scanning ? (
                      <>
                        <div className="spinner" style={{width: '18px', height: '18px', borderWidth: '2px'}}></div>
                        Self-Healing Loop Running...
                      </>
                    ) : (
                      '🚀 Run Visual Audit & Heal'
                    )}
                  </button>
                </div>
              </div>

              {/* Console Output logs */}
              <div className="glass-card">
                <div className="card-header">
                  <h2>💻 Agent Execution Console</h2>
                </div>
                <div className="card-body" style={{padding: '0'}}>
                  <div className="console-log">
                    {logs.length === 0 && (
                      <span style={{color: 'var(--text-muted)'}}>[Console] Awaiting agent launch...</span>
                    )}
                    {logs.map((logLine, index) => (
                      <div key={index} className={getLogClass(logLine)}>
                        {logLine}
                      </div>
                    ))}
                    <div ref={consoleEndRef} />
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column Studio */}
            <div className="glass-card" style={{minHeight: '600px'}}>
              <div className="card-header">
                <h2>🔍 Visual Audit Studio</h2>
              </div>
              <div className="card-body" style={{height: 'calc(100% - 60px)', display: 'flex', flexDirection: 'column'}}>
                
                {scanning && !activeRun && (
                  <div className="studio-placeholder">
                    <div className="spinner"></div>
                    <p style={{marginTop: '1rem'}}>Agent navigating page, capturing layout coordinates, and generating VLM audits...</p>
                  </div>
                )}

                {!scanning && !activeRun && (
                  <div className="studio-placeholder">
                    <div className="studio-placeholder-icon">👁️</div>
                    <p>Select a bug configuration on the left and trigger the self-healing process.</p>
                  </div>
                )}

                {activeRun && (
                  <div className="scan-details">
                    <div className={`scan-status-banner ${activeRun.status === 'HEALED' ? 'healed' : 'pass'}`}>
                      <div>
                        <span style={{color: 'var(--text-secondary)', marginRight: '0.5rem'}}>Status:</span>
                        <span className={`status-badge-large ${activeRun.status === 'HEALED' ? 'healed' : 'pass'}`}>
                          {activeRun.status}
                        </span>
                      </div>
                      <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Run ID: {activeRun.id}</span>
                    </div>

                    <div className="anomaly-report">
                      <h3>VLM Finding Details</h3>
                      <p>{activeRun.description}</p>
                      <div className="anomaly-reasoning">
                        <strong>Spatial Analysis:</strong> {activeRun.reasoning}
                      </div>
                    </div>

                    {activeRun.status === 'HEALED' && (
                      <>
                        <div className="comparison-grid">
                          <div className="comparison-pane">
                            <span className="pane-label">🔴 Before Fix (Buggy)</span>
                            <div className={`screenshot-frame ${activeRun.viewport}`}>
                              <img 
                                src={`${API_BASE}${activeRun.before_screenshot}`} 
                                alt="Before Fix" 
                                className="screenshot-img" 
                              />
                            </div>
                          </div>

                          <div className="comparison-pane">
                            <span className="pane-label">🟢 After Fix (Healed)</span>
                            <div className={`screenshot-frame ${activeRun.viewport}`}>
                              <img 
                                src={`${API_BASE}${activeRun.after_screenshot}`} 
                                alt="After Fix" 
                                className="screenshot-img" 
                              />
                            </div>
                          </div>
                        </div>

                        <div className="code-panel">
                          <div className="code-panel-header">
                            <span>CSS patch applied to target DOM copy</span>
                            <span>CSS</span>
                          </div>
                          <pre className="code-content">{activeRun.css_fix}</pre>
                        </div>
                        
                        {activeRun.pr && (
                          <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem'}}>
                            <button 
                              className="btn-merge"
                              onClick={() => {
                                setSelectedPrId(activeRun.pr.id);
                                setActiveTab('prs');
                              }}
                            >
                              Review Pull Request #{activeRun.pr.id} ➔
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {activeRun.status === 'PASS' && (
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', color: 'var(--success)'}}>
                        <div style={{fontSize: '4rem'}}>✓</div>
                        <p style={{fontWeight: 'bold', fontSize: '1.2rem', marginTop: '1rem'}}>Layout Validation Complete</p>
                        <p style={{color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '400px', marginTop: '0.5rem'}}>
                          The webpage conforms to all structural alignment, text sizing, and color contrast constraints. No heals required!
                        </p>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {activeTab === 'prs' && (
          <div className="glass-card">
            <div className="card-header">
              <h2>🔀 CI/CD Pull Request Hub</h2>
            </div>
            <div className="card-body">
              {prs.length === 0 ? (
                <div className="studio-placeholder" style={{minHeight: '500px'}}>
                  <div className="studio-placeholder-icon">🔀</div>
                  <p>No automated Pull Requests generated yet. Run a scan with active bugs to trigger healer branch creation.</p>
                </div>
              ) : (
                <div className="pr-container">
                  
                  {/* PR List Column */}
                  <div className="pr-list">
                    {prs.map(pr => (
                      <div 
                        key={pr.id} 
                        className={`pr-card ${selectedPrId === pr.id ? 'active' : ''}`}
                        onClick={() => setSelectedPrId(pr.id)}
                      >
                        <div className="pr-card-header">
                          <span className="pr-number">PR #{pr.id}</span>
                          <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                            <span className={`pr-badge ${pr.status.toLowerCase()}`}>
                              {pr.status}
                            </span>
                            <button 
                              className="btn-icon" 
                              onClick={(e) => deletePr(pr.id, e)}
                              title="Delete PR"
                              style={{background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0 4px', opacity: 0.7}}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <span className="pr-title">{pr.title}</span>
                        <div className="pr-meta">
                          <span>branch: {pr.branch.split('/').pop()}</span>
                          <span>hash: {pr.commit_hash}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* PR Details View */}
                  <div style={{flexGrow: '1', borderLeft: '1px solid var(--border-glass)', paddingLeft: '2rem'}}>
                    {selectedPr ? (
                      <div className="pr-details">
                        
                        <div className="pr-details-header">
                          <div className="pr-details-title-area">
                            <h2>{selectedPr.title}</h2>
                            <div className="pr-details-branch-info">
                              <span><strong>Branch:</strong> {selectedPr.branch}</span>
                              <span><strong>Commit Hash:</strong> {selectedPr.commit_hash}</span>
                              <span><strong>Status:</strong> {selectedPr.status}</span>
                            </div>
                          </div>

                          {selectedPr.status === 'OPEN' && (
                            <div className="pr-actions">
                              <button 
                                className="btn-decline"
                                onClick={() => handlePrAction(selectedPr.id, 'decline')}
                              >
                                Decline Fix
                              </button>
                              <button 
                                className="btn-merge"
                                onClick={() => handlePrAction(selectedPr.id, 'merge')}
                              >
                                Approve & Merge
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="anomaly-report">
                          <h3>Justification for Repair</h3>
                          <p>{selectedPr.body}</p>
                        </div>

                        <div className="diff-container">
                          <div className="diff-header">
                            <span>git diff styles.css</span>
                          </div>
                          <pre className="diff-content">
                            {renderDiffContent(selectedPr.diff)}
                          </pre>
                        </div>

                        <div className="pane-label">Visual Healing Verification Proof</div>
                        <div className="comparison-grid">
                          <div className="comparison-pane">
                            <span className="pane-label">🔴 Before Fix</span>
                            <div className="screenshot-frame" style={{maxHeight: '300px'}}>
                              <img 
                                src={`${API_BASE}${selectedPr.before_screenshot}`} 
                                alt="Before Fix" 
                                className="screenshot-img" 
                              />
                            </div>
                          </div>

                          <div className="comparison-pane">
                            <span className="pane-label">🟢 After Fix</span>
                            <div className="screenshot-frame" style={{maxHeight: '300px'}}>
                              <img 
                                src={`${API_BASE}${selectedPr.after_screenshot}`} 
                                alt="After Fix" 
                                className="screenshot-img" 
                              />
                            </div>
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div className="pr-viewer-empty">
                        <p>Select a Pull Request from the left list to review its visual diff details.</p>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'target-app' && (
          <div className="glass-card">
            <div className="card-header">
              <h2>🛍️ E-Commerce Target App Sandbox</h2>
            </div>
            <div className="card-body">
              <div className="iframe-container">
                <div className="iframe-bar">
                  <span style={{fontSize: '0.85rem', color: '#fff', fontWeight: 'bold'}}>Live Target Sandbox:</span>
                  <div className="iframe-address">{iframeUrl}</div>
                  
                  <div className="iframe-actions">
                    <a 
                      href={`${API_BASE}/static/mock_site/index.html`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="btn-link"
                    >
                      🔗 Open Clean Webpage
                    </a>
                    <a 
                      href={`${API_BASE}/static/mock_site/index.html?bug=clipping`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="btn-link"
                      style={{borderColor: 'var(--danger)', color: 'var(--danger)'}}
                    >
                      🔗 Open with Clipping Bug
                    </a>
                  </div>
                </div>

                <iframe 
                  src={iframeUrl} 
                  title="Target Sandbox" 
                  className="live-iframe"
                />
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
