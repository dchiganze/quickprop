import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

export function Scene1() {
  return (
    <motion.section
      className="film"
      style={{ backgroundColor: '#F5F4ED', color: '#17362F' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ scale: 1.05, rotateY: -3, opacity: 0, clipPath: 'inset(0 0 0 100%)' }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <motion.div
        style={{ position: 'absolute', left: '50%', top: '53%', width: '5.2vmin', height: '5.2vmin', borderRadius: '50%', background: '#D5EC79', border: '.65vmin solid #2C6D5D', zIndex: 4 }}
        initial={{ scale: 0, x: '-50%', y: '-50%' }}
        animate={{ scale: [0, 1.16, 1], x: '-50%', y: '-50%' }}
        transition={{ duration: 0.34, ease: EASE }}
      />
      <div style={{ position: 'absolute', inset: '7% 7% 8%' }}>
        <motion.div
          className="film-label"
          style={{ color: '#2C6D5D', position: 'absolute', left: 0, top: 0, fontSize: '2vmin' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.08 }}
        >
          LISTING OWNER · IN CONTROL
        </motion.div>
        <motion.div
          style={{ position: 'absolute', left: 0, right: 0, top: '13%', textAlign: 'center', fontSize: '7.2vmin', lineHeight: 0.96, letterSpacing: '-.075em', fontWeight: 800 }}
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.12, ease: EASE }}
        >
          THE OWNER CHOOSES
        </motion.div>

        <motion.div
          style={{ position: 'absolute', left: '1%', bottom: '6%', width: '47%', height: '54%', borderRadius: '2.2vmin', background: '#E5EEE5', border: '1px solid rgba(44,109,93,.20)', padding: '3.3vmin 3.5vmin', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 2vmin 5vmin rgba(23,54,47,.08)' }}
          initial={{ opacity: 0, scale: 0.88, rotate: -2, x: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0, x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.24 }}
        >
          <div style={{ color: '#2C6D5D', fontSize: '4.2vmin', lineHeight: 1, fontWeight: 800, letterSpacing: '-.055em' }}>OPEN TO REQUESTS</div>
          <div style={{ marginTop: '1.65vmin', color: '#526C5F', fontSize: '2.8vmin', lineHeight: 1.22, fontWeight: 600 }}>Other agents may ask to collaborate.</div>
          <div style={{ position: 'absolute', right: '4%', top: '12%', width: '3.5vmin', height: '3.5vmin', borderRadius: '50%', background: '#D5EC79', border: '.45vmin solid #2C6D5D' }} />
        </motion.div>

        <motion.div
          style={{ position: 'absolute', right: '1%', bottom: '6%', width: '47%', height: '54%', borderRadius: '2.2vmin', background: '#FBFBF6', border: '1px solid rgba(44,109,93,.16)', padding: '3.3vmin 3.5vmin', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 2vmin 5vmin rgba(23,54,47,.08)' }}
          initial={{ opacity: 0, scale: 0.88, rotate: 2, x: 8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0, x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.63 }}
        >
          <div style={{ color: '#17362F', fontSize: '4.2vmin', lineHeight: 1, fontWeight: 800, letterSpacing: '-.055em' }}>KEEP IT PRIVATE</div>
          <div style={{ marginTop: '1.65vmin', color: '#64776E', fontSize: '2.8vmin', lineHeight: 1.22, fontWeight: 600 }}>Only your agency can access it.</div>
          <div style={{ position: 'absolute', right: '4%', top: '12%', width: '2.8vmin', height: '2.8vmin', border: '.4vmin solid #789184', borderRadius: '50%' }} />
        </motion.div>
        <motion.div
          style={{ position: 'absolute', left: '50%', top: '48%', width: '7vmin', height: '7vmin', border: '1px solid rgba(44,109,93,.25)', borderRadius: '50%', zIndex: 3 }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: [0.5, 1.1, 1], opacity: [0, 0.7, 0.25] }}
          transition={{ duration: 0.75, delay: 0.95, ease: EASE }}
        />
      </div>
    </motion.section>
  );
}
