import { motion } from 'framer-motion';
import quickPropLogo from '@assets/quickprop-logo.png';

export function Scene5() {
  return (
    <motion.section
      className="film"
      style={{ backgroundColor: '#2C6D5D' }}
      initial={{ clipPath: 'inset(0 0 0 100%)', opacity: 1 }}
      animate={{ clipPath: 'inset(0 0 0 0%)', opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: .34, ease: [0.72, 0, .25, 1] }}
    >
      <motion.div
        style={{ position: 'absolute', left: '50%', top: '50%', width: '63vmin', height: '63vmin', borderRadius: '50%', background: '#F5F4ED', boxShadow: '0 2vmin 9vmin rgba(14,46,37,.2)' }}
        initial={{ scale: .1, x: '-50%', y: '-50%' }}
        animate={{ scale: [0.1, 1, 1, 2.8], x: '-50%', y: '-50%' }}
        transition={{ duration: 2.5, times: [0, .22, .78, 1], ease: [0.16, 1, .3, 1] }}
      />
      <motion.div
        style={{ position: 'absolute', left: '50%', top: '41%' }}
        initial={{ opacity: 0, scale: .83, x: '-50%', y: '-50%' }}
        animate={{ opacity: [0, 1, 1, 0], scale: [.83, 1, 1, 3.2], x: '-50%', y: '-50%' }}
        transition={{ duration: 2.5, times: [0, .24, .8, 1], ease: [0.16, 1, .3, 1] }}
      >
        <img className="logo-image" src={quickPropLogo} alt="QuickProp" />
      </motion.div>
      <motion.div
        style={{ position: 'absolute', left: '50%', top: '62%', width: '72%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#173F36', fontSize: '3.25vmin', fontWeight: 700, letterSpacing: '-.055em' }}
        initial={{ opacity: 0, clipPath: 'inset(0 50% 0 50%)' }}
        animate={{ opacity: [0, 1, 1, 0], clipPath: ['inset(0 50% 0 50%)', 'inset(0 0% 0 0%)', 'inset(0 0% 0 0%)', 'inset(0 50% 0 50%)'] }}
        transition={{ duration: 2.5, times: [0, .3, .8, 1], ease: [0.16, 1, .3, 1] }}
      >
        BUYER ↔ PROPERTY MATCHING
      </motion.div>
      <motion.div
        className="film-label"
        style={{ position: 'absolute', left: '50%', top: '72%', transform: 'translateX(-50%)', color: '#648274', fontSize: '1.3vmin' }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, -8] }}
        transition={{ duration: 2.5, times: [0, .32, .79, 1], ease: [0.16, 1, .3, 1] }}
      >
        MATCHES
      </motion.div>
    </motion.section>
  );
}
