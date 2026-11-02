import { motion } from 'framer-motion';

const states = [
  { title: 'MATCHED', tag: '1 collaboration', y: '11%', active: true, delay: 0.12 },
  { title: 'REQUESTS', tag: 'Incoming', y: '32%', active: false, delay: 0.64 },
  { title: 'SENT', tag: 'Awaiting response', y: '53%', active: false, delay: 1.16 },
];

export function Scene4() {
  return (
    <motion.section
      className="film"
      style={{ backgroundColor: '#F5F4ED' }}
      initial={{ clipPath: 'inset(0 0 0 100%)', opacity: 1 }}
      animate={{ clipPath: 'inset(0 0 0 0%)', opacity: 1 }}
      exit={{ scale: .9, rotateY: -8, opacity: 0, clipPath: 'inset(0 0 0 100%)' }}
      transition={{ duration: .42, ease: [0.16, 1, .3, 1] }}
    >
      <div style={{ position: 'absolute', inset: '10% 7%' }}>
        <motion.div className="film-label" style={{ position: 'absolute', left: '0%', top: '0%', color: '#2C6D5D', fontSize: '1.55vmin' }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24 }}>MATCHES</motion.div>
        <motion.div
          style={{ position: 'absolute', left: '0%', top: '13%', width: '28%', height: '61%', transformStyle: 'preserve-3d' }}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: .42, ease: [0.16, 1, .3, 1] }}
        >
          {states.map((state) => (
            <motion.div
              key={state.title}
              className="state-band"
              style={{ left: '0', top: state.y, width: '100%', height: '16%', borderColor: state.active ? 'rgba(44,109,93,.28)' : 'rgba(44,109,93,.12)', background: state.active ? '#E3EEE5' : '#FBFBF7' }}
              initial={{ opacity: 0, rotateX: 12, x: -10 }}
              animate={{ opacity: 1, rotateX: 0, x: 0 }}
              transition={{ delay: state.delay, duration: .34, ease: [0.16, 1, .3, 1] }}
            >
              <span style={{ fontSize: '1.65vmin', letterSpacing: '.08em', fontWeight: 800 }}>{state.title}</span>
              <span style={{ display: 'flex', gap: '.7vmin', alignItems: 'center', color: '#688276', fontSize: '1.34vmin', fontWeight: 700 }}><i className="tiny-dot" style={{ width: '.65vmin', height: '.65vmin', background: state.active ? '#2C6D5D' : '#A9B8AD' }} />{state.tag}</span>
            </motion.div>
          ))}
        </motion.div>
        <motion.div
          style={{ position: 'absolute', left: '35%', top: '4%', width: '60%', height: '76%', borderRadius: '1.9vmin', background: '#FBFBF7', border: '1px solid rgba(44,109,93,.14)', boxShadow: '0 2.4vmin 5.5vmin rgba(28,59,50,.13)', overflow: 'hidden', transformOrigin: 'left center' }}
          initial={{ opacity: 0, rotateY: 17, scale: .92, x: 20 }}
          animate={{ opacity: 1, rotateY: 0, scale: 1, x: 0 }}
          transition={{ delay: .17, duration: .52, ease: [0.16, 1, .3, 1] }}
        >
          <div style={{ position: 'absolute', inset: '0 0 auto', height: '1vmin', background: '#2C6D5D' }} />
          <div style={{ padding: '3.3vmin 3.2vmin' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="film-label" style={{ color: '#789184', fontSize: '1.25vmin' }}>STRONG BUYER MATCH</div>
                <div style={{ fontSize: '3.4vmin', lineHeight: 1, letterSpacing: '-.07em', fontWeight: 800, marginTop: '1.1vmin', color: '#17362F' }}>94% <span style={{ fontSize: '1.4vmin', letterSpacing: '.12em', color: '#2C6D5D' }}>MATCH</span></div>
              </div>
              <motion.div
                style={{ width: '8.4vmin', height: '8.4vmin', display: 'grid', placeItems: 'center', border: '.55vmin solid #D5EC79', borderRadius: '50%', color: '#2C6D5D', fontSize: '1.35vmin', fontWeight: 800 }}
                initial={{ rotate: -80, scale: .65 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: .62, delay: .45, ease: [0.16, 1, .3, 1] }}
              >94%</motion.div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.4vmin', marginTop: '2.5vmin' }}>
              <div style={{ width: '15vmin', height: '12vmin', borderRadius: '1.2vmin', overflow: 'hidden', background: 'linear-gradient(145deg,#D7E1D4,#95AA9B)', position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: '-40%', left: '-8%', width: '78%', height: '85%', borderRadius: '50% 50% 0 0', background: '#F2F0E7', transform: 'rotate(-10deg)' }} />
                <div style={{ position: 'absolute', bottom: '-38%', right: '-12%', width: '70%', height: '90%', borderRadius: '50% 50% 0 0', background: '#BDCEBF', transform: 'rotate(9deg)' }} />
              </div>
              <div>
                <div style={{ fontSize: '2.2vmin', fontWeight: 800, letterSpacing: '-.04em', color: '#17362F' }}>3-bed home</div>
                <div style={{ fontSize: '1.65vmin', color: '#71857B', marginTop: '.45vmin' }}>Borrowdale · For sale</div>
                <div style={{ fontSize: '2vmin', fontWeight: 700, marginTop: '1.05vmin', color: '#315D4E' }}>USD 248,000</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1vmin', marginTop: '2.2vmin' }}>
              {['Budget', 'Preferred area', 'Cash', 'Immediate'].map((label, i) => (
                <motion.div key={label} style={{ borderRadius: '99px', background: '#EDF1EB', padding: '.72vmin 1vmin', color: '#62796D', fontSize: '1.32vmin', fontWeight: 700, whiteSpace: 'nowrap' }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .67 + i * .1, duration: .25 }}>{label}</motion.div>
              ))}
            </div>
          </div>
          <motion.div style={{ position: 'absolute', left: '0', right: '0', bottom: '0', height: '1vmin', background: '#2C6D5D', transformOrigin: 'left center' }} initial={{ scaleX: .22 }} animate={{ scaleX: 1 }} transition={{ duration: .42, delay: 1.7, ease: [0.16, 1, .3, 1] }} />
        </motion.div>
        <motion.div style={{ position: 'absolute', right: '1%', bottom: '0%', color: '#8B9C91', fontSize: '1.25vmin', fontWeight: 700, letterSpacing: '.12em' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>MATCHED · INCOMING · SENT</motion.div>
      </div>
    </motion.section>
  );
}
