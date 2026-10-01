import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bath,
  BedDouble,
  Building2,
  Check,
  Facebook,
  Linkedin,
  MessageCircle,
  Plus,
  Share2,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSceneTimer } from '@/lib/video';
import logo from '@assets/quickprop-logo.png';

const EASE = [0.22, 1, 0.36, 1] as const;
const SNAP = { type: 'spring' as const, stiffness: 420, damping: 30 };

function StatusPill({ children, green = false }: { children: React.ReactNode; green?: boolean }) {
  return <span className={`status-pill ${green ? 'status-pill--green' : ''}`}>{children}</span>;
}

function HouseArtwork() {
  return (
    <div className="house-art">
      <div className="house-art__sun" />
      <div className="house-art__hill house-art__hill--back" />
      <div className="house-art__hill house-art__hill--front" />
      <div className="house-art__building">
        <div className="house-art__roof" />
        <div className="house-art__window house-art__window--one" />
        <div className="house-art__window house-art__window--two" />
        <div className="house-art__door" />
      </div>
      <div className="house-art__tree" />
    </div>
  );
}

export function DashboardScene() {
  return (
    <motion.section
      className="film-scene scene-dashboard"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="blueprint-grid" />
      <motion.div
        className="loop-dot"
        initial={{ scale: 0.85 }}
        animate={{ scale: [0.85, 1.2, 1], x: ['-2vw', '31vw', '31vw'], y: ['0', '-28vh', '-28vh'] }}
        transition={{ duration: 0.55, times: [0, 0.75, 1], ease: EASE }}
      />
      <div className="dashboard-copy">
        <motion.div
          className="eyebrow"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.32, delay: 0.08, ease: EASE }}
        >
          QUICKPROP AGENT
        </motion.div>
        <div className="headline-mask">
          <motion.h1
            initial={{ y: '115%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.48, delay: 0.18, ease: EASE }}
          >
            YOUR<br />PORTFOLIO.
          </motion.h1>
        </div>
        <div className="headline-mask">
          <motion.h1
            className="green-word"
            initial={{ y: '115%', letterSpacing: '0.08em' }}
            animate={{ y: 0, letterSpacing: '-0.06em' }}
            transition={{ duration: 0.42, delay: 0.58, ease: EASE }}
          >
            MOVING.
          </motion.h1>
        </div>
      </div>

      <motion.div
        className="phone-shadow"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="phone-shell"
        initial={{ scale: 1.35, rotate: 10, filter: 'blur(8px)', x: '5vw' }}
        animate={{ scale: 1, rotate: 5, filter: 'blur(0px)', x: 0 }}
        exit={{ scale: 1.42, rotate: 0, x: '-8vw', filter: 'blur(7px)', opacity: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <div className="phone-notch" />
        <div className="phone-screen">
          <div className="phone-topline">
            <div>
              <small>Thursday, 1 October</small>
              <strong>Welcome back, Tendai</strong>
            </div>
            <span className="phone-avatar">T</span>
          </div>
          <p className="phone-section-title">Today’s Overview</p>
          <div className="stat-grid">
            {[
              ['12', 'Active Listings', Building2],
              ['8', 'Active Leads', Users],
            ].map(([value, label, Icon], index) => (
              <motion.div
                className="stat-card"
                key={label as string}
                initial={{ opacity: 0, y: 22, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...SNAP, delay: 0.42 + index * 0.11 }}
              >
                <Icon size={20} />
                <b>{value as string}</b>
                <span>{label as string}</span>
              </motion.div>
            ))}
          </div>
          <p className="phone-section-title phone-section-title--actions">Quick Actions</p>
          <div className="action-grid">
            <motion.div
              className="action-card action-card--green"
              initial={{ opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: [0.75, 1.08, 1] }}
              exit={{ scale: 3.1, x: '-18vw', y: '-2vh', opacity: [1, 1, 0], filter: ['blur(0px)', 'blur(2px)', 'blur(14px)'] }}
              transition={{ duration: 0.58, delay: 0.02, ease: EASE }}
            >
              <Plus size={18} /><span>New Listing</span>
            </motion.div>
            <motion.div
              className="action-card"
              initial={{ opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: [0.75, 1.07, 1] }}
              transition={{ ...SNAP, delay: 0.64 }}
            >
              <Share2 size={18} /><span>Share Brochure</span>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
}

export function ListingScene() {
  const [word, setWord] = useState(0);
  const [matches, setMatches] = useState(1);
  useSceneTimer([
    { time: 580, callback: () => setWord(1) },
    { time: 1080, callback: () => setWord(2) },
    { time: 1180, callback: () => setMatches(2) },
    { time: 1400, callback: () => setMatches(3) },
  ]);
  const words = ['LIST.', 'MATCH.', 'MOVE.'];

  return (
    <motion.section
      className="film-scene scene-listing"
      initial={{ clipPath: 'polygon(0 0, 100% 0, 72% 100%, 0 100%)' }}
      animate={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.48, ease: EASE }}
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={word}
          className="outline-word"
          initial={{ opacity: 0, scale: 1.28, filter: 'blur(10px)' }}
          animate={{ opacity: 0.58, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.78, filter: 'blur(8px)' }}
          transition={{ duration: 0.27, ease: EASE }}
        >
          {words[word]}
        </motion.div>
      </AnimatePresence>
      <motion.div
        className="listing-plane"
        initial={{ scale: 1.5, rotate: -8, filter: 'blur(10px)' }}
        animate={{ scale: 1, rotate: [ -8, -4, 1 ], filter: 'blur(0px)' }}
        exit={{ scale: 2.6, x: '-7vw', rotate: 0, opacity: [1, 1, 0], filter: ['blur(0px)', 'blur(2px)', 'blur(14px)'] }}
        transition={{ duration: 0.78, ease: EASE }}
      >
        <motion.div className="listing-image" initial={{ clipPath: 'inset(100% 0 0 0)' }} animate={{ clipPath: 'inset(0% 0 0 0)' }} transition={{ delay: 0.3, duration: 0.5, ease: EASE }}>
          <HouseArtwork />
          <StatusPill green>PUBLISHED</StatusPill>
        </motion.div>
        <div className="listing-details">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.35 }}>
            <small>Borrowdale · Harare</small>
            <h2>US$285,000</h2>
          </motion.div>
          <div className="feature-row">
            {[
              [BedDouble, '4 beds'],
              [Bath, '3 baths'],
              [Building2, 'Borehole'],
            ].map(([Icon, label], index) => (
              <motion.span key={label as string} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.84 + index * 0.13, duration: 0.3 }}>
                <Icon size={18} /> {label as string}
              </motion.span>
            ))}
          </div>
        </div>
      </motion.div>
      <svg className="match-path" viewBox="0 0 420 180" preserveAspectRatio="none">
        <motion.path d="M10 145 C150 145, 220 25, 410 35" fill="none" stroke="#8fd2bd" strokeWidth="3" strokeDasharray="9 11" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.0, duration: 0.62, ease: EASE }} />
      </svg>
      <motion.div className="match-badge" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 2.5, x: '-26vw', y: '8vh' }} transition={{ ...SNAP, delay: 1.05 }}>
        <Users size={25} />
        <strong>{matches}</strong>
        <span>buyer matches</span>
      </motion.div>
    </motion.section>
  );
}

export function ShareScene() {
  return (
    <motion.section
      className="film-scene scene-share"
      initial={{ clipPath: 'circle(16% at 68% 30%)' }}
      animate={{ clipPath: 'circle(115% at 50% 50%)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.58, ease: EASE }}
    >
      <motion.div className="share-ring" initial={{ scale: 0.4, opacity: 0.7 }} animate={{ scale: 1.15, opacity: 0 }} transition={{ duration: 0.8, ease: EASE }} />
      <motion.h2 className="share-word share-word--top" initial={{ y: '110%' }} animate={{ y: 0 }} exit={{ scaleX: 0.2, opacity: 0 }} transition={{ delay: 0.15, duration: 0.42, ease: EASE }}>SHARE</motion.h2>
      <motion.h2 className="share-word share-word--bottom" initial={{ y: '-110%' }} animate={{ y: 0 }} exit={{ scaleX: 0.2, opacity: 0 }} transition={{ delay: 0.5, duration: 0.42, ease: EASE }}>BEAUTIFULLY.</motion.h2>
      <motion.div className="brochure-shadow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div
        className="brochure-card"
        initial={{ scale: 1.42, filter: 'blur(10px)', opacity: 0.72 }}
        animate={{ scale: 1, filter: 'blur(0px)', opacity: 1 }}
        exit={{ scale: 1.18, opacity: 0 }}
        transition={{ duration: 0.64, ease: EASE }}
      >
        <motion.div className="brochure-image" initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)' }} transition={{ delay: 0.55, duration: 0.4, ease: EASE }}>
          <HouseArtwork />
        </motion.div>
        <motion.div className="brochure-info" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.78, duration: 0.35 }}>
          <small>EXCLUSIVE MANDATE</small>
          <h3>Borrowdale<br />Residence</h3>
          <b>US$285,000</b>
        </motion.div>
        <motion.div className="brochure-brand" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 12, scaleX: 2.2 }} transition={{ delay: 0.92, duration: 0.38, ease: EASE }}>
          <span>QuickProp</span>
          <motion.em initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.55 }}>Ready to share <Check size={15} /></motion.em>
        </motion.div>
      </motion.div>
      <div className="share-chips">
        {([
          [MessageCircle, 'WhatsApp', -150, -70],
          [Facebook, 'Facebook', 155, -28],
          [Linkedin, 'LinkedIn', 145, 74],
        ] as Array<[LucideIcon, string, number, number]>).map(([Icon, label, x, y], index) => (
          <motion.div className="share-chip" key={label as string} initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }} animate={{ opacity: 1, x: `${x}px`, y: `${y}px`, scale: 1 }} exit={{ x: 0, y: 0, opacity: 0 }} transition={{ ...SNAP, delay: 1.05 + index * 0.19 }}>
            <Icon size={18} /><span>{label as string}</span>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

export function BrandScene() {
  const [word, setWord] = useState(0);
  const [lockup, setLockup] = useState(false);
  useSceneTimer([
    { time: 280, callback: () => setWord(1) },
    { time: 620, callback: () => setWord(2) },
    { time: 930, callback: () => setLockup(true) },
  ]);
  const words = ['LIST.', 'CONNECT.', 'CLOSE.'];

  return (
    <motion.section className={`film-scene scene-brand ${lockup ? 'scene-brand--lockup' : ''}`} initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <AnimatePresence mode="sync">
        {!lockup && (
          <motion.div key={word} className="finale-word" initial={{ opacity: 0, scale: 1.55, filter: 'blur(12px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, scale: 0.65, filter: 'blur(10px)' }} transition={{ duration: 0.26, ease: EASE }}>
            {words[word]}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div className="white-aperture" initial={{ scale: 0 }} animate={{ scale: lockup ? 18 : 0 }} transition={{ duration: 0.42, ease: EASE }} />
      <motion.div className="brand-lockup" initial={{ opacity: 0, scale: 1.12 }} animate={{ opacity: lockup ? 1 : 0, scale: lockup ? 1 : 1.12 }} transition={{ delay: lockup ? 0.15 : 0, duration: 0.4, ease: EASE }}>
        <img src={logo} alt="QuickProp" />
        <motion.div className="brand-rule" initial={{ scaleX: 0 }} animate={{ scaleX: lockup ? 1 : 0 }} transition={{ delay: 0.36, duration: 0.42, ease: EASE }}>
          <motion.i animate={{ x: lockup ? ['0vw', '0vw', '-34vw'] : 0 }} transition={{ delay: 0.85, duration: 0.42, times: [0, 0.3, 1], ease: EASE }} />
        </motion.div>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: lockup ? 1 : 0, y: lockup ? 0 : 10 }} transition={{ delay: 0.52, duration: 0.3 }}>Property, moving forward.</motion.p>
      </motion.div>
    </motion.section>
  );
}