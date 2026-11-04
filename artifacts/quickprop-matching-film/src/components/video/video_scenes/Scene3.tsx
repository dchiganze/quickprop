import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

export function Scene3() {
  return (
    <motion.section
      className="film"
      style={{ backgroundColor: '#173F36', color: '#F5F4ED' }}
      initial={{ clipPath: 'circle(0% at 78% 48%)', scale: 1.08 }}
      animate={{ clipPath: 'circle(150% at 78% 48%)', scale: 1 }}
      exit={{ scale: 1.08, rotateY: -3, opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
      transition={{ duration: 0.42, ease: EASE }}
    >
      <motion.div
        style={{ position: 'absolute', left: '82%', top: '23%', width: '7vmin', height: '7vmin', borderRadius: '50%', background: '#D5EC79', border: '.65vmin solid #2C6D5D', zIndex: 3 }}
        initial={{ scale: 0, x: '-50%', y: '-50%' }}
        animate={{ scale: [0, 1.15, 1], x: '-50%', y: '-50%' }}
        transition={{ duration: 0.35, ease: EASE }}
      />
      <div style={{ position: 'absolute', inset: '8% 9%' }}>
        <motion.div
          className="film-label"
          style={{ color: '#D5EC79', position: 'absolute', left: 0, top: 0, fontSize: '2vmin' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.08 }}
        >
          COLLABORATION REQUEST
        </motion.div>

        <motion.div
          style={{ position: 'absolute', left: '9%', top: '18%', width: '82%', height: '68%', borderRadius: '2.5vmin', padding: '4vmin 5vmin', color: '#17362F', background: '#F5F4ED', boxShadow: '0 3vmin 8vmin rgba(2,20,15,.3)', transformOrigin: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          initial={{ opacity: 0, scale: 0.84, rotateY: 10, y: 10 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12, ease: EASE }}
        >
          <div style={{ color: '#71857B', fontSize: '2vmin', fontWeight: 800, letterSpacing: '.12em' }}>PROPERTY OWNER REVIEW</div>
          <div style={{ marginTop: '1.2vmin', fontSize: '5.2vmin', lineHeight: 1, fontWeight: 800, letterSpacing: '-.065em' }}>BORROWDALE · 3-BED</div>
          <div style={{ marginTop: '1.1vmin', color: '#64776E', fontSize: '2.8vmin', fontWeight: 600 }}>An agent wants to collaborate.</div>

          <div style={{ display: 'flex', gap: '2.3vmin', marginTop: '3vmin' }}>
            <motion.div
              style={{ position: 'relative', flex: 1, minHeight: '11vmin', borderRadius: '1.4vmin', background: '#2C6D5D', color: '#F8F8F1', display: 'grid', placeItems: 'center', fontSize: '3.4vmin', lineHeight: 1, fontWeight: 800, letterSpacing: '.03em', overflow: 'hidden' }}
              initial={{ opacity: 0, scale: 0.93, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.72, ease: EASE }}
            >
              <span>ACCEPT</span>
              <motion.span
                style={{ position: 'absolute', inset: '-10%', border: '.55vmin solid #D5EC79', borderRadius: '1.6vmin', pointerEvents: 'none' }}
                initial={{ scale: 0.82, opacity: 0 }}
                animate={{ scale: [0.82, 1.18, 1.18], opacity: [0, 1, 0] }}
                transition={{ duration: 0.6, delay: 1.17, ease: EASE }}
              />
              <motion.span
                style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#D5EC79', color: '#17362F', fontSize: '3vmin', letterSpacing: '.08em' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 1, 1] }}
                transition={{ duration: 0.54, delay: 1.35, times: [0, 0.22, 0.44, 1], ease: 'linear' }}
              >
                ACCEPTED
              </motion.span>
            </motion.div>

            <motion.div
              style={{ flex: 1, minHeight: '11vmin', borderRadius: '1.4vmin', background: '#E7ECE5', border: '1px solid rgba(23,54,47,.14)', color: '#42594E', display: 'grid', placeItems: 'center', fontSize: '3.4vmin', fontWeight: 800, letterSpacing: '.03em' }}
              initial={{ opacity: 0, scale: 0.93, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.84, ease: EASE }}
            >
              DECLINE
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="film-label"
          style={{ position: 'absolute', right: '1%', bottom: '0%', color: '#BCD0C2', fontSize: '1.8vmin' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.05, duration: 0.24 }}
        >
          THE LISTING OWNER DECIDES
        </motion.div>
      </div>
    </motion.section>
  );
}
