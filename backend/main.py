import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
import hashlib
from typing import Optional

app = FastAPI(title="UoN Secure Electronic Voting API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Cryptographic Prime Generation (Miller-Rabin) ---
def is_prime(n, k=40):
    """Miller-Rabin Primality Test [cite: 572]"""
    if n == 2 or n == 3: return True
    if n <= 1 or n % 2 == 0: return False
    s, d = 0, n - 1
    while d % 2 == 0:
        s += 1
        d //= 2
    for _ in range(k):
        a = random.randrange(2, n - 1)
        x = pow(a, d, n)
        if x == 1 or x == n - 1: continue
        for _ in range(s - 1):
            x = pow(x, 2, n)
            if x == n - 1: break
        else: return False
    return True

def generate_prime(bits):
    """Generates a prime number of the specified bit length."""
    while True:
        p = random.getrandbits(bits)
        p |= (1 << bits - 1) | 1 # Ensure it's odd and has the correct bit length
        if is_prime(p): return p

# --- Cryptographic Engine ---
class ElGamalVotingSystem:
    def __init__(self, p, g):
        self.p = p
        self.g = g
        self.private_key = random.randint(1, self.p - 2)
        self.public_key = pow(self.g, self.private_key, self.p)

    def verify_zkp(self, alpha, beta, t, s):
        challenge_string = f"{alpha}{beta}{t}"
        c = int(hashlib.sha256(challenge_string.encode()).hexdigest(), 16) % (self.p - 1)
        return pow(self.g, s, self.p) == (t * pow(alpha, c, self.p)) % self.p

    def decrypt_tally(self, encrypted_ballots):
        alpha_total, beta_total = 1, 1
        for alpha, beta in encrypted_ballots:
            alpha_total = (alpha_total * alpha) % self.p
            beta_total = (beta_total * beta) % self.p
            
        s_val = pow(alpha_total, self.private_key, self.p)
        s_inv = pow(s_val, -1, self.p)
        m_total = (beta_total * s_inv) % self.p
        
        tally = 0
        while pow(self.g, tally, self.p) != m_total:
            tally += 1
            if tally > self.p: return 0
        return tally

# We use a 1024-bit equivalent for safety, but hardcode a small one for browser performance
# Example of generating a secure prime: secure_p = generate_prime(2048)
crypto_system = ElGamalVotingSystem(p=1009, g=11)

# --- Databases ---
candidates_db = []
voters_db = {} # Format: { "NationalID": {"name": "...", "pin": "...", "has_voted": False} }
encrypted_ballots_db = []
election_open = True

# --- Data Models ---
class Candidate(BaseModel):
    name: str
    party: str
    position: str
    photo_url: str

class Voter(BaseModel):
    name: str
    national_id: str

class VoterAuth(BaseModel):
    national_id: str
    pin: str

class EncryptedBallot(BaseModel):
    alpha: int
    beta: int
    t: int 
    s: int 
    national_id: str # To mark them as voted

# --- Endpoints ---
@app.get("/public-key")
def get_public_key():
    return {"p": crypto_system.p, "g": crypto_system.g, "Y": crypto_system.public_key}

@app.get("/candidates")
def get_candidates():
    return candidates_db

@app.post("/admin/candidates")
def add_candidate(cand: Candidate):
    new_id = len(candidates_db)
    candidates_db.append({"id": new_id, **cand.dict()})
    return {"message": "Candidate Registered"}

@app.post("/admin/voters")
def register_voter(voter: Voter):
    if voter.national_id in voters_db:
        raise HTTPException(status_code=400, detail="Voter already registered.")
    pin = str(random.randint(100000, 999999))
    voters_db[voter.national_id] = {"name": voter.name, "pin": pin, "has_voted": False}
    return {"pin": pin}

@app.get("/admin/voters")
def get_voters():
    return [{"national_id": k, "name": v["name"], "has_voted": v["has_voted"]} for k, v in voters_db.items()]

@app.post("/voter/login")
def login_voter(auth: VoterAuth):
    voter = voters_db.get(auth.national_id)
    if not voter or voter["pin"] != auth.pin:
        raise HTTPException(status_code=401, detail="Invalid ID or PIN")
    if voter["has_voted"]:
        raise HTTPException(status_code=403, detail="Voter has already cast a ballot.")
    return {"message": f"Welcome, {voter['name']}", "name": voter['name']}

@app.post("/vote")
def cast_vote(ballot: EncryptedBallot):
    if not election_open: raise HTTPException(status_code=403, detail="Election is closed.")
    voter = voters_db.get(ballot.national_id)
    if not voter or voter["has_voted"]: raise HTTPException(status_code=403, detail="Invalid voting attempt.")
    
    if not crypto_system.verify_zkp(ballot.alpha, ballot.beta, ballot.t, ballot.s):
        raise HTTPException(status_code=400, detail="Invalid ZKP! Ballot rejected.")
        
    encrypted_ballots_db.append((ballot.alpha, ballot.beta))
    voters_db[ballot.national_id]["has_voted"] = True
    return {"status": "success", "tracking_code": f"UON-{random.randint(1000,9999)}-{ballot.alpha % 100}"}

@app.get("/admin/tally")
def get_results():
    total_cast = len(encrypted_ballots_db)
    if total_cast == 0: return {"total_cast": 0, "registered": len(voters_db), "results": {}}
    
    total_index_sum = crypto_system.decrypt_tally(encrypted_ballots_db)
    
    # Simple ID decoding for demo (Works if IDs are 0, 1, etc.)
    results = {}
    if len(candidates_db) == 2:
        cand_1_votes = total_index_sum
        cand_0_votes = total_cast - cand_1_votes
        results = {0: cand_0_votes, 1: cand_1_votes}
        
    return {"total_cast": total_cast, "registered": len(voters_db), "results": results}