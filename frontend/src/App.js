import React, { useState, useEffect, useRef } from 'react';
import uonLogo from './uon-logo.jpeg'; 

const API_BASE = 'https://uon-voting-backends.onrender.com';

const COLORS = {
  primary: '#004d28', secondary: '#d4af37', background: '#f4f7f6', surface: '#ffffff', text: '#333333', border: '#DDE3EE'
};

const styles = {
  container: { maxWidth: '1000px', margin: '0 auto', padding: '15px', fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', color: COLORS.text, overflowX: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `4px solid ${COLORS.secondary}`, paddingBottom: '10px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
  btn: { backgroundColor: COLORS.primary, color: 'white', border: 'none', padding: '10px 20px', cursor: 'pointer', borderRadius: '5px', fontWeight: 'bold', minWidth: '120px' },
  btnOutline: { backgroundColor: 'transparent', color: COLORS.primary, border: `2px solid ${COLORS.primary}`, padding: '8px 16px', cursor: 'pointer', borderRadius: '5px' },
  card: { backgroundColor: COLORS.surface, padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '20px', overflowX: 'auto' },
  input: { width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' },
  badge: { display: 'inline-block', padding: '4px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }
};

function useCountdown(endTime) {
  const [rem, setRem] = useState('');
  useEffect(() => {
    if (!endTime) { setRem(''); return; }
    const upd = () => {
      const d = new Date(endTime) - new Date();
      if (d <= 0) { setRem('ENDED'); return; }
      const dd = Math.floor(d / 86400000), hh = Math.floor((d % 86400000) / 3600000), mm = Math.floor((d % 3600000) / 60000), ss = Math.floor((d % 60000) / 1000);
      setRem(`${dd}d ${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m ${String(ss).padStart(2, '0')}s`);
    };
    upd(); const t = setInterval(upd, 1000); return () => clearInterval(t);
  }, [endTime]);
  return rem;
}

function VerifyReceipt({ setView }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);

  return (
    <div style={{ ...styles.card, maxWidth: '500px', margin: '50px auto' }}>
      <h2 style={{ color: COLORS.primary }}>Verify Public Receipt</h2>
      <p>Enter your tracking code to verify your vote was counted.</p>
      <input style={styles.input} placeholder="UON-XXXXXXXXXX" onChange={e => setCode(e.target.value)} />
      <button style={{ ...styles.btn, width: '100%' }} onClick={() => {
        fetch(`${API_BASE}/verify/${code}`)
          .then(async r => {
            const data = await r.json();
            if (!r.ok) { setResult(null); alert(data.detail || "Receipt not found."); } else setResult(data);
          })
          .catch(() => alert("Error connecting to server."));
      }}>Verify Now</button>
      
      {result && result.positions && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#e8f5e9', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: COLORS.primary }}>✅ Vote Verified</h3>
          <p style={{fontSize: '12px'}}><strong>Timestamp:</strong> {new Date(result.ts + 'Z').toLocaleString()}</p>
          <div style={{marginTop: '15px'}}>
             {result.positions.map((p, idx) => (
               <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', background: '#fff', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', flexWrap: 'wrap' }}>
                  {p.photo_url ? <img src={p.photo_url} style={{width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover'}} alt=""/> : <div style={{width: '45px', height: '45px', borderRadius: '50%', background: '#ccc'}}></div>}
                  <div style={{flex: 1}}>
                      <div style={{fontSize: '11px', color: '#666', textTransform: 'uppercase'}}>{p.position}</div>
                      <div><strong>{p.candidate_name}</strong> ({p.party})</div>
                  </div>
               </div>
             ))}
          </div>
        </div>
      )}
      <button style={{ ...styles.btnOutline, width: '100%', marginTop: '20px' }} onClick={() => setView('HOME')}>Back to Home</button>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('HOME'); 
  const [candidates, setCandidates] = useState([]);
  const [config, setConfig] = useState({ name: 'UoN General Election', status: 'open', end_time: '' });
  const [adminCreds, setAdminCreds] = useState({ user: '', pass: '' });
  const [voterCreds, setVoterCreds] = useState({ id: '', pin: '' });
  const [activeVoter, setActiveVoter] = useState(null);
  const [receipt, setReceipt] = useState(null);
  
  const countdown = useCountdown(config.end_time);
  const isVotingOpen = config.status === 'open' && countdown !== 'ENDED';

  const refreshCandidates = () => {
    fetch(`${API_BASE}/candidates`)
      .then(r => r.json())
      .then(data => setCandidates(Array.isArray(data) ? data : []))
      .catch(() => setCandidates([]));
  };

  useEffect(() => {
    fetch(`${API_BASE}/settings`)
      .then(r => r.json())
      .then(data => { if (data && data.name) setConfig(data); })
      .catch(() => {});
    refreshCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const renderHome = () => (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <img src={uonLogo} alt="University of Nairobi Logo" style={{ width: '100%', maxWidth: '300px', borderRadius: '8px' }} />
      <h1 style={{ color: COLORS.primary, marginTop: '30px' }}>{config.name} Portal</h1>
      
      <p style={{ fontSize: '1.2em' }}>
        Voting is currently: <strong style={{ color: isVotingOpen ? 'green' : 'red' }}>{isVotingOpen ? 'OPEN' : 'CLOSED'}</strong>
      </p>
      
      {countdown && <div style={{ fontSize: '1.3em', fontWeight: 'bold', color: countdown === 'ENDED' ? 'red' : COLORS.secondary, margin: '15px 0' }}>⏱ Time Remaining: {countdown}</div>}
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '30px', flexWrap: 'wrap' }}>
        {isVotingOpen && <button style={{ ...styles.btn, fontSize: '1.2em', padding: '15px 30px' }} onClick={() => setView('VOTER_LOGIN')}>Cast Your Vote</button>}
        <button style={{ ...styles.btnOutline, fontSize: '1.2em', padding: '15px 30px', color: '#1B3A6B', borderColor: '#1B3A6B' }} onClick={() => setView('VERIFY_RECEIPT')}>Verify My Receipt</button>
        <button style={styles.btnOutline} onClick={() => setView('ADMIN_LOGIN')}>Admin Access</button>
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
        if(!isVotingOpen) { alert("Voting is closed!"); return; }
        fetch(`${API_BASE}/voter/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ national_id: voterCreds.id, pin: voterCreds.pin })
        }).then(async r => {
          const data = await r.json();
          if (!r.ok) alert(data.detail || "Error connecting");
          else { setActiveVoter(voterCreds.id); setView('VOTING'); }
        }).catch(() => alert("Network Error. Is the backend running?"));
      }}>Authenticate & Vote</button>
      <button style={{ ...styles.btnOutline, width: '100%', marginTop: '10px' }} onClick={() => setView('HOME')}>Back</button>
    </div>
  );

  return (
    <div style={styles.container}>
      {view !== 'HOME' && view !== 'RECEIPT' && view !== 'VOTING' && view !== 'VERIFY_RECEIPT' && (
        <div style={styles.header}>
          <h2 style={{ margin: 0, color: COLORS.primary }}>UoN E-Voting</h2>
          <button style={styles.btnOutline} onClick={() => { setActiveVoter(null); setView('HOME'); }}>Exit</button>
        </div>
      )}
      
      {view === 'HOME' && renderHome()}
      {view === 'VERIFY_RECEIPT' && <VerifyReceipt setView={setView} />}
      {view === 'ADMIN_LOGIN' && renderAdminLogin()}
      {view === 'VOTER_LOGIN' && renderVoterLogin()}
      {view === 'VOTING' && <VotingBooth countdown={countdown} activeVoter={activeVoter} candidates={candidates} onComplete={(code) => { setReceipt(code); setView('RECEIPT'); }} onExit={() => setView('HOME')} />}
      {view === 'RECEIPT' && (
        <div style={{ ...styles.card, textAlign: 'center', marginTop: '50px', backgroundColor: '#e8f5e9' }}>
          <h1 style={{ color: COLORS.primary }}>Vote Cast Successfully!</h1>
          <p>Your unique ballot tracking code is:</p>
          <h2 style={{ letterSpacing: '2px', background: '#fff', padding: '10px', display: 'inline-block', borderRadius: '5px', wordBreak: 'break-all' }}>{receipt}</h2>
          <p style={{fontSize:'14px', color:'#666', marginTop:'15px'}}>Please write this code down or copy it to verify your vote later.</p>
          <button style={{ ...styles.btn, marginTop: '20px' }} onClick={() => { setActiveVoter(null); setView('HOME'); }}>Done</button>
        </div>
      )}
      {view === 'ADMIN_DASHBOARD' && <AdminDashboard candidates={candidates} refreshCandidates={refreshCandidates} config={config} setConfig={setConfig} />}
    </div>
  );
}

// --- VOTING BOOTH ---
function VotingBooth({ countdown, activeVoter, candidates, onComplete, onExit }) {
  const [selections, setSelections] = useState({});
  const [boothPos, setBoothPos] = useState(0);
  const [phase, setPhase] = useState('voting');
  
  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  const votingPositions = Array.from(new Set(safeCandidates.map(c => c.position).filter(Boolean)));

  if (votingPositions.length === 0) return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>No Candidates Registered</h2>
      <button style={styles.btn} onClick={onExit}>Return Home</button>
    </div>
  );

  const currPos = votingPositions[boothPos];
  const currCands = safeCandidates.filter(c => c.position === currPos);
  const isLast = boothPos === votingPositions.length - 1;

  const next = () => { if (isLast) setPhase('review'); else setBoothPos(p => p + 1); };
  const back = () => { if (phase === 'review') setPhase('voting'); else if (boothPos > 0) setBoothPos(p => p - 1); };
  const skip = () => { setSelections(p => ({...p, [currPos]: 'SKIP'})); if (isLast) setPhase('review'); else setBoothPos(p => p + 1); };

  const submitFinalBallot = async () => {
    const selectedCandIds = Object.values(selections).filter(v => v !== 'SKIP');
    if(selectedCandIds.length === 0) { alert("You must select at least one candidate."); return; }
    
    fetch(`${API_BASE}/vote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ national_id: activeVoter, candidate_ids: selectedCandIds })
    }).then(async res => {
      const data = await res.json();
      if (res.ok) onComplete(data.tracking_code); else alert("Error: " + data.detail);
    });
  };

  if (phase === 'review') {
    return (
      <div style={styles.card}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap:'10px'}}>
            <h2 style={{ color: COLORS.primary, margin: 0 }}>Review Your Selections</h2>
            {countdown && <div style={{fontWeight: 'bold', color: 'red'}}>⏱ {countdown}</div>}
        </div>
        <div style={{ background: '#fffbee', padding: '10px', borderRadius: '5px', margin: '15px 0', color: '#92400e', fontSize:'14px' }}>⚠ Please review carefully. Once submitted, your ballot cannot be changed.</div>
        {votingPositions.map(pos => {
          const sel = selections[pos];
          const cand = sel && sel !== 'SKIP' ? safeCandidates.find(c => c.id === sel) : null;
          return (
            <div key={pos} style={{ display: 'flex', alignItems: 'center', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '10px', background: cand ? '#f0fdf4' : '#fef2f2', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#666', marginBottom: '5px' }}>{pos}</div>
                {cand ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                        {cand.photo_url ? <img src={cand.photo_url} style={{width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover'}} alt=""/> : <div style={{width: '45px', height: '45px', borderRadius: '50%', background: '#ccc'}}></div>}
                        <div><strong>{cand.name}</strong> ({cand.party})</div>
                    </div>
                ) : <div style={{ color: 'red', fontWeight: 'bold' }}>Not Selected / Skipped</div>}
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
          <button style={{ ...styles.btnOutline, flex: '1 1 100px' }} onClick={back}>← Edit</button>
          <button style={{ ...styles.btn, flex: '2 1 200px' }} onClick={submitFinalBallot}>✅ Cast My Ballot</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap', gap:'10px' }}>
        <h2 style={{margin:0}}>{currPos}</h2>
        <div>
            {countdown && <span style={{ color: 'red', fontWeight: 'bold', marginRight: '15px' }}>⏱ {countdown}</span>}
            <span style={{ color: '#666' }}>Pos {boothPos + 1} of {votingPositions.length}</span>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        {currCands.map(c => (
          <div key={c.id} onClick={() => setSelections({...selections, [currPos]: c.id})} style={{ flex: '1 1 150px', border: `2px solid ${selections[currPos] === c.id ? COLORS.secondary : '#ddd'}`, borderRadius: '10px', padding: '15px', textAlign: 'center', cursor: 'pointer', background: selections[currPos] === c.id ? '#fffbee' : '#fff' }}>
            {c.photo_url ? <img src={c.photo_url} alt={c.name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '10px' }} /> : <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#eee', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>}
            <div style={{ fontWeight: 'bold', wordBreak: 'break-word' }}>{c.name}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{c.party}</div>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap:'wrap', gap: '10px' }}>
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
  const [newCand, setNewCand] = useState({ name: '', party: '', position: '', photo_url: '' });
  const [editingId, setEditingId] = useState(null);
  const [candFilter, setCandFilter] = useState('All');
  
  const [newVoter, setNewVoter] = useState({ name: '', national_id: '' });
  const [voters, setVoters] = useState([]);
  const [voterSearch, setVoterSearch] = useState(''); 
  const [results, setResults] = useState({ total_cast: 0, registered: 0, results: {} });
  
  const fileRef = useRef(null);

  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  const safeVoters = Array.isArray(voters) ? voters : [];
  
  const uniquePositions = Array.from(new Set(safeCandidates.map(c => c.position).filter(Boolean)));
  const filterPositions = ['All', ...uniquePositions];

  const fetchVoters = () => {
      fetch(`${API_BASE}/admin/voters`)
        .then(r => r.json())
        .then(data => setVoters(Array.isArray(data) ? data : []))
        .catch(() => setVoters([]));
  };

  const fetchResults = () => {
      fetch(`${API_BASE}/admin/tally`)
        .then(r => r.json())
        .then(data => setResults(data && data.results ? data : { total_cast: 0, registered: 0, results: {} }))
        .catch(() => setResults({ total_cast: 0, registered: 0, results: {} }));
  };

  useEffect(() => { 
    if (tab === 'VOTERS') fetchVoters(); 
    if (tab === 'RESULTS' || tab === 'OVERVIEW') { fetchResults(); fetchVoters(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setNewCand(p => ({...p, photo_url: ev.target.result}));
    reader.readAsDataURL(file);
  };

  const startEdit = (c) => {
    setNewCand({ name: c.name, party: c.party, position: c.position, photo_url: c.photo_url || '' });
    setEditingId(c.id);
  };

  const saveCandidate = () => {
    if(!newCand.position) { alert("Please type in a position for this candidate."); return; }
    const url = editingId ? `${API_BASE}/admin/candidates/${editingId}` : `${API_BASE}/admin/candidates`;
    const method = editingId ? 'PUT' : 'POST';

    fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCand) })
      .then(() => { 
        alert(editingId ? 'Candidate Updated!' : 'Candidate Registered!'); 
        refreshCandidates(); 
        setNewCand({ name: '', party: '', position: '', photo_url: '' }); 
        setEditingId(null);
      });
  };

  const handleBulkUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = event.target.result.split('\n').filter(row => row.trim() !== '');
      const parsedVoters = rows.map(row => {
        const [name, national_id] = row.split(',');
        return { name: name?.trim(), national_id: national_id?.trim() };
      }).filter(v => v.name && v.national_id);

      if (parsedVoters.length === 0) { alert("No valid data found. Use format: Name,National_ID"); return; }

      fetch(`${API_BASE}/admin/voters/bulk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voters: parsedVoters })
      }).then(async r => {
        const data = await r.json();
        if(!data.results) { alert("An error occurred processing the CSV."); return; }
        
        let csvContent = "data:text/csv;charset=utf-8,Name,National ID,Status,Secure PIN\n";
        data.results.forEach(res => { csvContent += `${res.name},${res.national_id},${res.status},${res.pin}\n`; });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "UoN_Voter_PINs.csv");
        document.body.appendChild(link);
        link.click();
        alert(`Bulk registration complete! Downloading PIN spreadsheet.`);
        fetchVoters();
      }).catch(() => alert("Network error connecting to backend."));
    };
    reader.readAsText(file);
  };

  const regVoter = () => {
    fetch(`${API_BASE}/admin/voters`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newVoter) })
      .then(async r => { const data = await r.json(); if (r.ok) { alert(`Secure 6-digit PIN: ${data.pin}`); fetchVoters(); } else alert(data.detail); });
  };

  const printVoterCards = (specificVotersList) => {
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
        const targetVoters = specificVotersList || safeVoters.filter(v => !v.revoked);
        
        if (targetVoters.length === 0) { alert("No active voters to print!"); return; }

        const cards = targetVoters.map(v => `
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

        const htmlTemplate = `
          <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Voter PIN Cards</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0 }
              body { font-family: Arial, sans-serif; background: #eee; padding: 10px }
              .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px }
              .card { background: #fff; border: 2px solid #1B3A6B; border-radius: 8px; padding: 12px; break-inside: avoid; page-break-inside: avoid; max-width: 250px; margin: 0 auto; }
              .hdr { background: #1B3A6B; color: #fff; text-align: center; padding: 4px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; letter-spacing: .5px; margin-bottom: 9px }
              .name { font-size: 12px; font-weight: 700; color: #1B3A6B; margin-bottom: 2px }
              .nid { font-size: 10px; color: #666; margin-bottom: 7px }
              .plabel { font-size: 8px; color: #999; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px }
              .pin { font-size: 18px; font-weight: 700; color: #C9A227; font-family: monospace; letter-spacing: 5px; background: #fffbee; border: 1px dashed #fde68a; border-radius: 4px; padding: 5px; text-align: center; margin-bottom: 5px }
              .warn { font-size: 8px; color: #DC2626; text-align: center; border-top: 1px solid #eee; padding-top: 4px; margin-top: 2px; font-weight: 600 }
              @media print { body { background: #fff; padding: 0 } .grid { gap: 4px } .card { border-color: #000; box-shadow: none; } }
            </style>
          </head><body><div class="grid">${cards}</div><script>window.onload = () => { window.print(); }</script></body></html>
        `;

        const newWin = window.open('', '', 'width=800,height=600');
        newWin.document.write(htmlTemplate);
        newWin.document.close();
    });
  };

  const activeVotersCount = safeVoters.filter(v => !v.revoked).length;
  const turnoutPct = activeVotersCount > 0 ? ((results.total_cast / activeVotersCount) * 100).toFixed(1) : 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['OVERVIEW', 'CANDIDATES', 'VOTERS', 'RESULTS', 'SETTINGS'].map(t => (
          <button key={t} style={{... (tab === t ? styles.btn : styles.btnOutline), flex: '1 1 100px'}} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'OVERVIEW' && (
        <div>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ ...styles.card, flex: '1 1 150px' }}><h3>Registered</h3><h1 style={{color: COLORS.primary}}>{activeVotersCount}</h1></div>
            <div style={{ ...styles.card, flex: '1 1 150px' }}><h3>Votes Cast</h3><h1 style={{color: COLORS.secondary}}>{results.total_cast}</h1></div>
            <div style={{ ...styles.card, flex: '1 1 150px' }}><h3>Turnout</h3><h1 style={{color: '#2563EB'}}>{turnoutPct}%</h1></div>
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ ...styles.card, flex: '1 1 300px' }}>
            <h3>{editingId ? "Edit Candidate" : "Register Candidate"}</h3>
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
              <div onClick={() => fileRef.current && fileRef.current.click()} style={{ width: '100px', height: '100px', borderRadius: '50%', margin: '0 auto', background: '#f4f7f6', border: '2px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                {newCand.photo_url ? <img src={newCand.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Upload" /> : "📷"}
              </div>
              <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
            </div>
            <input style={styles.input} placeholder="Full Name" value={newCand.name} onChange={e => setNewCand({...newCand, name: e.target.value})} />
            <input style={styles.input} placeholder="Party Name" value={newCand.party} onChange={e => setNewCand({...newCand, party: e.target.value})} />
            <input style={styles.input} placeholder="Position (e.g., President)" value={newCand.position} onChange={e => setNewCand({...newCand, position: e.target.value})} />
            <button style={{...styles.btn, width: '100%'}} onClick={saveCandidate}>{editingId ? "Update Details" : "Add Candidate"}</button>
            {editingId && <button style={{...styles.btnOutline, width: '100%', marginTop: '10px'}} onClick={() => { setEditingId(null); setNewCand({ name: '', party: '', position: '', photo_url: '' }); }}>Cancel Edit</button>}
          </div>
          
          <div style={{ ...styles.card, flex: '2 1 400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{margin:0}}>Candidates List</h3>
                <select style={{ padding: '5px' }} value={candFilter} onChange={e => setCandFilter(e.target.value)}>
                    {filterPositions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '15px' }}>
              {safeCandidates.filter(c => candFilter === 'All' || c.position === candFilter).map(c => (
                <li key={c.id} style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', flexWrap: 'wrap', gap: '10px' }}>
                  {c.photo_url ? <img src={c.photo_url} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} alt=""/> : <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ccc' }}></div>}
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <strong style={{wordBreak: 'break-word'}}>{c.name}</strong>
                    <div style={{ fontSize: '12px', color: '#666' }}>{c.party} &bull; <span style={{...styles.badge, background: '#dbeafe', color: '#1e40af'}}>{c.position}</span></div>
                  </div>
                  <div style={{display:'flex', gap:'5px'}}>
                    <button style={{...styles.btnOutline, padding:'5px 10px', fontSize:'12px'}} onClick={() => startEdit(c)}>Edit</button>
                    <button style={{...styles.btnOutline, color: 'red', borderColor: 'red', padding:'5px 10px', fontSize:'12px'}} onClick={() => fetch(`${API_BASE}/admin/candidates/${c.id}`, { method: 'DELETE' }).then(refreshCandidates)}>Del</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'VOTERS' && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap:'wrap', gap:'10px' }}>
            <h2 style={{margin:0}}>Voter Registry</h2>
            <button style={{ ...styles.btnOutline, color: COLORS.secondary, borderColor: COLORS.secondary }} onClick={() => printVoterCards()}>🖨 Print ALL Cards</button>
          </div>
          <div style={{ display: 'flex', gap: '10px', margin: '20px 0', flexWrap: 'wrap' }}>
            <input style={{...styles.input, flex: '1 1 150px', marginBottom:0}} placeholder="Full Name" onChange={e => setNewVoter({...newVoter, name: e.target.value})} />
            <input style={{...styles.input, flex: '1 1 150px', marginBottom:0}} placeholder="National ID" onChange={e => setNewVoter({...newVoter, national_id: e.target.value})} />
            <button style={{ ...styles.btn, flex: '1 1 100px' }} onClick={regVoter}>Register</button>
          </div>
          
          <hr style={{ margin: '20px 0', border: '1px solid #eee' }} />
          <h3>Bulk Registration (CSV Upload)</h3>
          <p style={{ fontSize: '0.9em', color: '#666' }}>Upload a .csv file formatted with two columns: <b>Name, National_ID</b> (no header row).</p>
          <input type="file" accept=".csv" onChange={handleBulkUpload} style={{ padding: '10px', border: '2px dashed #ccc', width: '100%', boxSizing: 'border-box' }} />

          <hr style={{ margin: '20px 0', border: '1px solid #eee' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '30px' }}>
            <h3 style={{margin: 0}}>Registry List</h3>
            <input 
                style={{...styles.input, flex: '1 1 200px', maxWidth: '300px', marginBottom: 0}} 
                placeholder="🔍 Search ID or Name..." 
                value={voterSearch}
                onChange={e => setVoterSearch(e.target.value)}
            />
          </div>

          <ul style={{ listStyle: 'none', padding: 0, marginTop: '15px' }}>
            {safeVoters
              .filter(v => (v.national_id || '').toString().toLowerCase().includes(voterSearch.toLowerCase()) || (v.name || '').toLowerCase().includes(voterSearch.toLowerCase()))
              .map(v => (
              <li key={v.national_id} style={{ padding: '10px', borderBottom: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: v.revoked ? '#ffebee' : 'transparent', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{wordBreak: 'break-word', flex: '1 1 200px'}}>
                    <strong>{v.name}</strong> <span style={{fontSize:'12px', color:'#666'}}>(ID: {v.national_id})</span>
                    <div style={{ color: v.has_voted ? 'green' : 'gray', fontWeight: 'bold', fontSize: '11px', marginTop:'4px' }}>{v.has_voted ? 'VOTED' : 'ELIGIBLE'}</div>
                </div>
                <div style={{ display:'flex', gap:'5px' }}>
                    <button style={{...styles.btnOutline, padding: '5px 10px', fontSize: '12px', borderColor: '#2563EB', color: '#2563EB'}} onClick={() => printVoterCards([v])}>🖨 Print</button>
                    <button style={{...styles.btnOutline, padding: '5px 10px', fontSize: '12px'}} onClick={() => {
                        fetch(`${API_BASE}/admin/voters/${v.national_id}/revoke`, { method: 'PUT' }).then(() => fetchVoters());
                    }}>{v.revoked ? "Reinstate" : "Revoke"}</button>
                </div>
              </li>
            ))}
            {safeVoters.filter(v => (v.national_id || '').toString().toLowerCase().includes(voterSearch.toLowerCase()) || (v.name || '').toLowerCase().includes(voterSearch.toLowerCase())).length === 0 && (
                <li style={{textAlign: 'center', padding: '20px', color: '#666'}}>No voters found matching your search.</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'RESULTS' && (
        <div style={styles.card}>
          <h2>Live Tally Results 🏆</h2>
          {uniquePositions.map(pos => {
            const posCands = safeCandidates.filter(c => c.position === pos).sort((a,b) => (results?.results?.[b.id]||0) - (results?.results?.[a.id]||0));
            if(posCands.length === 0) return null;
            const maxV = Math.max(...posCands.map(c => results?.results?.[c.id] || 0), 1);
            
            return (
              <div key={pos} style={{ marginBottom: '30px' }}>
                <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '5px' }}>{pos}</h3>
                {posCands.map((c, i) => {
                  const v = results?.results?.[c.id] || 0;
                  const pct = results.total_cast > 0 ? Math.round((v / results.total_cast) * 100) : 0;
                  const isWin = i === 0 && v > 0;
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '20px', width: '30px', textAlign: 'center' }}>{isWin ? '🥇' : i+1}</div>
                      {c.photo_url ? <img src={c.photo_url} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} alt=""/> : <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#ccc' }}></div>}
                      <div style={{ flex: '1 1 200px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong style={{wordBreak: 'break-word'}}>{c.name} <span style={{ color: '#666', fontWeight: 'normal', fontSize: '12px' }}>({c.party})</span></strong>
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
          <input style={styles.input} value={config.name || ''} onChange={e => setConfig({...config, name: e.target.value})} />
          
          <label style={{ display: 'block', fontWeight: 'bold', marginTop: '10px' }}>Manual Voting Override</label>
          <select style={styles.input} value={config.status || 'open'} onChange={e => setConfig({...config, status: e.target.value})}>
            <option value="open">🟢 Open (If Timer Allows)</option>
            <option value="closed">🔴 Closed (Force Disable Voting)</option>
          </select>

          <label style={{ display: 'block', fontWeight: 'bold', marginTop: '10px' }}>Election Deadline (Countdown Timer)</label>
          <input type="datetime-local" style={styles.input} value={config.end_time || ''} onChange={e => setConfig({...config, end_time: e.target.value})} />
          
          <button style={{...styles.btn, width: '100%', marginTop: '20px'}} onClick={() => {
            fetch(`${API_BASE}/admin/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
            .then(() => alert('Settings Saved!'));
          }}>Save Settings</button>
        </div>
      )}
    </div>
  );
}