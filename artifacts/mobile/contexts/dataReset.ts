let resetDataContext: (() => void) | null = null;

/**
 * Lets AuthContext reset data owned by DataContext without either provider
 * importing the other. DataProvider unregisters this callback on unmount.
 */
export function registerDataReset(reset: () => void): () => void {
  resetDataContext = reset;
  return () => {
    if (resetDataContext === reset) resetDataContext = null;
  };
}

export function clearDataContextMemory(): void {
  resetDataContext?.();
}