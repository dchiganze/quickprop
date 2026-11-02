import { motion } from 'framer-motion';

const chips = [
  { label: 'USD 250K', x: '13%', y: '29%', delay: 0.14, icon: '$' },
  { label: 'Borrowdale', x: '56%', y: '19%', delay: 0.49, icon: '⌖' },
  { label: 'Cash', x: '69%', y: '64%', delay: 0.86, icon: '◈' },
  { label: 'Immediate', x: '25%', y: '70%', delay: 1.18, icon: '↗' },
];

export function Scene1() {
  return (
    <motion.section
      className="film"
      style={{ backgroundColor: '#F5F4ED' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ scale: 1.12, opacity: 0, clipPath: 'inset(0 0 0 100%)' }}
      transition={{ duration: 0.32, ease: [0.7, 0, 0.2, 1] }}
    >
      <div style={{ position: 'absolute', inset: '6% 7%' }}>
        <motion.div
          className="film-label"
          style={{ position: 'absolute', left: '0%', top: '2%', color: '#2C6D5D' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38 }}
        >
          BUYER INTENT
        </motion.div>
        <div style={{ position: 'absolute', left: '3%', top: '19%', width: '57vmin', height: '57vmin' }}>
          <motion.div
            style={{
              position: 'absolute', inset: '8%', borderRadius: '50%',
              background: 'radial-gradient(circle at 38% 36%, #FFFFFF 0%, #E8EEE6 66%, #DCE7DF 100%)',
              boxShadow: '0 3vmin 8vmin rgba(34,84,69,.12)',
            }}
            initial={{ scale: 0.77, rotate: -7 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            style={{
              position: 'absolute', left: '47%', top: '44%', width: '7vmin', height: '7vmin',
              border: '1.1vmin solid #2C6D5D', borderRadius: '50%',
              background: '#D5EC79', boxShadow: '0 0 0 1.3vmin rgba(44,109,93,.11)',
            }}
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 1.18, 1], opacity: 1 }}
            transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            style={{ position: 'absolute', inset: '18%', border: '1px solid rgba(44,109,93,.18)', borderRadius: '50%' }}
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: [1.08, 1.34], opacity: [0.65, 0] }}
            transition={{ duration: 1.05, delay: 0.25, repeat: 1, ease: 'easeOut' }}
          />
        </div>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: '10% 5%', width: '90%', height: '79%', overflow: 'visible' }}
          aria-hidden="true"
        >
          <motion.path
            d="M 50 48 C 37 35 31 34 23 30 M 52 45 C 57 34 62 29 69 22 M 54 52 C 61 55 67 59 75 66 M 47 56 C 39 64 34 70 29 74"
            fill="none" stroke="#6E9C87" strokeWidth="0.28" strokeDasharray="1.4 1.6"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.7 }}
            transition={{ duration: 0.62, delay: 0.43, ease: 'easeInOut' }}
          />
        </svg>
        {chips.map((chip) => (
          <motion.div
            key={chip.label}
            className="chip"
            style={{ position: 'absolute', left: chip.x, top: chip.y, zIndex: 2 }}
            initial={{ opacity: 0, scale: 0.78, y: 12, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 330, damping: 22, delay: chip.delay }}
          >
            <span style={{ color: '#2C6D5D', fontWeight: 800 }}>{chip.icon}</span>
            {chip.label}
          </motion.div>
        ))}
        <motion.div
          className="film-label"
          style={{ position: 'absolute', right: '3%', bottom: '7%', color: '#91A198', fontSize: '1.2vmin' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.01, duration: 0.25 }}
        >
          ILLUSTRATIVE PROFILE
        </motion.div>
        <motion.div
          style={{
            position: 'absolute', right: '6%', top: '22%', width: '18vmin', height: '18vmin',
            borderRadius: '50%', border: '1px solid rgba(44,109,93,.12)',
          }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />
      </div>
    </motion.section>
  );
}
