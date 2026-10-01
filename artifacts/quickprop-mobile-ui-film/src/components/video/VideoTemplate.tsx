import {
  VideoCanvas,
  VideoPausedContext,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import musicBedUrl from '@/assets/quickprop-mobile-ui-bed.wav';

import { MatchesScene } from './MatchesScene';
import { QuickShareScene } from './QuickShareScene';

export const SCENE_DURATIONS = {
  matches: 5000,
  quickShare: 5000,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';

const SCENE_START_SEC: Record<string, number> = (() => {
  const offsets: Record<string, number> = {};
  let elapsedMs = 0;
  for (const [key, duration] of Object.entries(SCENE_DURATIONS)) {
    offsets[key] = elapsedMs / 1000;
    elapsedMs += duration;
  }
  return offsets;
})();

const SCENE_COMPONENTS: Record<string, ComponentType> = {
  matches: MatchesScene,
  quickShare: QuickShareScene,
};

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousSceneRef = useRef<string | null>(null);

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.42;
    if (paused) {
      audio.pause();
      return;
    }

    if (previousSceneRef.current !== currentSceneKey) {
      previousSceneRef.current = currentSceneKey;
      const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
      if (Math.abs(audio.currentTime - targetTime) > 0.18) {
        audio.currentTime = targetTime;
      }
    }

    void audio.play().catch((error: unknown) => {
      console.warn(
        'QuickProp soundtrack autoplay was blocked; use the preview play control to enable audio.',
        error,
      );
    });
  }, [baseSceneKey, currentSceneKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas aspectRatio={VIDEO_ASPECT_RATIO} style={{ backgroundColor: '#0c1c19' }}>
        <AnimatePresence mode="sync">
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
        <audio
          ref={audioRef}
          src={musicBedUrl}
          autoPlay
          preload="auto"
          muted={muted}
          aria-hidden="true"
          style={{ display: 'none' }}
        />
      </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
