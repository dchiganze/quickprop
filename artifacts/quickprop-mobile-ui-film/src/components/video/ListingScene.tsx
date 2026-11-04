import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BedDouble,
  Bath,
  ChevronRight,
  Heart,
  MapPin,
  MoreHorizontal,
  Share2,
} from 'lucide-react';
import { useSceneTimer } from '@/lib/video';
import { PhoneFrame } from './PhoneFrame';

export function ListingScene() {
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [descriptionVisible, setDescriptionVisible] = useState(false);
  const [shareReady, setShareReady] = useState(false);
  const events = useMemo(
    () => [
      { time: 420, callback: () => setDetailsVisible(true) },
      { time: 1180, callback: () => setStatsVisible(true) },
      { time: 1590, callback: () => setDescriptionVisible(true) },
      { time: 2330, callback: () => setShareReady(true) },
    ],
    [],
  );
  useSceneTimer(events);

  return (
    <motion.section
      className="film-scene listing-scene"
      initial={{ opacity: 0, clipPath: 'inset(0 0 0 11%)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
      exit={{ opacity: 0, scale: 1.075, clipPath: 'inset(5% 7% 5% 7%)' }}
      transition={{ duration: 0.42, ease: [0.65, 0, 0.35, 1] }}
    >
      <div className="scene-glow scene-glow-match" />
      <div className="scene-grid" />
      <div className="scene-index index-match">
        <span className="index-number">01</span>
        <span className="index-label">LISTING</span>
      </div>
      <div className="scene-side-note">A PROPERTY, READY TO SHARE</div>

      <AnimatePresence>
        {detailsVisible && (
          <motion.div
            className="listing-fact-card"
            initial={{ opacity: 0, x: -18, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.08 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="listing-fact-kicker">PROPERTY DETAILS</span>
            <strong>3 bedroom home</strong>
            <span><MapPin size={13} /> Avondale, Harare</span>
            <div className="listing-fact-rule" />
            <b>USD 275,000</b>
            <small>Published · For sale</small>
          </motion.div>
        )}
      </AnimatePresence>

      <PhoneFrame>
        <div className="listing-app">
          <header className="listing-app-header">
            <span className="listing-back"><ArrowLeft size={17} /></span>
            <span className="listing-reference">QP-2418</span>
            <span className="listing-icon-button"><Heart size={17} /></span>
            <span className="listing-icon-button"><MoreHorizontal size={18} /></span>
          </header>
          <div className="listing-gallery">
            <div className="listing-house-photo">
              <span className="listing-house-tree tree-left" />
              <span className="listing-house-tree tree-right" />
              <span className="listing-house-ground" />
              <span className="listing-modern-house">
                <i className="house-wing" />
                <i className="house-glass" />
                <i className="house-door" />
              </span>
              <span className="listing-photo-count">1 / 6</span>
            </div>
            <span className="listing-published-badge">Published</span>
          </div>
          <div className="listing-details">
            <div className="listing-type-label">FOR SALE <span /> RESIDENTIAL</div>
            <h1>3 bedroom home</h1>
            <div className="listing-location"><MapPin size={13} /> Avondale, Harare</div>
            <div className="listing-price">USD 275,000</div>
            <motion.div
              className="listing-stats"
              initial={{ opacity: 0, y: 8 }}
              animate={statsVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            >
              <span><BedDouble size={15} /> 3 beds</span>
              <span><Bath size={15} /> 2 baths</span>
              <span>2 garages</span>
            </motion.div>
            <AnimatePresence>
              {descriptionVisible && (
                <motion.div
                  className="listing-description"
                  initial={{ opacity: 0, y: 8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span>ABOUT THIS HOME</span>
                  <p>A light-filled family home with generous living spaces and a private garden.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="listing-share-bar">
            <div className="listing-share-price"><small>ASKING PRICE</small><strong>USD 275,000</strong></div>
            <motion.div
              className={`listing-share-action ${shareReady ? 'listing-share-action-ready' : ''}`}
              animate={shareReady ? { scale: [1, 1.08, 1], x: [0, 0, 12] } : { scale: 1, x: 0 }}
              transition={{ duration: 0.62, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <Share2 size={15} />
              <span>Share</span>
              <ChevronRight size={14} />
            </motion.div>
          </div>
        </div>
      </PhoneFrame>

      <div className="bottom-caption">
        <span className="caption-dot" />
        <span>QUICKPROP AGENT</span>
        <span className="caption-divider" />
        <span>LISTING DETAILS</span>
      </div>
    </motion.section>
  );
}
