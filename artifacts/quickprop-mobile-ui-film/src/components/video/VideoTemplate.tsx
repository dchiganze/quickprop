import {
  VideoCanvas,
  type VideoAspectRatio,
  useVideoPlayer,
  useVideoAudio,
} from '@/lib/video';
import { AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import musicBedUrl from '@/assets/quickprop-mobile-ui-bed.wav';

import { MatchesScene } from './MatchesScene';
import { QuickShareScene } from './QuickShareScene';

const SCENE_DURATIONS = {
  matches: 5000,
  quickShare: 5000,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });
  const { muted, paused } = useVideoAudio();
  const audioRef = useRef<HTMLAudioElement>(null);
  const previousSceneRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.42;
    audio.muted = muted;
    if (previousSceneRef.current !== currentScene) {
      if (currentScene === 0) audio.currentTime = 0;
      previousSceneRef.current = currentScene;
    }

    if (paused) {
      audio.pause();
      return;
    }

    void audio.play().catch(() => {
      console.warn(
        'QuickProp soundtrack autoplay was blocked; use the preview play control to enable audio.',
      );
    });
  }, [currentScene, muted, paused]);

  return (
    <VideoCanvas
      aspectRatio={VIDEO_ASPECT_RATIO}
      style={{ backgroundColor: '#0c1c19' }}
    >
      <audio
        ref={audioRef}
        src={musicBedUrl}
        autoPlay
        loop
        preload="auto"
        aria-hidden="true"
        style={{ display: 'none' }}
      />
      <AnimatePresence mode="sync">
        {currentScene === 0 && <MatchesScene key="matches" />}
        {currentScene === 1 && <QuickShareScene key="quickShare" />}
      </AnimatePresence>
    </VideoCanvas>
  );
}
