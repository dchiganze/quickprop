import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

export function Scene4() {
  return (
    <motion.section
      className="film"
      style={{ backgroundColor: '#F5F4ED', color: '#17362F' }}
      initial={{ clipPath: 'inset(0 0 0 100%)', opacity: 1 }}
      animate={{ clipPath: 'inset(0 0 0 0%)', opacity: 1 }}
      exit={{ scale: 0.94, rotateY: 4, opacity: 0, clipPath: 'inset(0 0 0 100%)' }}
      transition={{ duration: 0.38, ease: EASE }}
    >
      <div style={{ position: 'absolute', inset: '8% 7%' }}>
        <motion.div
          style={{ position: 'absolute', left: '0%', top: '8%', width: '36%', height: '76%', borderRadius: '2.2vmin', background: '#E6EEE5', border: '1px solid rgba(44,109,93,.17)', padding: '3.2vmin', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 2vmin 5vmin rgba(23,54,47,.09)', transformOrigin: 'left center' }}
          initial={{ opacity: 0, scale: 0.9, rotateY: -8, x: -10 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0, x: 0 }}
          transition={{ duration: 0.42, delay: 0.1, ease: EASE }}
        >
          <motion.div style={{ width: '6vmin', height: '6vmin', borderRadius: '50%', background: '#D5EC79', border: '.6vmin solid #2C6D5D', marginBottom: '1.8vmin' }} initial={{ scale: 0 }} animate={{ scale: [0, 1.15, 1] }} transition={{ duration: .32, delay: .12, ease: EASE }} />
          <div className="film-label" style={{ color: '#2C6D5D', fontSize: '1.9vmin' }}>ACCEPTED · CONTACT UNLOCKED</div>
          <div style={{ marginTop: '1.7vmin', fontSize: '3vmin', lineHeight: 1.12, fontWeight: 800, letterSpacing: '-.04em' }}>Reach each other directly.</div>
          <div style={{ display: 'flex', gap: '1vmin', marginTop: '2.4vmin' }}>
            <div style={{ borderRadius: '99px', padding: '1vmin 1.5vmin', background: '#2C6D5D', color: '#F8F8F1', fontSize: '2vmin', fontWeight: 800, letterSpacing: '.04em' }}>CALL</div>
            <div style={{ borderRadius: '99px', padding: '1vmin 1.5vmin', background: '#D5EC79', color: '#17362F', fontSize: '2vmin', fontWeight: 800, letterSpacing: '.04em' }}>WHATSAPP</div>
          </div>
        </motion.div>

        <motion.div
          style={{ position: 'absolute', left: '42%', top: '10%', width: '54%', height: '61%', borderRadius: '2vmin', border: '1px solid rgba(44,109,93,.14)', background: '#FBFBF6', boxShadow: '0 2vmin 5vmin rgba(23,54,47,.10)', padding: '2.8vmin 3vmin', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          initial={{ opacity: 0, scale: 0.9, rotateY: 9, x: 8 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0, x: 0 }}
          transition={{ duration: 0.43, delay: 0.18, ease: EASE }}
        >
          <div className="film-label" style={{ color: '#789184', fontSize: '1.85vmin' }}>AGENT-TO-AGENT</div>
          <motion.div
            style={{ alignSelf: 'flex-start', maxWidth: '82%', marginTop: '1.7vmin', padding: '1.5vmin 2vmin', borderRadius: '1.5vmin 1.5vmin 1.5vmin .35vmin', background: '#E8EEE6', color: '#315D4E', fontSize: '2.7vmin', lineHeight: 1.12, fontWeight: 700 }}
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.48, ease: EASE }}
          >
            Let’s arrange a viewing.
          </motion.div>
          <motion.div
            style={{ alignSelf: 'flex-end', maxWidth: '88%', marginTop: '1.4vmin', padding: '1.5vmin 2vmin', borderRadius: '1.5vmin 1.5vmin .35vmin 1.5vmin', background: '#2C6D5D', color: '#F8F8F1', fontSize: '2.7vmin', lineHeight: 1.12, fontWeight: 700 }}
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.87, ease: EASE }}
          >
            I’ll coordinate with the buyer.
          </motion.div>
        </motion.div>

        <motion.div
          style={{ position: 'absolute', left: '42%', right: '0%', bottom: '3%', textAlign: 'center', color: '#17362F', fontSize: '3.8vmin', lineHeight: 1.05, fontWeight: 800, letterSpacing: '-.055em' }}
          initial={{ opacity: 0, y: 9 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, delay: 1.22, ease: EASE }}
        >
          THE AGENTS DECIDE THE NEXT STEPS.
        </motion.div>
        <motion.div
          style={{ position: 'absolute', left: '50%', top: '49%', width: '96vmin', height: '96vmin', borderRadius: '50%', background: '#2C6D5D', zIndex: 5, pointerEvents: 'none' }}
          initial={{ scale: 0, x: '-50%', y: '-50%' }}
          animate={{ scale: 2.3, x: '-50%', y: '-50%' }}
          transition={{ duration: 0.38, delay: 2.62, ease: EASE }}
        />
        <motion.div
          style={{ position: 'absolute', left: '50%', top: '49%', width: '96vmin', height: '96vmin', borderRadius: '50%', background: '#F5F4ED', zIndex: 6, pointerEvents: 'none' }}
          initial={{ scale: 0.08, x: '-50%', y: '-50%' }}
          animate={{ scale: 1, x: '-50%', y: '-50%' }}
          transition={{ duration: 0.38, delay: 2.62, ease: EASE }}
        />
      </div>
    </motion.section>
  );
}
