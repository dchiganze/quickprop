import { motion } from 'framer-motion';

export function Scene3() {
  return (
    <motion.section
      className="film"
      style={{ backgroundColor: '#173F36' }}
      initial={{ clipPath: 'circle(0% at 78% 47%)', scale: 1.1 }}
      animate={{ clipPath: 'circle(150% at 78% 47%)', scale: 1 }}
      exit={{ scale: 1.12, opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
      transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
    >
      <div style={{ position: 'absolute', inset: '9% 8%' }}>
        <motion.div
          style={{ position: 'absolute', left: '10%', top: '10%', width: '60vmin', height: '60vmin', borderRadius: '50%', border: '1px solid rgba(243,246,234,.16)' }}
          initial={{ scale: .8, rotate: -8, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ duration: .75, ease: [0.16, 1, .3, 1] }}
        />
        <motion.svg
          viewBox="0 0 100 100"
          style={{ position: 'absolute', left: '10%', top: '10%', width: '60vmin', height: '60vmin', transform: 'rotate(-90deg)', overflow: 'visible' }}
          aria-label="94 percent match score"
        >
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(240,244,232,.12)" strokeWidth="2.8" />
          <motion.circle cx="50" cy="50" r="44" fill="none" stroke="#D5EC79" strokeWidth="2.8" strokeLinecap="round" strokeDasharray="276.46" initial={{ strokeDashoffset: 276.46 }} animate={{ strokeDashoffset: 16.59 }} transition={{ duration: .82, delay: .12, ease: [0.2, .8, .2, 1] }} />
          <motion.circle cx="50" cy="50" r="37" fill="none" stroke="rgba(240,244,232,.17)" strokeWidth=".35" strokeDasharray="1 2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .6, duration: .2 }} />
        </motion.svg>
        <motion.div
          style={{ position: 'absolute', left: '17%', top: '31%', width: '45vmin', textAlign: 'center', color: '#F5F4ED' }}
          initial={{ scale: 1.22, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: .44, delay: .27, ease: [0.16, 1, .3, 1] }}
        >
          <div className="tabular" style={{ fontSize: '15vmin', fontWeight: 800, letterSpacing: '-.09em', lineHeight: '.82' }}>94%</div>
          <motion.div className="film-label" style={{ color: '#D5EC79', marginTop: '2.1vmin', fontSize: '2.05vmin' }} initial={{ opacity: 0, y: 9, letterSpacing: '.34em' }} animate={{ opacity: 1, y: 0, letterSpacing: '.2em' }} transition={{ delay: .5, duration: .4 }}>MATCH</motion.div>
        </motion.div>
        <motion.div
          style={{ position: 'absolute', left: '60%', top: '23%', width: '34%', color: '#17362F', borderRadius: '1.8vmin', background: '#F6F5EE', padding: '2.1vmin', boxShadow: '0 2vmin 5vmin rgba(4,22,17,.25)', transformOrigin: 'left center' }}
          initial={{ opacity: 0, rotateY: 30, x: 22, scale: .92 }}
          animate={{ opacity: 1, rotateY: 0, x: 0, scale: 1 }}
          transition={{ delay: .76, duration: .52, ease: [0.16, 1, .3, 1] }}
        >
          <div className="film-label" style={{ color: '#739183', fontSize: '1.3vmin' }}>BUYER × PROPERTY</div>
          <div style={{ fontSize: '2.6vmin', fontWeight: 800, letterSpacing: '-.05em', marginTop: '1.2vmin' }}>Tariro M. <span style={{ color: '#85A493' }}>×</span></div>
          <div style={{ fontSize: '2.25vmin', fontWeight: 700, marginTop: '.3vmin' }}>3-bed Borrowdale</div>
          <div style={{ fontSize: '1.5vmin', color: '#73877C', marginTop: '1.1vmin' }}>ILLUSTRATIVE PROFILE</div>
          <div style={{ height: '1px', background: 'rgba(44,109,93,.15)', margin: '1.3vmin 0' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.7vmin', color: '#617A6D', fontSize: '1.45vmin', fontWeight: 700 }}>
            {['Budget', 'Area', 'Cash', 'Immediate'].map((item, i) => (
              <motion.span key={item} style={{ padding: '.52vmin .7vmin', borderRadius: '99px', background: '#E8EEE6', display: 'inline-flex', gap: '.5vmin', alignItems: 'center' }} initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .99 + i * .11, duration: .24 }}>
                <span style={{ color: '#2C6D5D' }}>✓</span>{item}
              </motion.span>
            ))}
          </div>
        </motion.div>
        <motion.div
          style={{ position: 'absolute', left: '66%', bottom: '10%', color: '#BCD0C2', fontSize: '1.45vmin', letterSpacing: '.12em', fontWeight: 700 }}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.15, duration: .3 }}
        >BUDGET · AREA · FINANCE · URGENCY</motion.div>
      </div>
    </motion.section>
  );
}
