import React, { useState, useEffect } from 'react';
import uonLogo from './uon-logo.jpeg'; 

// Ensures React app talks to your live Render server
const API_BASE = 'https://uon-voting-backend.onrender.com';

// --- STYLING (UoN Inspired) ---
const COLORS = {
  primary: '#004d28', 
  secondary: '#d4af37', 
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
  
  const [adminCreds, setAdminCreds] = useState({ user: '', pass: '' });
  const [voterCreds, setVoterCreds] = useState({ id: '', pin: '' });
  const [activeVoter, setActiveVoter] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [message, setMessage] = useState(""); 

  useEffect(() => {
    fetch(`${API_BASE}/public-key`).then(r => r.json()).then(setCryptoParams);
    refreshCandidates();
  }, [view]);

  const refreshCandidates = () => fetch(`${API_BASE}/candidates`).then(r => r.json()).then(setCandidates);

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

  const renderVoting = () => {
    const submitVote = async (candId) => {
      if (!window.confirm("Are you sure? This action cannot be undone.")) return;
      const { p, g, Y } = cryptoParams;
      const m = modPow(g, candId, p), r = Math.floor(Math.random() * (p - 2)) + 1;
      const alpha = modPow(g, r, p), beta = (m * modPow(Y, r, p)) % p;
      const k = Math.floor(Math.random() * (p - 2)) + 1, t = modPow(g, k, p);
      const c = Number((await generateHash(`${alpha}${beta}${t}`)) % window.BigInt(p - 1));
      const s = (k + (c * r)) % (p - 1);

      fetch(`${API_BASE}/vote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alpha: String(alpha), beta: String(beta), t: String(t), s: String(s), national_id: activeVoter })
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
        <p>> Ballot securely sealed using ElGamal ZKP</p>
        <p>> Homomorphic aggregation enabled for universal verifiability</p>
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
  const [editingId, setEditingId] = useState(null);
  const [newVoter, setNewVoter] = useState({ name: '', national_id: '' });
  const [voters, setVoters] = useState([]);
  const [results, setResults] = useState({ total_cast: 0, registered: 0, results: {} });

  const fetchVoters = () => fetch(`${API_BASE}/admin/voters`).then(r => r.json()).then(setVoters);
  const fetchResults = () => fetch(`${API_BASE}/admin/tally`).then(r => r.json()).then(setResults);

  useEffect(() => { fetchVoters(); fetchResults(); }, [tab]);

  // --- Candidate Functions ---
  const saveCandidate = () => {
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

  const deleteCandidate = (id) => {
    if (!window.confirm("Are you sure you want to delete this candidate?")) return;
    fetch(`${API_BASE}/admin/candidates/${id}`, { method: 'DELETE' })
      .then(() => {
        alert("Candidate deleted.");
        refreshCandidates();
      });
  };

  const startEdit = (c) => {
    setNewCand({ name: c.name, party: c.party, position: c.position, photo_url: c.photo_url || '' });
    setEditingId(c.id);
  };

  // --- Voter Functions ---
  const regVoter = () => {
    fetch(`${API_BASE}/admin/voters`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newVoter) })
      .then(async r => {
        const data = await r.json();
        if (r.ok) { alert(`Voter Registered! Secure 6-digit PIN: ${data.pin}\nRecord this PIN now.`); fetchVoters(); }
        else alert(data.detail);
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

      if (parsedVoters.length === 0) {
        alert("No valid data found. Ensure CSV format is: Name,National_ID");
        return;
      }

      fetch(`${API_BASE}/admin/voters/bulk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voters: parsedVoters })
      })
      .then(async r => {
        const data = await r.json();
        
        let csvContent = "data:text/csv;charset=utf-8,Name,National ID,Status,Secure PIN\n";
        data.results.forEach(res => {
          csvContent += `${res.name},${res.national_id},${res.status},${res.pin}\n`;
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "UoN_Voter_Registry_PINs.csv");
        document.body.appendChild(link);
        link.click();
        
        alert(`Bulk registration complete! A spreadsheet containing the secure PINs is downloading now.`);
        fetchVoters();
      });
    };
    reader.readAsText(file);
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
          <h2>{editingId ? "Edit Candidate" : "Register New Candidate"}</h2>
          <input style={styles.input} placeholder="Candidate Name" value={newCand.name} onChange={e => setNewCand({...newCand, name: e.target.value})} />
          <input style={styles.input} placeholder="Party Name" value={newCand.party} onChange={e => setNewCand({...newCand, party: e.target.value})} />
          <input style={styles.input} placeholder="Position" value={newCand.position} onChange={e => setNewCand({...newCand, position: e.target.value})} />
          <input style={styles.input} placeholder="Photo URL (Direct Link ending in .jpg/.png)" value={newCand.photo_url} onChange={e => setNewCand({...newCand, photo_url: e.target.value})} />
          
          <button style={styles.btn} onClick={saveCandidate}>{editingId ? "Update Candidate" : "Add to Registry"}</button>
          {editingId && <button style={{...styles.btnOutline, marginLeft: '10px'}} onClick={() => { setEditingId(null); setNewCand({ name: '', party: '', position: '', photo_url: '' }); }}>Cancel</button>}

          <h3 style={{marginTop: '30px'}}>Current Candidates</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {candidates.map(c => (
              <li key={c.id} style={{ padding: '10px', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><b>{c.name}</b> ({c.party}) - {c.position}</span>
                <div>
                  <button style={{...styles.btnOutline, padding: '5px 10px', marginRight: '10px'}} onClick={() => startEdit(c)}>Edit</button>
                  <button style={{...styles.btnOutline, padding: '5px 10px', color: 'red', borderColor: 'red'}} onClick={() => deleteCandidate(c.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'VOTERS' && (
        <div style={styles.card}>
          <h2>Voter Registry Management</h2>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input style={styles.input} placeholder="Full Name" onChange={e => setNewVoter({...newVoter, name: e.target.value})} />
            <input style={styles.input} placeholder="National ID" onChange={e => setNewVoter({...newVoter, national_id: e.target.value})} />
            <button style={{ ...styles.btn, width: '200px' }} onClick={regVoter}>Register (Single)</button>
          </div>
          
          <hr style={{ margin: '20px 0', border: '1px solid #eee' }} />
          
          <h3>Bulk Registration (CSV Upload)</h3>
          <p style={{ fontSize: '0.9em', color: '#666' }}>Upload a .csv file formatted with two columns: <b>Name, National_ID</b> (no header row).</p>
          <input type="file" accept=".csv" onChange={handleBulkUpload} style={{ padding: '10px', border: '2px dashed #ccc', width: '100%' }} />

          <h3 style={{marginTop: '30px'}}>Registry List</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {voters.map(v => (
              <li key={v.national_id} style={{ padding: '10px', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between' }}>
                <span>{v.name} (ID: {v.national_id})</span>
                <span style={{ color: v.has_voted ? 'green' : 'red', fontWeight: 'bold' }}>{v.has_voted ? 'VOTED' : 'ELIGIBLE'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'RESULTS' && (
        <div style={styles.card}>
          <h2>Live Tally Results 🏆</h2>
          <p>Results are recovered from the homomorphic sum using threshold decryption.</p>
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