import { useEffect, useRef, type ComponentType } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  VideoCanvas,
  VideoPausedContext,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS = {
  intent: 3000,
  listing: 3000,
  score: 3000,
  workflow: 3000,
  finale: 2000,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';
const SOURCE_AUDIO_DURATION_SEC = 10.031;
const TOTAL_FILM_DURATION_SEC =
  Object.values(SCENE_DURATIONS).reduce((total, duration) => total + duration, 0) / 1000;
const AUDIO_PLAYBACK_RATE = SOURCE_AUDIO_DURATION_SEC / TOTAL_FILM_DURATION_SEC;
const SCENE_COMPONENTS: Record<string, ComponentType> = {
  intent: Scene1,
  listing: Scene2,
  score: Scene3,
  workflow: Scene4,
  finale: Scene5,
};
const SCENE_START_SEC: Record<string, number> = (() => {
  const starts: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, duration] of Object.entries(SCENE_DURATIONS)) {
    starts[key] = cumulativeMs / 1000;
    cumulativeMs += duration;
  }
  return starts;
})();
const AUDIO_SEEK_EPSILON_SEC = 0.18;

interface TimedAudioElement {
  volume: number;
  playbackRate: number;
  preservesPitch: boolean;
  currentTime: number;
  pause: () => void;
  play: () => Promise<void>;
}

interface VideoTemplateProps {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
}

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = false,
  onSceneChange,
}: VideoTemplateProps = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSceneKeyRef = useRef<string | null>(null);
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const timedAudio = audio as unknown as TimedAudioElement;
    timedAudio.volume = 0.45;
    timedAudio.playbackRate = AUDIO_PLAYBACK_RATE;
    timedAudio.preservesPitch = true;
    if (paused) {
      timedAudio.pause();
      return;
    }
    if (lastSceneKeyRef.current !== currentSceneKey) {
      lastSceneKeyRef.current = currentSceneKey;
      const targetTime = (SCENE_START_SEC[baseSceneKey] ?? 0) * AUDIO_PLAYBACK_RATE;
      if (Math.abs(timedAudio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
        timedAudio.currentTime = targetTime;
      }
    }
    timedAudio.play().catch(() => {});
  }, [baseSceneKey, currentSceneKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas aspectRatio={VIDEO_ASPECT_RATIO} style={{ backgroundColor: 'var(--color-bg-light)' }}>
        <AnimatePresence mode="sync" initial={false}>
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
        <audio
          ref={audioRef}
          src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
          preload="auto"
          autoPlay
          muted={muted}
          aria-hidden="true"
        />
      </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
