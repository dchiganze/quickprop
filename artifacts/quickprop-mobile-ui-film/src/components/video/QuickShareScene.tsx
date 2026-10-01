import { useMemo, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import quickPropLogo from '@assets/quickprop-logo.png';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Instagram,
  Link2,
  MessageCircle,
  Share2,
} from 'lucide-react';
import { useSceneTimer } from '@/lib/video';
import { AppTabBar, PhoneFrame } from './PhoneFrame';

const channels = [
  { name: 'WhatsApp', short: 'WA', className: 'channel-whatsapp', icon: MessageCircle },
  { name: 'Facebook', short: 'f', className: 'channel-facebook', icon: Share2 },
  { name: 'Instagram', short: 'IG', className: 'channel-instagram', icon: Instagram },
  { name: 'LinkedIn', short: 'in', className: 'channel-linkedin', icon: Link2 },
];

const channelStackVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

const phoneChannelGridVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.02 } },
};

export function QuickShareScene() {
  const [previewVisible, setPreviewVisible] = useState(false);
  const [channelsVisible, setChannelsVisible] = useState(false);
  const [highlightShare, setHighlightShare] = useState(false);
  const [handoff, setHandoff] = useState(false);

  const events = useMemo(
    () => [
      { time: 980, callback: () => setPreviewVisible(true) },
      { time: 2050, callback: () => setChannelsVisible(true) },
      { time: 3240, callback: () => setHighlightShare(true) },
      { time: 4360, callback: () => setHandoff(true) },
    ],
    [],
  );
  useSceneTimer(events);

  return (
    <motion.section
      className="film-scene share-scene"
      initial={{ opacity: 0, clipPath: 'inset(42% 0 42% 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
      exit={{ opacity: 0, clipPath: 'inset(0 14% 0 0)' }}
      transition={{ duration: 0.46, ease: [0.65, 0, 0.35, 1] }}
    >
      <div className="scene-glow scene-glow-share" />
      <div className="scene-grid scene-grid-share" />
      <div className="scene-index index-share">
        <span className="index-number">02</span>
        <span className="index-label">QUICKSHARE</span>
      </div>
      <div className="scene-side-note share-side-note">ONE BROCHURE · EVERY CHANNEL</div>

      <AnimatePresence>
        {previewVisible && (
          <motion.div
            className="brochure-preview"
            initial={{ opacity: 0, rotateY: -19, rotateZ: 3, x: -22, scale: 0.92 }}
            animate={{ opacity: 1, rotateY: 0, rotateZ: 1.2, x: 0, scale: 1 }}
            exit={{ opacity: 0, rotateY: 8, scale: 1.05 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="brochure-cover-bar">
              <img className="brochure-brand-logo" src={quickPropLogo} alt="QuickProp" />
              <span>PROPERTY COLLECTION</span>
              <ArrowUpRight size={15} />
            </div>
            <div className="brochure-title">
              <span>MY BROCHURE</span>
              <h2>Tendai’s<br />Listings</h2>
              <p>Borrowdale, Avondale &amp; more</p>
            </div>
            <div className="brochure-image-grid">
              <div className="brochure-house-art brochure-house-art-main">
                <span className="brochure-tree" />
                <span className="brochure-house"><i /><i /><i /></span>
              </div>
              <div className="brochure-house-art brochure-house-art-side">
                <span className="brochure-tree" />
                <span className="brochure-house"><i /><i /></span>
              </div>
            </div>
            <div className="brochure-footer">
              <span><b>12</b> properties</span>
              <span>VIEW COLLECTION <ChevronRight size={12} /></span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="share-channel-stack"
        initial="hidden"
        animate={channelsVisible ? 'visible' : 'hidden'}
        variants={channelStackVariants}
      >
        {channels.map((channel, index) => {
          const Icon = channel.icon;
          return (
            <motion.div
              className={`share-channel-chip ${channel.className} ${highlightShare && index === 0 ? 'channel-chip-highlight' : ''}`}
              key={channel.name}
              variants={{
                hidden: { opacity: 0, y: 18, scale: 0.85 },
                visible: { opacity: 1, y: 0, scale: 1 },
              }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="share-channel-icon">
                <Icon size={16} strokeWidth={2} />
              </span>
              <span>{channel.name}</span>
              {index === 0 && highlightShare && (
                <motion.span
                  className="channel-ready-check"
                  initial={{ scale: 0 }}
                  animate={{
                    scale: handoff ? 2.35 : 1,
                    x: handoff ? 18 : 0,
                    borderRadius: handoff ? 11 : 999,
                  }}
                  transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <Check size={11} strokeWidth={3} />
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      <PhoneFrame>
        <div className="share-app">
          <div className="share-underlay">
            <div className="underlay-heading">
              <span>Good morning, Tendai</span>
              <strong>My listings</strong>
            </div>
            <div className="underlay-stats">
              <span>12 active listings</span>
              <span>View all</span>
            </div>
            <div className="underlay-property-row">
              <div className="underlay-thumb" />
              <div><strong>Borrowdale family home</strong><span>4 beds · For sale</span></div>
            </div>
          </div>
          <div className="share-scrim" />
          <div className="quickshare-sheet">
            <div className="sheet-handle" />
            <div className="quickshare-title-row">
              <div>
                <span className="sheet-eyebrow">QUICKPROP AGENT</span>
                <h1>QuickShare</h1>
              </div>
              <div className="sheet-share-symbol"><Share2 size={17} /></div>
            </div>
            <div className="share-scope-options">
              <div className="scope-option scope-selected">
                <span className="scope-radio"><span /></span>
                <span><strong>My Brochure</strong><small>Your listings only</small></span>
                <motion.span
                  className="scope-selection-outline"
                  animate={
                    handoff
                      ? { scale: 1.55, x: -3, opacity: 0.85, borderRadius: 18 }
                      : { scale: 1, x: 0, opacity: 0.25, borderRadius: 15 }
                  }
                  transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>
              <div className="scope-option">
                <span className="scope-radio" />
                <span><strong>Company</strong><small>All agency listings</small></span>
              </div>
            </div>
            <AnimatePresence>
              {previewVisible && (
                <motion.div
                  className="phone-brochure-preview"
                  initial={{ opacity: 0, y: 16, clipPath: 'inset(0 0 100% 0)' }}
                  animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="phone-preview-head">
                  <div className="phone-preview-icon">
                    <img className="phone-preview-logo" src={quickPropLogo} alt="QuickProp" />
                  </div>
                    <div>
                      <strong>Tendai’s Listings</strong>
                      <span>Borrowdale, Avondale &amp; more</span>
                    </div>
                    <ChevronRight size={15} />
                  </div>
                  <div className="phone-preview-stats">
                    <span><b>12</b> properties</span>
                    <span className="preview-availability"><i /> All details ready</span>
                  </div>
                  <div className="phone-preview-list">
                    <span>4-bed · Borrowdale</span>
                    <span>3-bed · Avondale</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="share-via-label">
              <span>SHARE VIA</span>
              <span className="share-via-rule" />
            </div>
            <motion.div
              className="phone-channel-grid"
              initial="hidden"
              animate={channelsVisible ? 'visible' : 'hidden'}
              variants={phoneChannelGridVariants}
            >
              {channels.map((channel, index) => {
                const Icon = channel.icon;
                return (
                  <motion.div
                    className={`phone-channel ${channel.className} ${highlightShare && index === 0 ? 'phone-channel-highlight' : ''}`}
                    key={channel.name}
                    variants={{
                      hidden: { opacity: 0, y: 12, scale: 0.9 },
                      visible: { opacity: 1, y: 0, scale: 1 },
                    }}
                    transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="phone-channel-icon">
                      <Icon size={16} strokeWidth={2} />
                    </span>
                    <span>{channel.name}</span>
                    {index === 0 && highlightShare && (
                      <motion.span
                        className="phone-channel-ready"
                        animate={
                          handoff
                            ? { scale: 1.9, x: 5, y: -4, borderRadius: 10 }
                            : { scale: 1, x: 0, y: 0, borderRadius: 999 }
                        }
                        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                      >
                        <Check size={9} strokeWidth={3} />
                      </motion.span>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
            <div className="more-share-options">
              <Copy size={14} />
              <span>More sharing options</span>
              <ChevronRight size={14} />
            </div>
            <AppTabBar active="share" />
          </div>
        </div>
      </PhoneFrame>

      <div className="share-bottom-caption">
        <span>CATALOGUE PREVIEW</span>
        <span className="caption-divider" />
        <span>READY WHEN YOU ARE</span>
      </div>
    </motion.section>
  );
}