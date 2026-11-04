import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

export function Scene2() {
  return (
    <motion.section
      className="film"
      style={{ backgroundColor: '#E8EEE6', color: '#17362F' }}
      initial={{ clipPath: 'inset(0 0 0 100%)', opacity: 1 }}
      animate={{ clipPath: 'inset(0 0 0 0%)', opacity: 1 }}
      exit={{ scale: 1.08, rotateY: 4, opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
      transition={{ duration: 0.34, ease: EASE }}
    >
      <div style={{ position: 'absolute', inset: '9% 7%' }}>
        <motion.div
          className="film-label"
          style={{ position: 'absolute', left: 0, top: 0, color: '#2C6D5D', fontSize: '2vmin' }}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, delay: 0.08 }}
        >
          ANOTHER AGENT SPOTS A FIT
        </motion.div>

        <motion.div
          style={{ position: 'absolute', left: '0%', top: '15%', width: '57%', height: '74%', borderRadius: '2.2vmin', overflow: 'hidden', background: '#FBFBF6', border: '1px solid rgba(44,109,93,.17)', boxShadow: '0 2.7vmin 6vmin rgba(23,54,47,.14)', transformOrigin: 'center' }}
          initial={{ opacity: 0, scale: 0.88, rotateY: 12, x: -10 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0, x: 0 }}
          transition={{ duration: 0.48, delay: 0.12, ease: EASE }}
        >
          <div style={{ position: 'relative', height: '52%', overflow: 'hidden', background: 'linear-gradient(140deg, #CAD9CE, #91AA9C 60%, #708F80)' }}>
            <div style={{ position: 'absolute', left: '-5%', bottom: '-59%', width: '63%', height: '130%', borderRadius: '50% 50% 0 0', background: '#F1F0E8', transform: 'rotate(-9deg)' }} />
            <div style={{ position: 'absolute', right: '-8%', bottom: '-43%', width: '65%', height: '113%', borderRadius: '50% 50% 0 0', background: '#DCE6DB', transform: 'rotate(8deg)' }} />
            <div style={{ position: 'absolute', right: '11%', top: '12%', width: '13vmin', height: '13vmin', borderRadius: '50%', background: 'rgba(245,244,237,.34)' }} />
            <div className="film-label" style={{ position: 'absolute', left: '5%', top: '10%', color: '#FBFBF6', fontSize: '1.8vmin' }}>FOR SALE</div>
            <motion.div
              style={{ position: 'absolute', left: '69%', top: '61%', width: '5.2vmin', height: '5.2vmin', borderRadius: '50%', background: '#D5EC79', border: '.55vmin solid #2C6D5D' }}
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.15, 1] }}
              transition={{ delay: 0.44, duration: 0.32, ease: EASE }}
            />
          </div>
          <div style={{ padding: '2.4vmin 3vmin' }}>
            <div style={{ color: '#2C6D5D', fontSize: '2vmin', fontWeight: 800, letterSpacing: '.12em' }}>3-BED HOME</div>
            <div style={{ fontSize: '4.2vmin', lineHeight: 1.05, fontWeight: 800, letterSpacing: '-.06em', marginTop: '.8vmin' }}>BORROWDALE</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.5vmin', marginTop: '1.1vmin' }}>
              <span style={{ fontSize: '3.1vmin', fontWeight: 800, color: '#315D4E' }}>USD 248,000</span>
              <span style={{ fontSize: '2vmin', color: '#71857B', fontWeight: 600 }}>Illustrative listing</span>
            </div>
          </div>
          <motion.div
            style={{ position: 'absolute', left: '69%', top: '61%', width: '5.2vmin', height: '5.2vmin', borderRadius: '50%', border: '.55vmin solid #2C6D5D', pointerEvents: 'none' }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.65], opacity: [0.6, 0] }}
            transition={{ delay: 0.7, duration: 0.46, ease: 'easeOut' }}
          />
        </motion.div>

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: '16% 0 8%', width: '100%', height: '76%', overflow: 'visible', pointerEvents: 'none' }} aria-hidden="true">
          <motion.path d="M 55 39 C 65 32 63 58 76 54" fill="none" stroke="#2C6D5D" strokeWidth=".45" strokeDasharray="1.3 1.1" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: .85 }} transition={{ delay: .48, duration: .48, ease: 'easeInOut' }} />
        </svg>

        <motion.div
          style={{ position: 'absolute', right: '0%', top: '24%', width: '36%', minHeight: '50%', borderRadius: '2vmin', background: '#FBFBF6', border: '1px solid rgba(44,109,93,.16)', boxShadow: '0 2vmin 5vmin rgba(23,54,47,.12)', padding: '3vmin 2.7vmin', display: 'flex', flexDirection: 'column', justifyContent: 'center', transformOrigin: 'left center' }}
          initial={{ opacity: 0, scale: 0.88, rotateY: -10, x: 10 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0, x: 0 }}
          transition={{ duration: 0.42, delay: 0.52, ease: EASE }}
        >
          <div className="film-label" style={{ color: '#71857B', fontSize: '1.8vmin' }}>YOUR CHOICE TO ASK</div>
          <div style={{ marginTop: '1.5vmin', color: '#17362F', fontSize: '3.8vmin', lineHeight: 1.06, fontWeight: 800, letterSpacing: '-.06em' }}>REQUEST<br />COLLABORATION</div>
          <motion.div
            style={{ marginTop: '2.2vmin', padding: '1.25vmin 1.5vmin', borderRadius: '1.1vmin', background: '#2C6D5D', color: '#F8F8F1', textAlign: 'center', fontSize: '2.1vmin', fontWeight: 800, letterSpacing: '.04em' }}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: [0.85, 1.04, 1], opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.35, ease: EASE }}
          >
            SEND A REQUEST
          </motion.div>
        </motion.div>

        <motion.div
          style={{ position: 'absolute', right: '1%', bottom: '0%', fontSize: '2vmin', fontWeight: 700, color: '#71857B', letterSpacing: '.04em' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.04, duration: 0.25 }}
        >
          A MATCH OPENS A POSSIBILITY.
        </motion.div>
      </div>
    </motion.section>
  );
}
