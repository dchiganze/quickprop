import { motion } from 'framer-motion';
import quickPropLogo from '@assets/quickprop-logo.png';

const EASE = [0.16, 1, 0.3, 1] as const;

export function Scene5() {
  return (
    <motion.section
      className="film"
      style={{ backgroundColor: '#2C6D5D' }}
      initial={{ clipPath: 'inset(0 0 0 100%)', opacity: 1 }}
      animate={{ clipPath: 'inset(0 0 0 0%)', opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, clipPath: 'circle(0% at 50% 53%)' }}
      transition={{ duration: 0.34, ease: EASE }}
    >
      <motion.div
        style={{ position: 'absolute', left: '50%', top: '49%', width: '58vmin', height: '58vmin', borderRadius: '50%', background: '#F5F4ED', boxShadow: '0 2vmin 8vmin rgba(14,46,37,.18)' }}
        initial={{ scale: 0.08, x: '-50%', y: '-50%' }}
        animate={{ scale: [0.08, 1, 1, 3.1], x: '-50%', y: '-50%' }}
        transition={{ duration: 2.5, times: [0, 0.2, 0.81, 1], ease: EASE }}
      />
      <motion.div
        style={{ position: 'absolute', left: '50%', top: '39%' }}
        initial={{ opacity: 0, scale: 0.82, x: '-50%', y: '-50%' }}
        animate={{ opacity: [0, 1, 1], scale: [0.82, 1, 1], x: '-50%', y: '-50%' }}
        transition={{ duration: 2.5, times: [0, 0.2, 1], ease: EASE }}
      >
        <img className="logo-image" src={quickPropLogo} alt="QuickProp" style={{ width: '43vmin' }} />
      </motion.div>
      <motion.div
        style={{ position: 'absolute', left: '50%', top: '62%', width: '76%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#173F36', fontSize: '4vmin', lineHeight: 1, fontWeight: 800, letterSpacing: '-.055em', whiteSpace: 'nowrap' }}
        initial={{ opacity: 0, clipPath: 'inset(0 50% 0 50%)' }}
        animate={{ opacity: [0, 1, 1], clipPath: ['inset(0 50% 0 50%)', 'inset(0 0% 0 0%)', 'inset(0 0% 0 0%)'] }}
        transition={{ duration: 2.5, times: [0, 0.28, 1], ease: EASE }}
      >
        COLLABORATE ON YOUR TERMS
      </motion.div>
      <motion.div
        className="film-label"
        style={{ position: 'absolute', left: '50%', top: '72%', transform: 'translateX(-50%)', color: '#648274', fontSize: '1.9vmin' }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: [0, 1, 1], y: [6, 0, 0] }}
        transition={{ duration: 2.5, times: [0, 0.31, 1], ease: EASE }}
      >
        MATCHES
      </motion.div>
    </motion.section>
  );
}
