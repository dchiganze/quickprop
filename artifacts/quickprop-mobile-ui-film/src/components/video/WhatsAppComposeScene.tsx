import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircle, MoreVertical, Send, Video } from 'lucide-react';
import quickPropLogo from '@assets/quickprop-logo.png';
import { useSceneTimer } from '@/lib/video';
import { PhoneFrame } from './PhoneFrame';

const CAPTION = 'Follow this link to see all my properties www.quickprop.co.zw/douglaschiganze';

export function WhatsAppComposeScene() {
  const [captionVisible, setCaptionVisible] = useState(false);
  const [sendReady, setSendReady] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const events = useMemo(
    () => [
      { time: 760, callback: () => setCaptionVisible(true) },
      { time: 1900, callback: () => setSendReady(true) },
      { time: 2900, callback: () => setHandoff(true) },
    ],
    [],
  );
  useSceneTimer(events);

  return (
    <motion.section
      className="film-scene whatsapp-scene"
      initial={{ opacity: 0, clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 24%)', scale: 1.025 }}
      animate={{ opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', scale: 1 }}
      exit={{ opacity: 0, scale: 1.06, clipPath: 'inset(0 0 0 100%)' }}
      transition={{ duration: 0.42, ease: [0.65, 0, 0.35, 1] }}
    >
      <div className="whatsapp-orbit" />
      <div className="scene-index index-share">
        <span className="index-number">02</span>
        <span className="index-label">WHATSAPP</span>
      </div>
      <div className="scene-side-note share-side-note">FLYER + MESSAGE · READY TO SEND</div>

      <PhoneFrame>
        <div className="whatsapp-app">
          <header className="wa-header">
            <ArrowLeft size={17} />
            <div className="wa-avatar"><MessageCircle size={16} /></div>
            <div className="wa-contact"><strong>WhatsApp</strong><span>Share listing</span></div>
            <Video size={16} />
            <MoreVertical size={16} />
          </header>
          <div className="wa-chat">
            <motion.div
              className="wa-flyer-message"
              initial={{ opacity: 0, y: 20, scale: 0.92, rotate: 1.5 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              transition={{ duration: 0.62, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="wa-flyer">
                <div className="wa-flyer-top">
                  <img src={quickPropLogo} alt="QuickProp" />
                  <span>PROPERTY LISTING</span>
                </div>
                <div className="wa-flyer-hero">
                  <div className="wa-flyer-sky" />
                  <div className="wa-flyer-tree wa-tree-a" />
                  <div className="wa-flyer-tree wa-tree-b" />
                  <div className="wa-flyer-lawn" />
                  <div className="wa-flyer-home">
                    <i /><i /><i />
                  </div>
                  <span className="wa-flyer-headline">3 BEDROOM<br /><b>HOME</b></span>
                </div>
                <div className="wa-flyer-location"><span>AVONDALE, HARARE</span><b>USD 275,000</b></div>
                <div className="wa-flyer-specs">
                  <span><b>3</b>Bedrooms</span>
                  <span><b>2</b>Bathrooms</span>
                  <span><b>2</b>Garages</span>
                </div>
                <div className="wa-flyer-footer">Powered by quickprop.co.zw</div>
              </div>
                {captionVisible && (
                  <motion.div
                    className="wa-caption-bubble"
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p>{CAPTION}</p>
                  </motion.div>
                )}
              </motion.div>
          </div>
          <div className="wa-compose-footer">
            <div className="wa-recipient"><span>You</span><b>×</b></div>
            <motion.div
              className={`wa-send ${sendReady ? 'wa-send-ready' : ''}`}
              animate={
                handoff
                  ? { scale: 2.2, x: -4, y: -2, rotate: -5, opacity: 0.92 }
                  : sendReady
                    ? { scale: [1, 1.12, 1], rotate: [0, -7, 0] }
                    : { scale: 1 }
              }
              transition={{ duration: handoff ? 0.54 : 0.62, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <Send size={17} fill="currentColor" />
            </motion.div>
          </div>
        </div>
      </PhoneFrame>

      <div className="share-bottom-caption">
        <span>PROPERTY FLYER</span>
        <span className="caption-divider" />
        <span>CAPTION PREFILLED</span>
      </div>
    </motion.section>
  );
}
