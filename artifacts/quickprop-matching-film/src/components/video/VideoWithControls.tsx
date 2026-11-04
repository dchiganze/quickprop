import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { SCENE_DETAILS } from './sceneMeta';
import { useSceneControls } from './useSceneControls';

const PROGRESS_TICK_MS = 60;

function announceSceneSelection(index: number, sceneKeys: string[]) {
  const key = sceneKeys[index];
  const details = SCENE_DETAILS[key];
  if (!details?.filePath) return;
  window.parent.postMessage({
    type: 'REPLIT_VIDEO_SCENE_SELECTED',
    payload: {
      sceneIndex: index,
      sceneCount: sceneKeys.length,
      sceneTitle: details.title || key,
      filePath: details.filePath,
      lineNumber: 1,
    },
  }, '*');
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const {
    sceneKeys, activeIndex, locked, paused, mountKey, tick,
    durations, activeDuration, activeStartTime, totalDuration,
    onSceneChange, jumpTo, toggleLock, togglePause,
  } = useSceneControls(SCENE_DURATIONS);
  const [muted, setMuted] = useState(false);
  const sensorRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);

  const handleJumpTo = useCallback((index: number) => {
    jumpTo(index);
    announceSceneSelection(index, sceneKeys);
  }, [jumpTo, sceneKeys]);

  useEffect(() => {
    if (!paused) return;
    const animations = document.getAnimations().filter((animation) => animation.playState === 'running');
    animations.forEach((animation) => animation.pause());
    return () => animations.forEach((animation) => animation.play());
  }, [paused]);

  const onPointerEnter = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(true);
  }, []);
  const onPointerLeave = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(false);
  }, []);
  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && collapsed) setTapPinned(true);
  }, [collapsed]);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((wasCollapsed) => {
      if (!wasCollapsed) {
        setHovering(false);
        setTapPinned(false);
      }
      return !wasCollapsed;
    });
  }, []);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const clearPin = (event: globalThis.PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      if (sensorRef.current && !sensorRef.current.contains(event.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', clearPin);
    return () => document.removeEventListener('pointerdown', clearPin);
  }, [collapsed, tapPinned]);

  if (!isIframed) return <VideoTemplate />;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <VideoTemplate
        key={mountKey}
        durations={durations}
        loop
        paused={paused}
        muted={muted}
        onSceneChange={onSceneChange}
      />
      <div
        ref={sensorRef}
        className="control-sensor"
        style={{ position: 'absolute', inset: 'auto 0 0', zIndex: 50, height: '25%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
      >
        <div style={{ flex: 1 }} aria-hidden="true" />
        <ControlBar
          visible={!collapsed || hovering || tapPinned}
          collapsed={collapsed}
          locked={locked}
          paused={paused}
          muted={muted}
          sceneKeys={sceneKeys}
          activeIndex={activeIndex}
          activeDuration={activeDuration}
          activeStartTime={activeStartTime}
          totalDuration={totalDuration}
          tick={tick}
          onTogglePause={togglePause}
          onToggleLock={toggleLock}
          onToggleMuted={() => setMuted((value) => !value)}
          onJumpTo={handleJumpTo}
          onToggleCollapsed={toggleCollapsed}
        />
      </div>
    </div>
  );
}

function ControlBar({
  visible, collapsed, locked, paused, muted, sceneKeys, activeIndex,
  activeDuration, activeStartTime, totalDuration, tick,
  onTogglePause, onToggleLock, onToggleMuted, onJumpTo, onToggleCollapsed,
}: {
  visible: boolean;
  collapsed: boolean;
  locked: boolean;
  paused: boolean;
  muted: boolean;
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  onTogglePause: () => void;
  onToggleLock: () => void;
  onToggleMuted: () => void;
  onJumpTo: (index: number) => void;
  onToggleCollapsed: () => void;
}) {
  return (
    <div
      aria-hidden={!visible}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
        color: '#F5F4ED', background: 'rgba(18,42,35,.83)', backdropFilter: 'blur(12px)',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none',
        transition: 'transform 200ms ease-out, opacity 200ms ease-out',
      }}
    >
      <BarButton title={paused ? 'Play' : 'Pause'} onClick={onTogglePause}>{paused ? <Play size={20} /> : <Pause size={20} />}</BarButton>
      <BarButton title={locked ? 'Loop current scene: on' : 'Loop current scene: off'} pressed={locked} onClick={onToggleLock}><Repeat size={20} /></BarButton>
      <BarButton title={muted ? 'Unmute audio' : 'Mute audio'} onClick={onToggleMuted}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</BarButton>
      <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,.18)', flexShrink: 0 }} />
      <PlaybackStatus
        sceneKeys={sceneKeys}
        activeIndex={activeIndex}
        activeDuration={activeDuration}
        activeStartTime={activeStartTime}
        totalDuration={totalDuration}
        tick={tick}
        paused={paused}
        onJumpTo={onJumpTo}
      />
      <BarButton title={collapsed ? 'Show controls' : 'Hide controls'} onClick={onToggleCollapsed}>{collapsed ? <ChevronUp size={23} /> : <ChevronDown size={23} />}</BarButton>
    </div>
  );
}

function BarButton({ children, title, onClick, pressed }: { children: ReactNode; title: string; onClick: () => void; pressed?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      onClick={onClick}
      style={{
        flexShrink: 0, width: 40, height: 38, display: 'grid', placeItems: 'center',
        border: 0, borderRadius: 8, color: '#F5F4ED',
        background: pressed ? 'rgba(255,255,255,.2)' : 'transparent', cursor: 'pointer',
      }}
    >{children}</button>
  );
}

function PlaybackStatus({
  sceneKeys, activeIndex, activeDuration, activeStartTime, totalDuration,
  tick, paused, onJumpTo,
}: {
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  paused: boolean;
  onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedBaseRef = useRef(0);

  useEffect(() => {
    setElapsed(0);
    elapsedBaseRef.current = 0;
  }, [tick]);

  useEffect(() => {
    if (paused) return;
    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      setElapsed(elapsedBaseRef.current + performance.now() - startedAt);
    }, PROGRESS_TICK_MS);
    return () => {
      window.clearInterval(interval);
      elapsedBaseRef.current += performance.now() - startedAt;
    };
  }, [tick, paused]);

  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;
  const totalElapsed = Math.min(totalDuration, activeStartTime + Math.min(elapsed, activeDuration));
  return (
    <>
      <div style={{ flex: 1, minWidth: 40, display: 'flex', alignItems: 'center', gap: 4 }}>
        {sceneKeys.map((key, index) => (
          <button
            key={key}
            type="button"
            aria-label={`Jump to scene ${index + 1}`}
            aria-current={activeIndex === index ? 'true' : undefined}
            onClick={() => onJumpTo(index)}
            style={{ flex: 1, height: 7, minWidth: 8, border: 0, borderRadius: 99, background: 'rgba(255,255,255,.2)', padding: 0, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
          >
            <span style={{ position: 'absolute', inset: '0 auto 0 0', width: `${index === activeIndex ? progress * 100 : 0}%`, background: '#D5EC79', borderRadius: 99 }} />
          </button>
        ))}
      </div>
      <div style={{ color: 'rgba(245,244,237,.7)', font: '600 12px/1 var(--font-mono)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{activeIndex + 1}/{sceneKeys.length}</div>
      <div role="timer" aria-label={`Playback time ${formatPlaybackTime(totalElapsed)} of ${formatPlaybackTime(totalDuration)}`} style={{ color: 'rgba(245,244,237,.85)', minWidth: 78, textAlign: 'right', font: '600 12px/1 var(--font-mono)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {formatPlaybackTime(totalElapsed)} / {formatPlaybackTime(totalDuration)}
      </div>
    </>
  );
}

function formatPlaybackTime(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}
