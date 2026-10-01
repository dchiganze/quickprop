import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  BedDouble,
  Bookmark,
  Bath,
  Check,
  ChevronRight,
  Droplets,
  MapPin,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useSceneTimer } from '@/lib/video';
import { AppTabBar, PhoneFrame } from './PhoneFrame';

export function MatchesScene() {
  const [detailVisible, setDetailVisible] = useState(false);
  const [secondCardVisible, setSecondCardVisible] = useState(false);
  const [handoff, setHandoff] = useState(false);

  const events = useMemo(
    () => [
      { time: 1450, callback: () => setDetailVisible(true) },
      { time: 3050, callback: () => setSecondCardVisible(true) },
      { time: 4270, callback: () => setHandoff(true) },
    ],
    [],
  );
  useSceneTimer(events);

  return (
    <motion.section
      className="film-scene matches-scene"
      initial={{ opacity: 0, clipPath: 'inset(0 0 0 12%)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
      exit={{ opacity: 0, clipPath: 'inset(0 0 0 100%)' }}
      transition={{ duration: 0.45, ease: [0.7, 0, 0.3, 1] }}
    >
      <div className="scene-glow scene-glow-match" />
      <div className="scene-grid" />
      <div className="scene-index index-match">
        <span className="index-number">01</span>
        <span className="index-label">MATCHES</span>
      </div>
      <div className="scene-side-note">DISCOVER · COLLABORATE · TRACK</div>

      <motion.svg
        className="match-connector"
        viewBox="0 0 1280 720"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <motion.path
          d="M 535 386 C 610 386 633 350 717 350"
          fill="none"
          stroke="#8ed4bc"
          strokeWidth="1.4"
          strokeDasharray="4 7"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: detailVisible ? 1 : 0,
            opacity: detailVisible ? 0.85 : 0,
          }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
        />
        <motion.circle
          cx="717"
          cy="350"
          r="4"
          fill="#b6ecd8"
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: detailVisible ? 1 : 0,
            opacity: detailVisible ? 1 : 0,
          }}
          transition={{ duration: 0.2, delay: 0.48 }}
        />
      </motion.svg>

      <AnimatePresence>
        {detailVisible && (
          <motion.div
            className="match-detail-card"
            initial={{ opacity: 0, x: -30, y: 12, rotate: -3, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, y: 0, rotate: -1.5, scale: 1 }}
            exit={{ opacity: 0, scale: 1.06, x: 18 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="detail-card-topline">
              <span>COLLABORATION LISTING</span>
              <motion.span
                className={`open-badge ${handoff ? 'open-badge-handoff' : ''}`}
                animate={
                  handoff
                    ? {
                        scale: 2.2,
                        x: 30,
                        borderRadius: 13,
                        boxShadow: '0 0 0 10px rgba(142, 212, 188, .16)',
                      }
                    : { scale: 1, x: 0, borderRadius: 999, boxShadow: '0 0 0 0 rgba(142, 212, 188, 0)' }
                }
                transition={{ duration: 0.54, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <span className="open-dot" />
                Open
              </motion.span>
            </div>
            <div className="detail-property-row">
              <PropertyIllustration compact />
              <div className="detail-property-copy">
                <span className="detail-property-type">4-BED · FOR SALE</span>
                <h2>Borrowdale</h2>
                <div className="detail-location"><MapPin size={13} /> Harare</div>
              </div>
              <ChevronRight className="detail-chevron" size={17} />
            </div>
            <div className="detail-price-row">
              <strong>USD 285,000</strong>
              <span>QP-2418</span>
            </div>
            <div className="detail-features">
              <span><BedDouble size={14} /> 4 beds</span>
              <span><Bath size={14} /> 3 baths</span>
              <span><Droplets size={14} /> Borehole</span>
            </div>
            <div className="detail-request">
              <span>Request collaboration</span>
              <span className="request-arrow"><ChevronRight size={16} /></span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PhoneFrame>
        <div className="matches-app">
          <header className="matches-header">
            <div>
              <h1>Matches</h1>
              <p>Discover, collaborate, and track requests</p>
            </div>
            <div className="header-bell">
              <Bell size={19} strokeWidth={1.8} />
              <span />
            </div>
          </header>
          <div className="saved-alert-row">
            <span className="saved-icon"><Bookmark size={15} /></span>
            <div className="saved-copy">
              <strong>Saved alerts</strong>
              <span>3 criteria · 2 new</span>
            </div>
            <ChevronRight size={16} className="saved-chevron" />
          </div>
          <div className="matches-search">
            <Search size={15} />
            <span>Road, suburb, amenities, size, beds, price…</span>
            <SlidersHorizontal size={15} />
          </div>
          <div className="matches-tabs">
            <span className="tab-selected">Discover</span>
            <span>Requests <b>2</b></span>
            <span>Sent</span>
          </div>
          <div className="listing-feed">
            <div className="feed-section-label">
              <span>LISTINGS FOR YOU</span>
              <span className="sort-label">Newest <ChevronRight size={12} /></span>
            </div>
            <div className="mobile-listing-card">
              <div className="mobile-listing-top">
                <PropertyIllustration />
                <div className="mobile-listing-content">
                  <div className="mobile-card-status">
                    <span>FOR SALE</span>
                    <motion.span
                      className={`open-badge open-badge-small ${handoff ? 'open-badge-handoff' : ''}`}
                      animate={
                        handoff
                          ? { scale: 2.15, x: 20, borderRadius: 12 }
                          : { scale: 1, x: 0, borderRadius: 999 }
                      }
                      transition={{ duration: 0.48, ease: [0.2, 0.8, 0.2, 1] }}
                    >
                      <span className="open-dot" /> Open
                    </motion.span>
                  </div>
                  <strong>4-bed in Borrowdale</strong>
                  <span className="mobile-listing-meta">Harare · QP-2418</span>
                  <b className="mobile-listing-price">USD 285,000</b>
                </div>
              </div>
              <div className="mobile-card-features">
                <span><BedDouble size={12} /> 4</span>
                <i />
                <span><Bath size={12} /> 3</span>
                <i />
                <span><Droplets size={12} /> Borehole</span>
              </div>
              <div className="mobile-request-button">
                <span>Request collaboration</span>
                <ChevronRight size={15} />
              </div>
            </div>
            <AnimatePresence>
              {secondCardVisible && (
                <motion.div
                  className="second-listing-card"
                  initial={{ opacity: 0, y: 22, clipPath: 'inset(0 0 100% 0)' }}
                  animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="second-listing-thumb" />
                  <div>
                    <strong>3-bed in Avondale</strong>
                    <span>Harare · QP-1986</span>
                  </div>
                  <ChevronRight size={15} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <AppTabBar active="matches" />
        </div>
      </PhoneFrame>

      <div className="bottom-caption">
        <span className="caption-dot" />
        <span>QUICKPROP AGENT</span>
        <span className="caption-divider" />
        <span>COLLABORATION DISCOVERY</span>
      </div>
    </motion.section>
  );
}

function PropertyIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`property-illustration ${compact ? 'property-illustration-compact' : ''}`}>
      <div className="property-sky" />
      <div className="property-tree property-tree-one" />
      <div className="property-tree property-tree-two" />
      <div className="property-house">
        <span className="house-roof" />
        <span className="house-body">
          <i /><i /><i />
        </span>
      </div>
      <span className="property-photo-chip"><Check size={9} /></span>
    </div>
  );
}