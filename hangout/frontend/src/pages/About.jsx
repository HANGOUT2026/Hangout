import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '../lib/useTheme';
import './Home.css';

export default function About() {
  const navigate = useNavigate();
  useTheme(); // subscribe so data-theme stays applied on this page

  return (
    <div className="home-container">
      {/* Topbar */}
      <div className="topbar" style={{ marginBottom: '40px' }}>
        <div className="brand">
          Hangout
        </div>
        <div className="topbar-right">
          <button
            onClick={() => navigate(-1)}
            className="neo-pill-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '14px' }}
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="greeting" style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '32px' }}>About Hangout</h1>
          <p style={{ fontSize: '16px', lineHeight: '1.6', marginTop: '16px' }}>
            Hangout is a modern, lightweight platform designed for spontaneous and seamless communication. Whether you're catching up with friends or collaborating with a team, our goal is to eliminate friction and make every conversation feel natural.
          </p>
        </div>
        
        <div className="card neo-raised" style={{ marginBottom: '32px' }}>
          <div className="eyebrow" style={{ marginBottom: '12px' }}>Core Capabilities</div>
          <h2 style={{ fontSize: '22px', margin: '0 0 16px', color: 'var(--text-primary)' }}>
            Features
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              'Instant video calls with no downloads required',
              'Secure and private meeting rooms',
              'Save notes directly from your workspace',
              'Playback recorded meetings effortlessly',
            ].map((item) => (
              <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--accent-dim)', flexShrink: 0 }} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="card neo-raised" style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '22px', margin: '0 0 24px', color: 'var(--text-primary)' }}>
            Meet the Developers
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Romit Singh</p>
                  <a 
                    href="https://www.linkedin.com/in/romit-singh-ba940634a" 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ color: 'var(--text-tertiary)', transition: 'color 0.2s', display: 'flex' }}
                    title="LinkedIn Profile"
                    onMouseOver={(e) => e.currentTarget.style.color = '#0077b5'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                  </a>
                </div>
                <p className="mono" style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--accent-dim)' }}>Backend Developer</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Subhrotosh Chakraborty</p>
                  <a 
                    href="https://www.linkedin.com/in/subhrotosh-chakraborty-696758388" 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ color: 'var(--text-tertiary)', transition: 'color 0.2s', display: 'flex' }}
                    title="LinkedIn Profile"
                    onMouseOver={(e) => e.currentTarget.style.color = '#0077b5'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                  </a>
                </div>
                <p className="mono" style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--accent-dim)' }}>Frontend Developer</p>
              </div>
            </div>
          </div>
        </div>
        
        <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', textAlign: 'center', marginTop: 'auto', paddingTop: '48px' }}>
          Built with simplicity and elegance in mind. Thank you for using Hangout.
        </p>
      </div>
    </div>
  );
}
