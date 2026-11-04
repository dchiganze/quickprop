import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="phone-positioner">
      <motion.div
        className="phone-frame"
        initial={{ opacity: 0, y: 28, scale: 1.035, rotateY: -7 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateY: 0 }}
        exit={{ opacity: 0, y: 18, scale: 0.99 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="phone-bezel">
          <div className="phone-screen">
            <div className="phone-notch" aria-hidden="true" />
            <div className="phone-statusbar">
              <span>9:41</span>
              <span className="status-icons" aria-hidden="true">
                <svg viewBox="0 0 44 16" fill="none">
                  <path d="M1.7 5.5C6.9.4 15.1.4 20.3 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M5 9C8.3 5.9 13.7 5.9 17 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M8.4 12.1C9.9 10.7 12.1 10.7 13.6 12.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="11" cy="14" r="1" fill="currentColor" />
                  <rect x="25" y="3.2" width="15" height="9.5" rx="2.3" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="27" y="5.2" width="9.8" height="5.5" rx="1.1" fill="currentColor" />
                  <path d="M41 6v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            {children}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function AppTabBar({ active }: { active: 'matches' | 'share' }) {
  return (
    <div className="app-tabbar">
      <div className="app-tab">
        <span className="tab-icon">⌂</span>
        <span>Home</span>
      </div>
      <div className="app-tab">
        <span className="tab-icon">▤</span>
        <span>Listings</span>
      </div>
      <div className={`app-tab ${active === 'matches' ? 'is-active' : ''}`}>
        <span className="tab-icon">◉</span>
        <span>Matches</span>
      </div>
      <div className={`app-tab ${active === 'share' ? 'is-active' : ''}`}>
        <span className="tab-icon">↗</span>
        <span>Share</span>
      </div>
      <div className="app-tab">
        <span className="tab-icon">○</span>
        <span>Profile</span>
      </div>
    </div>
  );
}