import React, { useState, useEffect } from 'react';
// This import requires the file to be exactly at src/uon-logo.jpg
import uonLogo from './uon-logo.jpeg'; 

// --- STYLING (UoN Inspired) ---
const COLORS = {
  primary: '#004d28', // University Green
  secondary: '#d4af37', // Academic Gold
  background: '#f4f7f6',
  surface: '#ffffff',
  text: '#333333'
};

const styles = {
  container: { maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', color: COLORS.text },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `4px solid ${COLORS.secondary}`, paddingBottom: '10px', marginBottom: '20px' },
  btn: { backgroundColor: COLORS.primary, color: 'white', border: 'none', padding: '10px 20px', cursor: 'pointer', borderRadius: '5px', fontWeight: 'bold' },
  btnOutline: { backgroundColor: 'transparent', color: COLORS.primary, border: `2px solid ${COLORS.primary}`, padding: '8px 16px', cursor: 'pointer', borderRadius: '5px' },
  card: { backgroundColor: COLORS.surface, padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '20px' },
  input: { width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }
};

export default function App() {
  const [view, setView] = useState('HOME'); 
  const [candidates, setCandidates] = useState([]);
  const [cryptoParams, setCryptoParams] = useState(null);
  
  // State for forms and logic
  const [adminCreds, setAdminCreds] = useState({ user: '', pass: '' });
  const [voterCreds, setVoterCreds] = useState({ id: '', pin: '' });
  const [activeVoter, setActiveVoter] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [message, setMessage] = useState(""); // Using this clears ESLint warnings

  useEffect(() => {
    fetch('https://uon-voting-backends.onrender.com/public-key').then(r => r.json()).then(setCryptoParams);
    refreshCandidates();
  }, [view]);

  const refreshCandidates = () => fetch('https://uon-voting-backends.onrender.com/candidates').then(r => r.json()).then(setCandidates);

  // --- CRYPTO HELPERS ---
  const modPow = (base, exp, mod) => {
    let result = 1n, b = window.BigInt(base), e = window.BigInt(exp), m = window.BigInt(mod);
    while (e > 0n) { if (e % 2n === 1n) result = (result * b) % m; b = (b * b) % m; e /= 2n; }
    return Number(result);
  };
  const generateHash = async (str) => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return window.BigInt("0x" + Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')); 
  };

  // --- RENDERING VIEWS ---
  const renderHome = () => (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <img src={uonLogo} alt="University of Nairobi Logo" style={{ width: '100%', maxWidth: '300px', borderRadius: '8px' }} />
      <h1 style={{ color: COLORS.primary, marginTop: '30px' }}>Welcome to the Secure E-Voting Portal</h1>
      <p style={{ fontSize: '1.2em' }}>Please select your portal to continue.</p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '30px' }}>
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
        if (adminCreds.user === 'admin' && adminCreds.pass === 'admin123') {
            setMessage("Admin authenticated successfully.");
            setView('ADMIN_DASHBOARD');
        } else {
            alert('Invalid credentials');
        }
      }}>Login</button>
      <button style={{ ...styles.btnOutline, width: '100%', marginTop: '10px' }} onClick={() => setView('HOME')}>Back</button>
    </div>
  );

  const renderVoterLogin = () => (
    <div style={{ ...styles.card, maxWidth: '400px', margin: '50px auto' }}>
      <h2 style={{ color: COLORS.primary }}>Voter Authentication</h2>
      <p>Place your finger on the scanner and enter your credentials to access the ballot.</p>
      <input style={styles.input} placeholder="National ID" onChange={e => setVoterCreds({...voterCreds, id: e.target.value})} />
      <input style={styles.input} type="password" placeholder="6-Digit PIN" onChange={e => setVoterCreds({...voterCreds, pin: e.target.value})} />
      <button style={{ ...styles.btn, width: '100%' }} onClick={() => {
        fetch('https://uon-voting-backends.onrender.com/voter/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ national_id: voterCreds.id, pin: voterCreds.pin })
        }).then(async r => {
          const data = await r.json();
          if (!r.ok) alert(data.detail);
          else { setActiveVoter(voterCreds.id); setMessage(`Authenticated: ${data.name}`); setView('VOTING'); }
        });
      }}>Authenticate & Vote</button>
    </div>
  );

  const renderVoting = () => {
    const submitVote = async (candId) => {
      if (!window.confirm("Are you sure? This action cannot be undone.")) return;
      const { p, g, Y } = cryptoParams;
      const m = modPow(g, candId, p), r = Math.floor(Math.random() * (p - 2)) + 1;
      const alpha = modPow(g, r, p), beta = (m * modPow(Y, r, p)) % p;
      const k = Math.floor(Math.random() * (p - 2)) + 1, t = modPow(g, k, p);
      const c = Number((await generateHash(`${alpha}${beta}${t}`)) % window.BigInt(p - 1));
      const s = (k + (c * r)) % (p - 1);

      fetch('https://uon-voting-backends.onrender.com/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alpha, beta, t, s, national_id: activeVoter })
      }).then(async res => {
        const data = await res.json();
        if (res.ok) { setReceipt(data.tracking_code); setView('RECEIPT'); }
        else alert("Error: " + data.detail);
      });
    };

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Select Your Candidate</h2>
            {message && <span style={{ color: COLORS.primary, fontWeight: 'bold' }}>{message}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
          {candidates.map(c => (
            <div key={c.id} style={{ ...styles.card, textAlign: 'center', borderTop: `4px solid ${COLORS.primary}` }}>
              {c.photo_url && <img src={c.photo_url} alt={c.name} style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }} />}
              <h3>{c.name}</h3><p><b>Party:</b> {c.party}</p><p><b>Position:</b> {c.position}</p>
              <button style={styles.btn} onClick={() => submitVote(c.id)}>Confirm Vote</button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderReceipt = () => (
    <div style={{ ...styles.card, textAlign: 'center', marginTop: '50px', backgroundColor: '#e8f5e9' }}>
      <h1 style={{ color: COLORS.primary }}>Vote Cast Successfully!</h1>
      <p>Your unique ballot tracking code is:</p>
      <h2 style={{ letterSpacing: '2px', background: '#fff', padding: '10px', display: 'inline-block', borderRadius: '5px' }}>{receipt}</h2>
      
      <div style={{ marginTop: '30px', padding: '20px', background: '#333', color: '#0f0', fontFamily: 'monospace', borderRadius: '8px', textAlign: 'left' }}>
        <h3>> Secure Audit Trail</h3>
        <p>> Ballot securely sealed using ElGamal ZKP [cite: 378]</p>
        <p>> Homomorphic aggregation enabled for universal verifiability [cite: 341]</p>
        <p>> Session Token: {activeVoter ? 'VALID' : 'EXPIRED'}</p>
      </div>
      <button style={{ ...styles.btn, marginTop: '20px' }} onClick={() => { setActiveVoter(null); setMessage(""); setView('HOME'); }}>Return to Home</button>
    </div>
  );

  return (
    <div style={styles.container}>
      {view !== 'HOME' && view !== 'RECEIPT' && (
        <div style={styles.header}>
          <h2 style={{ margin: 0, color: COLORS.primary }}>UoN E-Voting</h2>
          <button style={styles.btnOutline} onClick={() => { setActiveVoter(null); setView('HOME'); }}>Log Out</button>
        </div>
      )}
      
      {view === 'HOME' && renderHome()}
      {view === 'ADMIN_LOGIN' && renderAdminLogin()}
      {view === 'VOTER_LOGIN' && renderVoterLogin()}
      {view === 'VOTING' && renderVoting()}
      {view === 'RECEIPT' && renderReceipt()}
      
      {view === 'ADMIN_DASHBOARD' && <AdminDashboard candidates={candidates} refreshCandidates={refreshCandidates} />}
    </div>
  );
}

// --- ADMIN DASHBOARD COMPONENT ---
function AdminDashboard({ candidates, refreshCandidates }) {
  const [tab, setTab] = useState('OVERVIEW');
  const [newCand, setNewCand] = useState({ name: '', party: '', position: '', photo_url: '' });
  const [newVoter, setNewVoter] = useState({ name: '', national_id: '' });
  const [voters, setVoters] = useState([]);
  const [results, setResults] = useState({ total_cast: 0, registered: 0, results: {} });

  const fetchVoters = () => fetch('https://uon-voting-backends.onrender.com/admin/voters').then(r => r.json()).then(setVoters);
  const fetchResults = () => fetch('https://uon-voting-backends.onrender.com/admin/tally').then(r => r.json()).then(setResults);

  useEffect(() => { fetchVoters(); fetchResults(); }, [tab]);

  const regCandidate = () => {
    fetch('https://uon-voting-backends.onrender.com/admin/candidates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCand) })
      .then(() => { alert('Candidate Registered!'); refreshCandidates(); setNewCand({ name: '', party: '', position: '', photo_url: '' }); });
  };

  const regVoter = () => {
    fetch('https://uon-voting-backends.onrender.com/admin/voters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newVoter) })
      .then(async r => {
        const data = await r.json();
        if (r.ok) { alert(`Voter Registered! Secure 6-digit PIN: ${data.pin}\nRecord this PIN now.`); fetchVoters(); }
        else alert(data.detail);
      });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {['OVERVIEW', 'CANDIDATES', 'VOTERS', 'RESULTS'].map(t => (
          <button key={t} style={tab === t ? styles.btn : styles.btnOutline} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'OVERVIEW' && (
        <div style={styles.card}>
          <h2>Election Overview</h2>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'space-between' }}>
            <div style={{ padding: '20px', background: COLORS.primary, color: 'white', borderRadius: '8px', flex: 1 }}><h3>Registered</h3><p style={{fontSize:'2em', margin:0}}>{results.registered}</p></div>
            <div style={{ padding: '20px', background: COLORS.secondary, color: 'white', borderRadius: '8px', flex: 1 }}><h3>Votes Cast</h3><p style={{fontSize:'2em', margin:0}}>{results.total_cast}</p></div>
          </div>
        </div>
      )}

      {tab === 'CANDIDATES' && (
        <div style={styles.card}>
          <h2>Register New Candidate</h2>
          <input style={styles.input} placeholder="Candidate Name" value={newCand.name} onChange={e => setNewCand({...newCand, name: e.target.value})} />
          <input style={styles.input} placeholder="Party Name" value={newCand.party} onChange={e => setNewCand({...newCand, party: e.target.value})} />
          <input style={styles.input} placeholder="Position" value={newCand.position} onChange={e => setNewCand({...newCand, position: e.target.value})} />
          <input style={styles.input} placeholder="Photo URL" value={newCand.photo_url} onChange={e => setNewCand({...newCand, photo_url: e.target.value})} />
          <button style={styles.btn} onClick={regCandidate}>Add to Registry</button>
        </div>
      )}

      {tab === 'VOTERS' && (
        <div style={styles.card}>
          <h2>Voter Registry Management</h2>
          <input style={styles.input} placeholder="Full Name" onChange={e => setNewVoter({...newVoter, name: e.target.value})} />
          <input style={styles.input} placeholder="National ID" onChange={e => setNewVoter({...newVoter, national_id: e.target.value})} />
          <button style={styles.btn} onClick={regVoter}>Register & Issue PIN</button>
          
          <h3 style={{marginTop: '30px'}}>Registry List</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {voters.map(v => (
              <li key={v.national_id} style={{ padding: '10px', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between' }}>
                <span>{v.name} (ID: {v.national_id})</span>
                <span style={{ color: v.has_voted ? 'green' : 'red', fontWeight: 'bold' }}>{v.has_voted ? 'VOTED' : 'ELGIBLE'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'RESULTS' && (
        <div style={styles.card}>
          <h2>Live Tally Results 🏆</h2>
          <p>Results are recovered from the homomorphic sum using threshold decryption[cite: 412].</p>
          {candidates.map(c => {
            const votes = results.results[c.id] || 0;
            const pct = results.total_cast ? (votes / results.total_cast) * 100 : 0;
            return (
              <div key={c.id} style={{ marginBottom: '20px' }}>
                <p><b>{c.name}</b>: {votes} votes ({pct.toFixed(1)}%)</p>
                <div style={{ background: '#eee', width: '100%', height: '25px', borderRadius: '5px' }}>
                  <div style={{ background: COLORS.primary, width: `${pct}%`, height: '100%', borderRadius: '5px', transition: 'width 0.5s' }}></div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
}
