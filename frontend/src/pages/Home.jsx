import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import Preloader from "../components/Preloader";
import WeatherCard from "../components/WeatherCard";
import BB8Toggle from "../components/BB8Toggle";
import { useTheme } from "../lib/useTheme";
import "./Home.css";

import {
  Video,
  Trash2,
  Copy,
  FileText
} from "lucide-react";

function DigitalClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  const dateStr = now
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "2-digit"
    })
    .toUpperCase();

  return (
    <div className="clock-wrap">
      <div className="clock-dial">
        <div className="time">
          {hh}<span className="colon">:</span>{mm}<span className="colon">:</span>{ss}
        </div>
        <div className="date">
          {dateStr}
        </div>
      </div>
    </div>
  );
}


export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  // Preloader State
  const [showPreloader, setShowPreloader] = useState(
    location.state?.showPreloader || false
  );

  useEffect(() => {
    if (location.state?.showPreloader) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // App States
  const username = sessionStorage.getItem("username");
  
  useEffect(() => {
    if (!username) {
      navigate("/sign-in");
    }
  }, [username, navigate]);

  const displayName = username || "";

  const [joinCode, setJoinCode] = useState("");
  const [joinAlert, setJoinAlert] = useState(false);

  // Recordings Modal States
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [savedRecordings, setSavedRecordings] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [recordingsCount, setRecordingsCount] = useState(0);

  // Notes Modal States
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [savedNotes, setSavedNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesCount, setNotesCount] = useState(0);
  const [copiedNoteId, setCopiedNoteId] = useState(null);

  // Pre-Join Modal States
  const [preJoinRoomId, setPreJoinRoomId] = useState(null);
  const [camEnabled, setCamEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);

  // Logout Modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleToggleCam = async () => {
    if (!camEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(t => t.stop());
        setCamEnabled(true);
      } catch (err) {
        console.error("Camera permission denied:", err);
        alert("Could not access camera.");
        setCamEnabled(false);
      }
    } else {
      setCamEnabled(false);
    }
  };

  const handleToggleMic = async () => {
    if (!micEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        setMicEnabled(true);
      } catch (err) {
        console.error("Microphone permission denied:", err);
        alert("Could not access microphone.");
        setMicEnabled(false);
      }
    } else {
      setMicEnabled(false);
    }
  };

  const handleConfirmJoin = () => {
    if (preJoinRoomId) {
      navigate(`/call/${preJoinRoomId}`, { state: { camEnabled, micEnabled } });
    }
  };

  useEffect(() => {
    if (username) {
      axios.get(`${API_BASE_URL}/api/recordings/${username}/`)
        .then(res => {
          setRecordingsCount(res.data.recordings.length);
          setSavedRecordings(res.data.recordings);
        })
        .catch(err => console.error("Failed to fetch recordings:", err));

      axios.get(`${API_BASE_URL}/api/notes/${username}/`)
        .then(res => {
          setNotesCount(res.data.notes.length);
          setSavedNotes(res.data.notes);
        })
        .catch(err => console.error("Failed to fetch notes:", err));
    }
  }, [username]);

  const handleNewCall = async () => {
    if (!username) {
      alert("Please sign in first!");
      navigate("/sign-in");
      return;
    }
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/create-room/`);
      setPreJoinRoomId(response.data.room_id);
    } catch (error) {
      console.error("Failed to create room", error);
      alert("Failed to start meeting.");
    }
  };

 const handleJoinCall = async () => {
    if (!username) {
      alert("Please sign in first!");
      navigate("/sign-in");
      return;
    }
    
    if (joinCode && joinCode.trim() !== "") {
      let roomToCheck = joinCode.trim();
      
      // If the user pasted a full URL, extract the room ID
      if (roomToCheck.includes("/call/")) {
        const parts = roomToCheck.split("/call/");
        roomToCheck = parts[parts.length - 1].replace(/\/$/, ""); // remove trailing slash if any
      }
      
      try {
        const response = await axios.get(`${API_BASE_URL}/api/validate-room/${roomToCheck}/`);
        
        if (response.data.exists) {
          setPreJoinRoomId(roomToCheck);
        }
      } catch (error) {
        setJoinAlert(true);
        setTimeout(() => setJoinAlert(false), 3000);
      }
    }
  };

  const handleOpenRecordings = async () => {
    if (!username) {
      alert("Please sign in first to review history!");
      navigate("/sign-in");
      return;
    }
    setShowRecordingModal(true);
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/recordings/${username}/`);
      setSavedRecordings(res.data.recordings);
    } catch (err) {
      console.error("Failed to fetch recordings:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteRecording = async (recId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/recordings/delete/${recId}/`);
      setSavedRecordings(prev => prev.filter(r => r.id !== recId));
      setRecordingsCount(prev => prev - 1);
    } catch (err) {
      console.error("Failed to delete recording:", err);
    }
  };

  const handleOpenNotes = async () => {
    if (!username) {
      alert("Please sign in first to review notes!");
      navigate("/sign-in");
      return;
    }
    setShowNotesModal(true);
    setLoadingNotes(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/notes/${username}/`);
      setSavedNotes(res.data.notes);
    } catch (err) {
      console.error("Failed to fetch notes:", err);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/notes/delete/${noteId}/`);
      setSavedNotes(prev => prev.filter(n => n.id !== noteId));
      setNotesCount(prev => prev - 1);
    } catch (err) {
      console.error("Failed to delete note:", err);
      alert("Failed to delete note.");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("username");
    navigate("/sign-in", { state: { fromLogout: true } });
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      {showPreloader && <Preloader onComplete={() => setShowPreloader(false)} />}
      
      <div className="home-container">
        <div className="home-content-wrapper">
          <div className="topbar">
          <div className="brand">
            Hangout
          </div>
          <div className="topbar-right">
            <BB8Toggle checked={theme === 'light'} onChange={toggleTheme} />
            {username ? (
              <div className="avatar" onClick={() => setShowLogoutModal(true)} title="Logout">
                {displayName.charAt(0).toUpperCase()}
              </div>
            ) : (
              <div className="avatar" onClick={() => navigate("/sign-in")} title="Sign In">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div className="greeting-row">
          <div className="greeting">
            <h1>{greeting}</h1>
            <p>Ready when you are.</p>
          </div>
          <DigitalClock />
        </div>

        <div className="grid-top">
          <div className="card neo-raised">
            <div className="card-head">
              <div>
                <div className="eyebrow">New call</div>
                <h2>Start an instant meeting</h2>
              </div>
              <div className="neo-icon-circle" style={{ color: "var(--accent)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              </div>
            </div>
            <p className="desc">Spin up a room and share the code.</p>
            <button className="neo-pill-btn primary" onClick={handleNewCall}>Start call →</button>
          </div>

          <div className="card neo-raised">
            <div className="eyebrow">Join call</div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '19px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-secondary)" }}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              Have a code?
            </h2>

            {/* Invalid code alert */}
            <div className={`join-alert ${joinAlert ? 'join-alert--visible' : ''}`}>
              <span className="join-alert__icon">🚫</span>
              <div className="join-alert__body">
                <span className="join-alert__title">Nope, that's not it!</span>
                <span className="join-alert__msg">That code doesn't exist (or it ghosted us 👻). Double-check and try again!</span>
              </div>
              <button className="join-alert__close" onClick={() => setJoinAlert(false)}>✕</button>
            </div>

            <div style={{ position: "relative", marginBottom: "14px", width: "100%" }}>
              <input 
                className={`neo-inset${joinAlert ? ' join-input--shake' : ''}`}
                type="text" 
                placeholder="Enter meeting code" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                style={{ marginBottom: 0, width: "100%", paddingRight: "45px", boxSizing: "border-box" }}
              />
              <button
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  padding: "4px",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    setJoinCode(text);
                  } catch (err) {
                    console.error("Paste failed", err);
                  }
                }}
                title="Paste from clipboard"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              </button>
            </div>
            <div 
              className={`join-btn ${joinCode.trim().length > 0 ? 'active' : ''}`}
              onClick={handleJoinCall}
            >
              Join
            </div>
          </div>
        </div>

        <div className="grid-bottom">
          <WeatherCard />

          <div className="card neo-raised stat-card">
            <div className="eyebrow">Call recordings</div>
            <div className="icon-row" style={{ marginTop: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "#ef4444" }}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/></svg>
              <span className="stat-value">{recordingsCount} saved</span>
            </div>
            <p className="desc" style={{ marginTop: '14px' }}>Review past meetings and video recordings.</p>
            <button className="neo-pill-btn card-cta" onClick={handleOpenRecordings}>View Recordings</button>
          </div>

          <div className="card neo-raised stat-card">
            <div className="eyebrow">Saved Notes</div>
            <div className="icon-row" style={{ marginTop: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "#ffffff" }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span className="stat-value">{notesCount} notes</span>
            </div>
            <p className="desc" style={{ marginTop: '14px' }}>Access saved notes.</p>
            <button className="neo-pill-btn card-cta" onClick={handleOpenNotes}>Open notes</button>
          </div>
        </div>

        <footer>
          <span 
            onClick={() => navigate("/about")} 
            style={{ cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseOver={(e) => e.target.style.color = 'var(--accent)'}
            onMouseOut={(e) => e.target.style.color = 'var(--text-tertiary)'}
          >
            About
          </span>
          <span>Hangout</span>
        </footer>
        </div>
        
        {/* LOGOUT MODAL */}
        {showLogoutModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px', padding: '32px', textAlign: 'center' }}>
              <span style={{ fontSize: '48px', lineHeight: 1, display: 'block', marginBottom: '16px' }}>🥺</span>
              <h2 style={{ margin: '0 0 10px', fontSize: '20px' }}>You're leaving already?!</h2>
              <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
                We'll keep the lights on for you 🕯️ Come back soon — your meetings and notes will miss you! 👋
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button className="neo-pill-btn" onClick={() => setShowLogoutModal(false)}>Cancel</button>
                <button className="neo-pill-btn" style={{ color: 'var(--danger-soft)' }} onClick={handleLogout}>Log out</button>
              </div>
            </div>
          </div>
        )}

        {/* HISTORIC PLAYBACK HISTORY MODAL */}
        {showRecordingModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px', padding: '24px', maxHeight: '80vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--shadow-dark-soft)', paddingBottom: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--accent)' }}>📁 Your Meeting Recordings</h2>
                <button onClick={() => setShowRecordingModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>

              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                {loadingHistory && savedRecordings.length > 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0' }}>Loading recordings...</p>
                ) : savedRecordings.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '32px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: '40px', lineHeight: 1 }}>🎞️</span>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Nothing to rewatch… yet!</p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '240px', lineHeight: '1.5' }}>Your call recordings will show up here. Start a call and hit record — your future self will thank you 📼</p>
                  </div>
                ) : (
                  savedRecordings.map((rec, index) => (
                    <div key={index} className="modal-item" style={{ borderRadius: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '14px' }}>Room Token: <span className="mono" style={{ color: 'var(--accent)' }}>{rec.room_id}</span></span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Recorded: {rec.created_at}</span>
                        <span style={{ fontSize: '12px', color: '#e08a6d', background: 'rgba(224,138,109,0.1)', padding: '2px 8px', borderRadius: '4px', width: 'fit-content', marginTop: '4px' }}>
                          ⏰ Expires in {rec.days_remaining} days
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a 
                          href={rec.file_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="neo-pill-btn primary"
                          style={{ textDecoration: 'none', padding: '8px 16px', fontSize: '13px' }}
                        >
                          Play ▶️
                        </a>
                        <button
                          onClick={() => handleDeleteRecording(rec.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--danger-soft)', cursor: 'pointer', padding: '8px' }}
                          title="Delete recording"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* SAVED NOTES MODAL LAYER */}
        {showNotesModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px', padding: '24px', maxHeight: '80vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--shadow-dark-soft)', paddingBottom: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--accent)' }}>📝 Your Saved Notes</h2>
                <button onClick={() => setShowNotesModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>

              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
                {loadingNotes && savedNotes.length > 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0' }}>Loading notes...</p>
                ) : savedNotes.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '32px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: '40px', lineHeight: 1 }}>🗒️</span>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Squeaky clean in here!</p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '240px', lineHeight: '1.5' }}>No notes saved yet. Jump into a call and jot something down — even "buy milk 🥛" counts! ✍️</p>
                  </div>
                ) : (
                  savedNotes.map((note, index) => (
                    <div key={index} className="modal-item" style={{ borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--shadow-dark-soft)', paddingBottom: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ color: '#ffffff' }}><FileText size={16} /></div>
                            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                              Room: <span className="mono" style={{ color: 'var(--accent)', background: 'rgba(212,126,48,0.1)', padding: '2px 8px', borderRadius: '4px', marginLeft: '4px' }}>{note.room_id}</span>
                            </span>
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {note.created_at}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(note.content);
                              setCopiedNoteId(note.id);
                              setTimeout(() => setCopiedNoteId(null), 2000);
                            }}
                            title="Copy Note"
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            {copiedNoteId === note.id ? <span style={{ fontSize: '12px', color: 'var(--accent)' }}>Copied!</span> : <Copy size={16} />}
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            title="Delete Note"
                            style={{ background: 'transparent', border: 'none', color: 'var(--danger-soft)', cursor: 'pointer', padding: '8px' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '12px', padding: '16px', border: '1px solid var(--shadow-dark-soft)' }}>
                        <p style={{ margin: 0, fontSize: '14px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{note.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* PRE-JOIN PERMISSION MODAL */}
        {preJoinRoomId && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '380px', padding: '32px', alignItems: 'center', position: 'relative' }}>
              <button onClick={() => setPreJoinRoomId(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              
              <div style={{ color: 'var(--accent)', marginBottom: '20px' }}>
                <Video size={36} strokeWidth={2} />
              </div>
              
              <h2 style={{ margin: '0 0 32px', fontSize: '20px' }}>Ready to join?</h2>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                <div className="modal-item" style={{ borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>Camera</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Share video</span>
                  </div>
                  <button 
                    onClick={handleToggleCam}
                    style={{ 
                      width: '48px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative',
                      background: camEnabled ? 'var(--accent)' : 'var(--shadow-dark-soft)',
                      transition: 'background 0.2s'
                    }}
                  >
                    <span style={{ 
                      width: '16px', height: '16px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '4px',
                      left: camEnabled ? '28px' : '4px', transition: 'left 0.2s'
                    }} />
                  </button>
                </div>
                
                <div className="modal-item" style={{ borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>Microphone</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Share audio</span>
                  </div>
                  <button 
                    onClick={handleToggleMic}
                    style={{ 
                      width: '48px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative',
                      background: micEnabled ? 'var(--accent)' : 'var(--shadow-dark-soft)',
                      transition: 'background 0.2s'
                    }}
                  >
                    <span style={{ 
                      width: '16px', height: '16px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '4px',
                      left: micEnabled ? '28px' : '4px', transition: 'left 0.2s'
                    }} />
                  </button>
                </div>
              </div>

              <button
                onClick={handleConfirmJoin}
                className="neo-pill-btn primary"
                style={{ width: '100%', padding: '16px' }}
              >
                Join Call
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}