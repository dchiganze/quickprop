import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import NetInfo, {
  NetInfoStateType,
  type NetInfoState,
} from '@react-native-community/netinfo';

export type ConnectivityPhase = 'unknown' | 'online' | 'offline';

export const CONNECTIVITY_TIMINGS = {
  offlineStabilizationMs: 1500,
  onlineStabilizationMs: 1500,
} as const;

interface ConnectivityContextValue {
  phase: ConnectivityPhase;
  isOnline: boolean;
  isOffline: boolean;
  isInternetReachable: boolean | null;
  connectionType: NetInfoStateType;
  hasEverBeenOnline: boolean;
  wasPreviouslyOffline: boolean;
  refresh: () => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

function phaseForNetInfoState(state: NetInfoState): ConnectivityPhase {
  const internetReachable = state.isInternetReachable as boolean | null;
  if (state.isConnected === false || state.isInternetReachable === false) {
    return 'offline';
  }

  if (state.isConnected === true && internetReachable !== false) {
    return 'online';
  }

  return 'unknown';
}

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<ConnectivityPhase>('unknown');
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);
  const [connectionType, setConnectionType] = useState<NetInfoStateType>(NetInfoStateType.unknown);
  const [hasEverBeenOnline, setHasEverBeenOnline] = useState(false);
  const [wasPreviouslyOffline, setWasPreviouslyOffline] = useState(false);
  const phaseRef = useRef<ConnectivityPhase>('unknown');
  const hasReceivedStateRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTransitionTimer = useCallback(() => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  const commitPhase = useCallback((nextPhase: ConnectivityPhase) => {
    if (phaseRef.current === nextPhase) return;

    const previousPhase = phaseRef.current;
    phaseRef.current = nextPhase;
    setPhase(nextPhase);

    if (nextPhase === 'online') {
      setHasEverBeenOnline(true);
    }
    if (nextPhase === 'offline' && previousPhase !== 'offline') {
      setWasPreviouslyOffline(true);
    }
  }, []);

  const applyNetInfoState = useCallback((state: NetInfoState) => {
    setIsInternetReachable(state.isInternetReachable);
    setConnectionType(state.type);

    const nextPhase = phaseForNetInfoState(state);
    if (nextPhase === 'unknown') {
      // Keep the last stable phase while NetInfo is still determining reachability.
      return;
    }

    const isInitialState = !hasReceivedStateRef.current;
    hasReceivedStateRef.current = true;
    clearTransitionTimer();

    if (isInitialState && nextPhase === 'online') {
      // Initial online startup is not a recovery event and should be immediate.
      commitPhase('online');
      return;
    }

    if (phaseRef.current === nextPhase) return;

    const delay = nextPhase === 'offline'
      ? CONNECTIVITY_TIMINGS.offlineStabilizationMs
      : CONNECTIVITY_TIMINGS.onlineStabilizationMs;

    transitionTimerRef.current = setTimeout(() => {
      transitionTimerRef.current = null;
      commitPhase(nextPhase);
    }, delay);
  }, [clearTransitionTimer, commitPhase]);

  const refresh = useCallback(async () => {
    const state = await NetInfo.fetch();
    applyNetInfoState(state);
  }, [applyNetInfoState]);

  useEffect(() => {
    let mounted = true;

    const handleState = (state: NetInfoState) => {
      if (mounted) applyNetInfoState(state);
    };

    const unsubscribeNetInfo = NetInfo.addEventListener(handleState);
    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        NetInfo.fetch().then(handleState).catch(() => {});
      }
    });

    NetInfo.fetch().then(handleState).catch(() => {});

    return () => {
      mounted = false;
      clearTransitionTimer();
      unsubscribeNetInfo();
      appStateSubscription.remove();
    };
  }, [applyNetInfoState, clearTransitionTimer]);

  const value = useMemo<ConnectivityContextValue>(() => ({
    phase,
    isOnline: phase === 'online',
    isOffline: phase === 'offline',
    isInternetReachable,
    connectionType,
    hasEverBeenOnline,
    wasPreviouslyOffline,
    refresh,
  }), [
    phase,
    isInternetReachable,
    connectionType,
    hasEverBeenOnline,
    wasPreviouslyOffline,
    refresh,
  ]);

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useNetworkStatus() {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useNetworkStatus must be used within a ConnectivityProvider');
  }
  return context;
}
