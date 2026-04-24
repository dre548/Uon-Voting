import React, { useState, useEffect, useRef } from 'react';
import uonLogo from './uon-logo.jpeg'; 

const API_BASE = 'https://uon-voting-backends.onrender.com';

const COLORS = {
  primary: '#004d28', secondary: '#d4af37', background: '#f4f7f6', surface: '#ffffff', text: '#333333', border: '#DDE3EE'
};

const styles = {
  container: { maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', color: COLORS.text },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `4px solid ${COLORS.secondary}`, paddingBottom: '10px', marginBottom: '20px' },
  btn: { backgroundColor: COLORS.primary, color: 'white', border: 'none', padding: '10px 20px', cursor: 'pointer', borderRadius: '5px', fontWeight: 'bold' },
  btnOutline: { backgroundColor: 'transparent', color: COLORS.primary, border: `2px solid ${COLORS.primary}`, padding: '8px 16px', cursor: 'pointer', borderRadius: '5px' },
  card: { backgroundColor: COLORS.surface, padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '20px' },
  input: { width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' },
  badge: { display: 'inline-block', padding: '4px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }
};

export default function App() {
  const [view, setView] = useState('HOME'); 
  const [candidates, setCandidates] = useState([]);
  const [cryptoParams, setCryptoParams] = useState(null);
  const [config, setConfig] = useState({ name: 'UoN General Election', status: 'open', positions: [] });
  
  const [adminCreds, setAdminCreds] = useState({ user: '', pass: '' });
  const [voterCreds, setVoterCreds] = useState({ id: '', pin: '' });
  const [activeVoter, setActiveVoter] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [message, setMessage] = useState(""); 

  useEffect(() => {
    fetch(`${API_BASE}/public-key`).then(r => r.json()).then(setCryptoParams);
    fetch(`${API_BASE}/settings`).then(r => r.json()).then(setConfig).catch(() => {});
    refreshCandidates();
  }, [view]);

  const refreshCandidates = () => fetch(`${API_BASE}/candidates`).then(r => r.json()).then(setCandidates);

  const modPow = (base, exp, mod) => {
    let result = 1n, b = window.BigInt(base), e = window.BigInt(exp), m = window.BigInt(mod);
    while (e > 0n) { if (e % 2n === 1n) result = (result * b) % m; b = (b * b) % m; e /= 2n; }
    return Number(result);
  };
  
  const generateHash = async (str) => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return window.BigInt("0x" + Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')); 
  };

  const renderHome = () => (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <img src={uonLogo} alt="University of Nairobi Logo" style={{ width: '100%', maxWidth: '300px', borderRadius: '8px' }} />
      <h1 style={{ color: COLORS.primary, marginTop: '30px' }}>{config.name} Portal</h1>
      <p style={{ fontSize: '1.2em' }}>
        Voting is currently: <strong style={{ color: config.status === 'open' ? 'green' : 'red' }}>{config.status.toUpperCase()}</strong>
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '30px', flexWrap: 'wrap' }}>
        <button style={{ ...styles.btn, fontSize: '1.2em', padding: '15px 30px' }} onClick={() => setView('VOTER_LOGIN')}>Cast Your Vote</button>
        <button style={styles.btnOutline} onClick={() => setView('ADMIN_LOGIN')}>Admin / Election Officials</button>
      </div>
    </div>
  );

  const renderAdminLogin = () => (
    <div style={{ ...styles.card, maxWidth: '400px', margin: '50px auto' }}>
      <h2 style={{ color: COLORS.primary }}>Admin Login</h2>
      <input style={styles.input} placeholder="Username" onChange={e => setAdminCreds({...adminCreds, user: e.target.value})} />
      <input style={styles.input} type="password" placeholder="Password" onChange={e => setAdminCreds({...adminCreds, pass: e.target.value})} />
      <button style={{ ...styles.btn, width: '100%' }} onClick={() => {
        if (adminCreds.user === 'admin' && adminCreds.pass === 'admin123') { setView('ADMIN_DASHBOARD'); } 
        else { alert('Invalid credentials'); }
      }}>Login</button>
      <button style={{ ...styles.btnOutline, width: '100%', marginTop: '10px' }} onClick={() => setView('HOME')}>Back</button>
    </div>
  );

  const renderVoterLogin = () => (
    <div style={{ ...styles.card, maxWidth: '400px', margin: '50px auto' }}>
      <h2 style={{ color: COLORS.primary }}>Voter Authentication</h2>
      <p>Enter your credentials from your printed PIN card to access the ballot.</p>
      <input style={styles.input} placeholder="National ID" onChange={e => setVoterCreds({...voterCreds, id: e.target.value})} />
      <input style={styles.input} type="password" placeholder="6-Digit PIN" onChange={e => setVoterCreds({...voterCreds, pin: e.target.value})} />
      <button style={{ ...styles.btn, width: '100%' }} onClick={() => {
        fetch(`${API_BASE}/voter/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ national_id: voterCreds.id, pin: voterCreds.pin })
        }).then(async r => {
          const data = await r.json();
          if (!r.ok) alert(data.detail);
          else { setActiveVoter(voterCreds.id); setMessage(`Authenticated: ${data.name}`); setView('VOTING'); }
        });
      }}>Authenticate & Vote</button>
      <button style={{ ...styles.btnOutline, width: '100%', marginTop: '10px' }} onClick={() => setView('HOME')}>Back</button>
    </div>
  );

  return (
    <div style={styles.container}>
      {view !== 'HOME' && view !== 'RECEIPT' && view !== 'VOTING' && (
        <div style={styles.header}>
          <h2 style={{ margin: 0, color: COLORS.primary }}>UoN E-Voting</h2>
          <button style={styles.btnOutline} onClick={() => { setActiveVoter(null); setView('HOME'); }}>Exit</button>
        </div>
      )}
      
      {view === 'HOME' && renderHome()}
      {view === 'ADMIN_LOGIN' && renderAdminLogin()}
      {view === 'VOTER_LOGIN' && renderVoterLogin()}
      {view === 'VOTING' && <VotingBooth activeVoter={activeVoter} candidates={candidates} config={config} cryptoParams={cryptoParams} generateHash={generateHash} modPow={modPow} onComplete={(code) => { setReceipt(code); setView('RECEIPT'); }} onExit={() => setView('HOME')} />}
      {view === 'RECEIPT' && (
        <div style={{ ...styles.card, textAlign: 'center', marginTop: '50px', backgroundColor: '#e8f5e9' }}>
          <h1 style={{ color: COLORS.primary }}>Vote Cast Successfully!</h1>
          <p>Your unique ballot tracking code is:</p>
          <h2 style={{ letterSpacing: '2px', background: '#fff', padding: '10px', display: 'inline-block', borderRadius: '5px' }}>{receipt}</h2>
          <button style={{ ...styles.btn, marginTop: '20px' }} onClick={() => { setActiveVoter(null); setView('HOME'); }}>Done</button>
        </div>
      )}
      {view === 'ADMIN_DASHBOARD' && <AdminDashboard candidates={candidates} refreshCandidates={refreshCandidates} config={config} setConfig={setConfig} />}
    </div>
  );
}

// --- VOTING BOOTH (HTML Stepper Logic) ---
function VotingBooth({ activeVoter, candidates, config, cryptoParams, generateHash, modPow, onComplete, onExit }) {
  const [selections, setSelections] = useState({});
  const [boothPos, setBoothPos] = useState(0);
  const [phase, setPhase] = useState('voting');
  
  const votingPositions = config.positions.filter(p => candidates.some(c => c.position === p));

  if (votingPositions.length === 0) return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>No Candidates Registered</h2>
      <button style={styles.btn} onClick={onExit}>Return Home</button>
    </div>
  );

  const currPos = votingPositions[boothPos];
  const currCands = candidates.filter(c => c.position === currPos);
  const isLast = boothPos === votingPositions.length - 1;

  const next = () => { if (isLast) setPhase('review'); else setBoothPos(p => p + 1); };
  const back = () => { if (phase === 'review') setPhase('voting'); else if (boothPos > 0) setBoothPos(p => p - 1); };
  const skip = () => { setSelections(p => ({...p, [currPos]: 'SKIP'})); if (isLast) setPhase('review'); else setBoothPos(p => p + 1); };

  const submitFinalBallot = async () => {
    const validSelectionPos = Object.keys(selections).find(k => selections[k] !== 'SKIP');
    if(!validSelectionPos) { alert("You must select at least one candidate."); return; }
    
    const candId = selections[validSelectionPos];
    const { p, g, Y } = cryptoParams;
    const m = modPow(g, candId, p), r = Math.floor(Math.random() * (p - 2)) + 1;
    const alpha = modPow(g, r, p), beta = (m * modPow(Y, r, p)) % p;
    const k = Math.floor(Math.random() * (p - 2)) + 1, t = modPow(g, k, p);
    const c = Number((await generateHash(`${alpha}${beta}${t}`)) % window.BigInt(p - 1));
    const s = (k + (c * r)) % (p - 1);

    fetch(`${API_BASE}/vote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alpha: String(alpha), beta: String(beta), t: String(t), s: String(s), national_id: activeVoter, candidate_id: candId })
    }).then(async res => {
      const data = await res.json();
      if (res.ok) onComplete(data.tracking_code); else alert("Error: " + data.detail);
    });
  };

  if (phase === 'review') {
    return (
      <div style={styles.card}>
        <h2 style={{ color: COLORS.primary }}>Review Your Selections</h2>
        <div style={{ background: '#fffbee', padding: '10px', borderRadius: '5px', marginBottom: '15px', color: '#92400e' }}>⚠ Please review carefully. Once submitted, your ballot cannot be changed.</div>
        {votingPositions.map(pos => {
          const sel = selections[pos];
          const cand = sel && sel !== 'SKIP' ? candidates.find(c => c.id === sel) : null;
          return (
            <div key={pos} style={{ display: 'flex', alignItems: 'center', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '10px', background: cand ? '#f0fdf4' : '#fef2f2' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#666' }}>{pos}</div>
                {cand ? <div><strong>{cand.name}</strong> ({cand.party})</div> : <div style={{ color: 'red' }}>Not Selected / Skipped</div>}
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button style={{ ...styles.btnOutline, flex: 1 }} onClick={back}>← Edit</button>
          <button style={{ ...styles.btn, flex: 2 }} onClick={submitFinalBallot}>✅ Cast My Ballot</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>{currPos}</h2>
        <span style={{ color: '#666' }}>Position {boothPos + 1} of {votingPositions.length}</span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        {currCands.map(c => (
          <div key={c.id} onClick={() => setSelections({...selections, [currPos]: c.id})} style={{ border: `2px solid ${selections[currPos] === c.id ? COLORS.secondary : '#ddd'}`, borderRadius: '10px', padding: '15px', textAlign: 'center', cursor: 'pointer', background: selections[currPos] === c.id ? '#fffbee' : '#fff' }}>
            {c.photo_url ? <img src={c.photo_url} alt={c.name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '10px' }} /> : <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#eee', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>}
            <div style={{ fontWeight: 'bold' }}>{c.name}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{c.party}</div>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          {boothPos > 0 && <button style={{...styles.btnOutline, marginRight: '10px'}} onClick={back}>← Back</button>}
          <button style={{...styles.btnOutline, color: '#D97706', borderColor: '#fde68a'}} onClick={skip}>Skip →</button>
        </div>
        <button style={{...styles.btn, opacity: selections[currPos] ? 1 : 0.5}} disabled={!selections[currPos]} onClick={next}>{isLast ? 'Review Selections →' : 'Next Position →'}</button>
      </div>
    </div>
  );
}

// --- ADMIN DASHBOARD ---
function AdminDashboard({ candidates, refreshCandidates, config, setConfig }) {
  const [tab, setTab] = useState('OVERVIEW');
  const [newCand, setNewCand] = useState({ name: '', party: '', position: config.positions[0] || '', photo_url: '' });
  const [candFilter, setCandFilter] = useState('All');
  const [newVoter, setNewVoter] = useState({ name: '', national_id: '' });
  const [voters, setVoters] = useState([]);
  const [results, setResults] = useState({ total_cast: 0, registered: 0, results: {} });
  const fileRef = useRef(null);

  const fetchVoters = () => fetch(`${API_BASE}/admin/voters`).then(r => r.json()).then(setVoters);
  const fetchResults = () => fetch(`${API_BASE}/admin/tally`).then(r => r.json()).then(setResults);

  useEffect(() => { 
    if (tab === 'VOTERS') fetchVoters(); 
    if (tab === 'RESULTS' || tab === 'OVERVIEW') { fetchResults(); fetchVoters(); }
  }, [tab]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setNewCand(p => ({...p, photo_url: ev.target.result}));
    reader.readAsDataURL(file);
  };

  const saveCandidate = () => {
    fetch(`${API_BASE}/admin/candidates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCand) })
      .then(() => { alert('Candidate Registered!'); refreshCandidates(); setNewCand({ name: '', party: '', position: config.positions[0] || '', photo_url: '' }); });
  };

  const regVoter = () => {
    fetch(`${API_BASE}/admin/voters`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newVoter) })
      .then(async r => { const data = await r.json(); if (r.ok) { alert(`Secure 6-digit PIN: ${data.pin}`); fetchVoters(); } else alert(data.detail); });
  };

  const printVoterCards = () => {
    const getBase64Image = (imgUrl) => {
        return new Promise(resolve => {
            let img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                let canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                let ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg'));
            };
            img.src = imgUrl;
        });
    };

    getBase64Image(uonLogo).then(base64Logo => {
        const activeVoters = voters.filter(v => !v.revoked);
        
        // Generate the individual cards dynamically
        const cards = activeVoters.map(v => `
          <div class="card">
            <div style="text-align: center; margin-bottom: 8px;">
              <img src="${base64Logo}" alt="UON Logo" style="width: 50px; height: auto; border-radius: 4px;" />
            </div>
            <div class="hdr">&#127513; UON OFFICIAL CREDENTIAL</div>
            <div class="name">${v.name}</div>
            <div class="nid">National ID: ${v.national_id}</div>
            <div class="plabel">Voter PIN</div>
            <div class="pin">${v.pin}</div>
            <div class="warn">CONFIDENTIAL &mdash; DO NOT SHARE</div>
          </div>
        `).join('');

        // Wrap the cards in your exact HTML/CSS template
        const htmlTemplate = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Voter PIN Cards</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0 }
              body { font-family: Arial, sans-serif; background: #eee; padding: 10px }
              .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px }
              .card { background: #fff; border: 2px solid #1B3A6B; border-radius: 8px; padding: 12px; break-inside: avoid; page-break-inside: avoid }
              .hdr { background: #1B3A6B; color: #fff; text-align: center; padding: 4px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; letter-spacing: .5px; margin-bottom: 9px }
              .name { font-size: 12px; font-weight: 700; color: #1B3A6B; margin-bottom: 2px }
              .nid { font-size: 10px; color: #666; margin-bottom: 7px }
              .plabel { font-size: 8px; color: #999; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px }
              .pin { font-size: 18px; font-weight: 700; color: #C9A227; font-family: monospace; letter-spacing: 5px; background: #fffbee; border: 1px dashed #fde68a; border-radius: 4px; padding: 5px; text-align: center; margin-bottom: 5px }
              .warn { font-size: 8px; color: #DC2626; text-align: center; border-top: 1px solid #eee; padding-top: 4px; margin-top: 2px; font-weight: 600 }
              @media print { body { background: #fff; padding: 0 } .grid { gap: 4px } }
            </style>
          </head>
          <body>
            <div class="grid">${cards}</div>
            <script>window.onload = () => { window.print(); }</script>
          </body>
          </html>
        `;

        const newWin = window.open('', '', 'width=800,height=600');
        newWin.document.write(htmlTemplate);
        newWin.document.close();
    });
  };

  const activeVotersCount = voters.filter(v => !v.revoked).length;
  const turnoutPct = activeVotersCount > 0 ? ((results.total_cast / activeVotersCount) * 100).toFixed(1) : 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['OVERVIEW', 'CANDIDATES', 'VOTERS', 'RESULTS', 'SETTINGS'].map(t => (
          <button key={t} style={tab === t ? styles.btn : styles.btnOutline} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'OVERVIEW' && (
        <div>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <div style={{ ...styles.card, flex: 1 }}><h3>Registered</h3><h1 style={{color: COLORS.primary}}>{activeVotersCount}</h1></div>
            <div style={{ ...styles.card, flex: 1 }}><h3>Votes Cast</h3><h1 style={{color: COLORS.secondary}}>{results.total_cast}</h1></div>
            <div style={{ ...styles.card, flex: 1 }}><h3>Turnout</h3><h1 style={{color: '#2563EB'}}>{turnoutPct}%</h1></div>
          </div>
          <div style={styles.card}>
            <h3>Turnout Progress</h3>
            <div style={{ background: '#e8edf5', borderRadius: '20px', height: '18px', overflow: 'hidden', marginTop: '10px' }}>
              <div style={{ background: COLORS.primary, height: '100%', width: `${turnoutPct}%`, transition: 'width 0.5s' }}></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'CANDIDATES' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          <div style={styles.card}>
            <h3>Register Candidate</h3>
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
              <div onClick={() => fileRef.current && fileRef.current.click()} style={{ width: '100px', height: '100px', borderRadius: '50%', margin: '0 auto', background: '#f4f7f6', border: '2px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                {newCand.photo_url ? <img src={newCand.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Upload" /> : "📷"}
              </div>
              <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
            </div>
            <input style={styles.input} placeholder="Full Name" value={newCand.name} onChange={e => setNewCand({...newCand, name: e.target.value})} />
            <input style={styles.input} placeholder="Party Name" value={newCand.party} onChange={e => setNewCand({...newCand, party: e.target.value})} />
            <select style={styles.input} value={newCand.position} onChange={e => setNewCand({...newCand, position: e.target.value})}>
                <option value="">Select Position...</option>
                {config.positions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button style={{...styles.btn, width: '100%'}} onClick={saveCandidate}>Add Candidate</button>
          </div>
          
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3>Candidates List</h3>
                <select style={{ padding: '5px' }} value={candFilter} onChange={e => setCandFilter(e.target.value)}>
                    <option value="All">All Positions</option>
                    {config.positions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '15px' }}>
              {candidates.filter(c => candFilter === 'All' || c.position === candFilter).map(c => (
                <li key={c.id} style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' }}>
                  {c.photo_url ? <img src={c.photo_url} style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '15px', objectFit: 'cover' }} alt=""/> : <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ccc', marginRight: '15px' }}></div>}
                  <div style={{ flex: 1 }}>
                    <strong>{c.name}</strong>
                    <div style={{ fontSize: '12px', color: '#666' }}>{c.party} &bull; <span style={{...styles.badge, background: '#dbeafe', color: '#1e40af'}}>{c.position}</span></div>
                  </div>
                  <button style={{...styles.btnOutline, color: 'red', borderColor: 'red'}} onClick={() => fetch(`${API_BASE}/admin/candidates/${c.id}`, { method: 'DELETE' }).then(refreshCandidates)}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'VOTERS' && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Voter Registry</h2>
            <button style={{ ...styles.btnOutline, color: COLORS.secondary, borderColor: COLORS.secondary }} onClick={printVoterCards}>🖨 Print PIN Cards</button>
          </div>
          <div style={{ display: 'flex', gap: '10px', margin: '20px 0' }}>
            <input style={{...styles.input, flex: 1}} placeholder="Full Name" onChange={e => setNewVoter({...newVoter, name: e.target.value})} />
            <input style={{...styles.input, flex: 1}} placeholder="National ID" onChange={e => setNewVoter({...newVoter, national_id: e.target.value})} />
            <button style={{ ...styles.btn, height: '42px' }} onClick={regVoter}>Register</button>
          </div>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {voters.map(v => (
              <li key={v.national_id} style={{ padding: '10px', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', background: v.revoked ? '#ffebee' : 'transparent' }}>
                <span>{v.name} (ID: {v.national_id})</span>
                <span style={{ color: v.has_voted ? 'green' : 'gray', fontWeight: 'bold' }}>{v.has_voted ? 'VOTED' : 'ELIGIBLE'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'RESULTS' && (
        <div style={styles.card}>
          <h2>Live Tally Results 🏆</h2>
          {config.positions.map(pos => {
            const posCands = candidates.filter(c => c.position === pos).sort((a,b) => (results.results[b.id]||0) - (results.results[a.id]||0));
            if(posCands.length === 0) return null;
            const maxV = Math.max(...posCands.map(c => results.results[c.id] || 0), 1);
            
            return (
              <div key={pos} style={{ marginBottom: '30px' }}>
                <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '5px' }}>{pos}</h3>
                {posCands.map((c, i) => {
                  const v = results.results[c.id] || 0;
                  const pct = results.total_cast > 0 ? Math.round((v / results.total_cast) * 100) : 0;
                  const isWin = i === 0 && v > 0;
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                      <div style={{ fontSize: '20px', width: '30px', textAlign: 'center' }}>{isWin ? '🥇' : i+1}</div>
                      {c.photo_url ? <img src={c.photo_url} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} alt=""/> : <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#ccc' }}></div>}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{c.name} <span style={{ color: '#666', fontWeight: 'normal', fontSize: '12px' }}>({c.party})</span></strong>
                          <strong>{v} <span style={{ color: '#666', fontWeight: 'normal', fontSize: '12px' }}>({pct}%)</span></strong>
                        </div>
                        <div style={{ background: '#e8edf5', height: '8px', borderRadius: '10px', marginTop: '5px' }}>
                          <div style={{ background: isWin ? COLORS.secondary : COLORS.primary, height: '100%', borderRadius: '10px', width: `${(v/maxV)*100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'SETTINGS' && (
        <div style={styles.card}>
          <h2>Election Settings</h2>
          <label style={{ display: 'block', fontWeight: 'bold' }}>Election Name</label>
          <input style={styles.input} value={config.name} onChange={e => setConfig({...config, name: e.target.value})} />
          <label style={{ display: 'block', fontWeight: 'bold', marginTop: '10px' }}>Voting Status</label>
          <select style={styles.input} value={config.status} onChange={e => setConfig({...config, status: e.target.value})}>
            <option value="open">🟢 Open (Voting Allowed)</option>
            <option value="closed">🔴 Closed (Voting Disabled)</option>
          </select>
          <label style={{ display: 'block', fontWeight: 'bold', marginTop: '10px', marginBottom: '5px' }}>Ballot Positions</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            {config.positions.map(p => (
                <div key={p} style={{ background: '#f0f4fa', padding: '5px 12px', borderRadius: '20px', fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                    {p} <button onClick={() => setConfig({...config, positions: config.positions.filter(x => x !== p)})} style={{ background: 'none', border: 'none', marginLeft: '5px', cursor: 'pointer', color: 'red' }}>×</button>
                </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input style={{...styles.input, marginBottom: 0}} id="newPosInput" placeholder="Add new position..." />
            <button style={styles.btn} onClick={() => {
                const val = document.getElementById('newPosInput').value.trim();
                if(val && !config.positions.includes(val)) {
                    setConfig({...config, positions: [...config.positions, val]});
                    document.getElementById('newPosInput').value = '';
                }
            }}>Add</button>
          </div>
          <button style={{...styles.btn, width: '100%', marginTop: '20px'}} onClick={() => {
            fetch(`${API_BASE}/admin/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
            .then(() => alert('Settings Saved!'));
          }}>Save Settings</button>
        </div>
      )}
    </div>
  );
}