import { motion } from 'framer-motion';

export function Scene2() {
  return (
    <motion.section
      className="film"
      style={{ backgroundColor: '#E8EEE6' }}
      initial={{ clipPath: 'inset(0 0 0 100%)', opacity: 1 }}
      animate={{ clipPath: 'inset(0 0 0 0%)', opacity: 1 }}
      exit={{ scale: 1.1, opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
      transition={{ duration: 0.36, ease: [0.72, 0, 0.25, 1] }}
    >
      <motion.div
        style={{ position: 'absolute', inset: '13% 7%', transformStyle: 'preserve-3d' }}
        initial={{ scale: 0.97, x: 8 }}
        animate={{ scale: 1, x: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <div style={{ position: 'absolute', left: '1%', top: '3%', width: '34%', zIndex: 2 }}>
          <div className="film-label" style={{ color: '#2C6D5D', marginBottom: '2.3vmin' }}>BUYER PROFILE</div>
          <div style={{
            borderRadius: '2vmin', background: '#FBFBF6', border: '1px solid rgba(44,109,93,.13)',
            padding: '2.4vmin', boxShadow: '0 2.2vmin 5vmin rgba(26,67,55,.10)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5vmin', marginBottom: '2vmin' }}>
              <div style={{ width: '6vmin', height: '6vmin', borderRadius: '50%', background: '#DAE8DE', display: 'grid', placeItems: 'center', color: '#2C6D5D', fontSize: '2.1vmin', fontWeight: 800 }}>B</div>
              <div>
                <div style={{ fontSize: '2.55vmin', fontWeight: 800, letterSpacing: '-.05em', color: '#17362F' }}>Buyer profile</div>
                <div style={{ fontSize: '1.5vmin', color: '#73877C', marginTop: '.3vmin' }}>Ready to match</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.7vmin', flexWrap: 'wrap' }}>
              {['USD 250K', 'Borrowdale', 'Cash', 'Immediate'].map((tag, index) => (
                <motion.span
                  key={tag}
                  className="chip tabular"
                  style={{ fontSize: '1.63vmin', padding: '.65em .8em', boxShadow: 'none' }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.23 + index * 0.11, duration: 0.25 }}
                >{tag}</motion.span>
              ))}
            </div>
          </div>
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} aria-hidden="true">
          <motion.path d="M 30 53 C 42 38 49 57 64 48 S 75 45 81 42" fill="none" stroke="#2C6D5D" strokeWidth=".42" strokeDasharray="1.5 1.2" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: .85 }} transition={{ delay: .5, duration: .68 }} />
          <motion.circle cx="81" cy="42" r="1.1" fill="#D5EC79" stroke="#2C6D5D" strokeWidth=".45" initial={{ scale: 0 }} animate={{ scale: [0, 1.25, 1] }} transition={{ delay: 1.12, duration: .38 }} />
        </svg>
        <motion.div
          style={{
            position: 'absolute', left: '44%', top: '1%', width: '53%', height: '92%',
            borderRadius: '2.3vmin', background: '#FBFBF7', overflow: 'hidden',
            border: '1px solid rgba(32,76,63,.14)',
            boxShadow: '0 3vmin 7vmin rgba(23,62,51,.17)',
            transformOrigin: '48% 50%',
          }}
          initial={{ opacity: 0, rotateY: 15, scale: 0.86, x: 26 }}
          animate={{ opacity: 1, rotateY: 0, scale: 1, x: 0 }}
          transition={{ duration: 0.62, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{ height: '47%', background: 'linear-gradient(140deg, #D3DCCF 0%, #AABDAE 43%, #799787 100%)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: '-4%', bottom: '-48%', width: '70%', height: '118%', borderRadius: '48% 48% 0 0', background: '#E9E8DC', transform: 'rotate(-8deg)' }} />
            <div style={{ position: 'absolute', right: '-7%', bottom: '-28%', width: '68%', height: '100%', borderRadius: '50% 50% 0 0', background: '#C9D7C8', transform: 'rotate(10deg)' }} />
            <div style={{ position: 'absolute', right: '16%', top: '14%', width: '17vmin', height: '17vmin', borderRadius: '50%', background: 'rgba(245,244,237,.36)' }} />
            <div className="film-label" style={{ position: 'absolute', left: '5%', top: '9%', color: '#F5F4ED', fontSize: '1.25vmin' }}>PROPERTY · FOR SALE</div>
            <motion.div style={{ position: 'absolute', left: '10%', bottom: '12%', width: '7vmin', height: '7vmin', borderRadius: '50%', border: '1px solid #F5F4ED', display: 'grid', placeItems: 'center', color: '#F5F4ED', fontSize: '2.2vmin' }} initial={{ scale: .5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: .85, duration: .3 }}>⌖</motion.div>
          </div>
          <div style={{ padding: '2.2vmin 2.5vmin', color: '#17362F' }}>
            <div className="film-label" style={{ color: '#789184', fontSize: '1.35vmin' }}>3-BED HOME · BORROWDALE</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '1.15vmin' }}>
              <span style={{ fontSize: '3.2vmin', fontWeight: 800, letterSpacing: '-.06em' }}>USD 248,000</span>
              <span style={{ fontSize: '1.45vmin', color: '#668174', fontWeight: 700 }}>For sale</span>
            </div>
            <div style={{ height: '1px', background: 'rgba(44,109,93,.13)', margin: '1.45vmin 0 1.1vmin' }} />
            <div className="film-copy" style={{ color: '#71857B', fontSize: '1.56vmin' }}>3 bedrooms <span style={{ color: '#B4C2B8', margin: '0 .7vmin' }}>·</span> 2 bathrooms <span style={{ color: '#B4C2B8', margin: '0 .7vmin' }}>·</span> Garden</div>
          </div>
          <motion.div
            style={{ position: 'absolute', inset: '1px', border: '1px solid #2C6D5D', borderRadius: '2.3vmin', pointerEvents: 'none' }}
            initial={{ clipPath: 'inset(0 100% 0 0)', opacity: 0 }}
            animate={{ clipPath: ['inset(0 100% 0 0)', 'inset(0 0 0 0)'], opacity: [0, 1] }}
            transition={{ delay: 1.23, duration: .5, ease: 'linear' }}
          />
        </motion.div>
        <div className="film-label" style={{ position: 'absolute', left: '2%', bottom: '-5%', color: '#758C80', fontSize: '1.3vmin' }}>BUDGET · LOCATION · FINANCE · URGENCY</div>
      </motion.div>
    </motion.section>
  );
}
