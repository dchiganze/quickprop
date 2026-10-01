import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const SCENE_DETAILS: Record<string, { title: string; filePath: string }> = {
  dashboard: { title: 'Your Portfolio', filePath: 'src/components/video/video_scenes/FilmScenes.tsx' },
  listing: { title: 'List, Match, Move', filePath: 'src/components/video/video_scenes/FilmScenes.tsx' },
  share: { title: 'Share Beautifully', filePath: 'src/components/video/video_scenes/FilmScenes.tsx' },
  brand: { title: 'QuickProp Brand Close', filePath: 'src/components/video/video_scenes/FilmScenes.tsx' },
};

function formatTime(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function PlaybackStatus({ sceneKeys, activeIndex, activeDuration, activeStartTime, totalDuration, tick, paused, onJumpTo }: {
  sceneKeys: string[]; activeIndex: number; activeDuration: number; activeStartTime: number;
  totalDuration: number; tick: number; paused: boolean; onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const baseRef = useRef(0);
  useEffect(() => { setElapsed(0); baseRef.current = 0; }, [tick]);
  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const id = window.setInterval(() => setElapsed(baseRef.current + performance.now() - start), 60);
    return () => { window.clearInterval(id); baseRef.current += performance.now() - start; };
  }, [tick, paused]);
  const progress = activeDuration ? Math.min(1, elapsed / activeDuration) : 0;
  const totalElapsed = Math.min(totalDuration, activeStartTime + Math.min(elapsed, activeDuration));
  return (
    <>
      <div className="controls-progress">
        {sceneKeys.map((key, index) => (
          <button key={key} onClick={() => onJumpTo(index)} aria-label={`Jump to scene ${index + 1}`}>
            <i style={{ width: `${index === activeIndex ? progress * 100 : 0}%` }} />
          </button>
        ))}
      </div>
      <span className="controls-count">{activeIndex + 1}/{sceneKeys.length}</span>
      <span className="controls-time">{formatTime(totalElapsed)} / {formatTime(totalDuration)}</span>
    </>
  );
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const controls = useSceneControls(SCENE_DURATIONS);
  const [muted, setMuted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (!controls.paused) return;
    const frozen = document.getAnimations().filter((animation) => animation.playState === 'running');
    frozen.forEach((animation) => animation.pause());
    return () => frozen.forEach((animation) => animation.play());
  }, [controls.paused]);

  const jumpTo = useCallback((index: number) => {
    controls.jumpTo(index);
    const key = controls.sceneKeys[index];
    const details = SCENE_DETAILS[key];
    if (details) window.parent.postMessage({ type: 'REPLIT_VIDEO_SCENE_SELECTED', payload: { sceneIndex: index, sceneCount: controls.sceneKeys.length, sceneTitle: details.title, filePath: details.filePath, lineNumber: 1 } }, '*');
  }, [controls]);

  if (!isIframed) return <VideoTemplate />;
  const visible = !collapsed || hovering;
  return (
    <div className="video-controls-root">
      <VideoTemplate key={controls.mountKey} durations={controls.durations} paused={controls.paused} loop muted={muted} onSceneChange={controls.onSceneChange} />
      <div className="controls-sensor" onPointerEnter={(e) => e.pointerType === 'mouse' && setHovering(true)} onPointerLeave={(e) => e.pointerType === 'mouse' && setHovering(false)}>
        <div />
        <div className={`control-bar ${visible ? 'control-bar--visible' : ''}`}>
          <button onClick={controls.togglePause} aria-label={controls.paused ? 'Play' : 'Pause'}>{controls.paused ? <Play /> : <Pause />}</button>
          <button className={controls.locked ? 'is-active' : ''} onClick={controls.toggleLock} aria-label="Loop current scene"><Repeat /></button>
          <button onClick={() => setMuted((value) => !value)} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <VolumeX /> : <Volume2 />}</button>
          <span className="controls-divider" />
          <PlaybackStatus sceneKeys={controls.sceneKeys} activeIndex={controls.activeIndex} activeDuration={controls.activeDuration} activeStartTime={controls.activeStartTime} totalDuration={controls.totalDuration} tick={controls.tick} paused={controls.paused} onJumpTo={jumpTo} />
          <button onClick={() => { setCollapsed((value) => !value); setHovering(false); }} aria-label={collapsed ? 'Show controls' : 'Hide controls'}>{collapsed ? <ChevronUp /> : <ChevronDown />}</button>
        </div>
      </div>
    </div>
  );
}