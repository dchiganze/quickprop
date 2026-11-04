import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

export function Scene5() {
  return (
    <motion.section
      className="film"
      style={{ backgroundColor: '#2C6D5D' }}
      initial={{ clipPath: 'circle(45% at 50% 53%)', opacity: 1 }}
      animate={{ clipPath: 'circle(150% at 50% 53%)', opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, clipPath: 'circle(0% at 50% 53%)' }}
      transition={{ duration: 0.34, ease: EASE }}
    >
      <motion.div
        style={{ position: 'absolute', left: '50%', top: '49%', width: '96vmin', height: '96vmin', borderRadius: '50%', background: '#F5F4ED', boxShadow: '0 2vmin 8vmin rgba(14,46,37,.18)' }}
        initial={{ scale: 1, x: '-50%', y: '-50%' }}
        animate={{ scale: [1, 1, 3.1], x: '-50%', y: '-50%' }}
        transition={{ duration: 2, times: [0, 0.82, 1], ease: EASE }}
      />
      <motion.div
        style={{ position: 'absolute', left: '50%', top: '39%' }}
        initial={{ opacity: 0, scale: 0.82, x: '-50%', y: '-50%' }}
        animate={{ opacity: [0, 1, 1], scale: [0.82, 1, 1], x: '-50%', y: '-50%' }}
        transition={{ duration: 2, times: [0, 0.22, 1], ease: EASE }}
      >
        <img
          className="logo-image"
          src={`${import.meta.env.BASE_URL}quickprop-logo.svg`}
          alt="QuickProp"
          style={{ width: '43vmin' }}
        />
      </motion.div>
      <motion.div
        style={{ position: 'absolute', left: '50%', top: '63%', width: '70%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#173F36', fontSize: '3.5vmin', lineHeight: 1.08, fontWeight: 800, letterSpacing: '-.055em' }}
        initial={{ opacity: 0, clipPath: 'inset(0 50% 0 50%)' }}
        animate={{ opacity: [0, 1, 1], clipPath: ['inset(0 50% 0 50%)', 'inset(0 0% 0 0%)', 'inset(0 0% 0 0%)'] }}
        transition={{ duration: 2, times: [0, 0.3, 1], ease: EASE }}
      >
        COLLABORATE ON YOUR TERMS
      </motion.div>
    </motion.section>
  );
}
