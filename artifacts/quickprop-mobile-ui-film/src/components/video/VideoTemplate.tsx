import {
  VideoCanvas,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { useEffect, useRef, useState } from 'react';

export const SCENE_DURATIONS = {
  completePromo: 41417,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';
const PROMO_VIDEO_URL = `${import.meta.env.BASE_URL}QuickProp_Promo8_SpacedChoice_RaisedLabels_1080p_24fps.mp4`;
const PROMO_WEBM_URL = `${import.meta.env.BASE_URL}QuickProp_Promo8_SpacedChoice_RaisedLabels_1080p_24fps_compatible.webm`;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = false,
  paused = false,
  muted = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaState, setMediaState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (paused) {
      video.pause();
      return;
    }

    void video.play().catch((error: unknown) => {
      console.warn(
        'QuickProp promo autoplay was blocked; use the preview play control to start playback.',
        error,
      );
    });
  }, [muted, paused]);

  return (
    <VideoCanvas
      aspectRatio={VIDEO_ASPECT_RATIO}
      className="quickprop-promo-canvas"
      style={{ backgroundColor: '#10211e' }}
    >
      <video
        ref={videoRef}
        className="quickprop-promo-video"
        aria-label="Complete QuickProp promotional video"
        autoPlay
        loop={loop}
        playsInline
        preload="auto"
        muted={muted}
        onLoadedData={() => setMediaState('ready')}
      >
        <source
          src={PROMO_VIDEO_URL}
          type="video/mp4"
          onError={(event) => event.stopPropagation()}
        />
        <source
          src={PROMO_WEBM_URL}
          type='video/webm; codecs="vp9, opus"'
          onError={(event) => {
            event.stopPropagation();
            setMediaState('error');
          }}
        />
      </video>
      {mediaState === 'loading' && (
        <div className="quickprop-promo-status" role="status">
          <span className="quickprop-promo-status__mark" />
          Loading complete promo
        </div>
      )}
      {mediaState === 'error' && (
        <div className="quickprop-promo-status quickprop-promo-status--error" role="alert">
          The complete promo could not be loaded. Reload this preview.
        </div>
      )}
    </VideoCanvas>
  );
}
