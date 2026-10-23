import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getGetAdminAgencySettingsQueryKey, useGetAdminAgencySettings } from '@workspace/api-client-react';
import type { Property, User } from '@/types';
import { buildDefaultFlyerSettings, mergeFlyerSettings, type FlyerSettings } from '@/utils/propertyFlyer';

export function useFlyerSettings(property: Property | undefined, user: User | null) {
  const agency = useGetAdminAgencySettings({ query: {
    queryKey: [...getGetAdminAgencySettingsQueryKey(), user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  } });
  const key = property && user ? `quickprop.flyer.v1:${user.id}:${property.id}` : null;
  const defaults = useMemo<FlyerSettings | null>(
    () => (property ? buildDefaultFlyerSettings(property, user, agency.data) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [property?.id, property?.title, property?.type, property?.propertyType, user?.id, user?.name, user?.phone, user?.agency, agency.data],
  );
  const empty = useMemo<FlyerSettings>(() => ({
    template: 'editorial', agencyName: '', logoUrl: '', primaryColor: '#1A3C6E',
    headline: '', contactName: '', contactPhone: '', tagline: '',
  }), []);
  const [override, setOverride] = useState<{ key: string; value: unknown } | null>(null);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | undefined>();
  const activeKey = useRef<string | null>(key);
  activeKey.current = key;

  useEffect(() => {
    if (!key) { setHydratedKey(null); return; }
    let cancelled = false;
    setStorageError(undefined);
    AsyncStorage.getItem(key)
      .then(raw => {
        if (cancelled || activeKey.current !== key) return;
        let value: unknown = null;
        try { value = raw ? JSON.parse(raw) : null; } catch { value = null; }
        setOverride(value ? { key, value } : null);
        setHydratedKey(key);
      })
      .catch(() => {
        if (cancelled) return;
        setStorageError('Saved flyer edits on this device could not be read.');
        setOverride(null);
        setHydratedKey(key);
      });
    return () => { cancelled = true; };
  }, [key]);

  const settings = useMemo(() => {
    const base = defaults ?? empty;
    return override && override.key === key ? mergeFlyerSettings(base, override.value) : base;
  }, [defaults, empty, override, key]);

  const setSettings = useCallback((next: FlyerSettings) => {
    const k = activeKey.current;
    if (!k) return;
    setOverride({ key: k, value: next });
    AsyncStorage.setItem(k, JSON.stringify(next)).catch(() =>
      setStorageError('Flyer edits could not be saved on this device.'));
  }, []);

  const reset = useCallback(() => {
    const k = activeKey.current;
    if (!k) return;
    setOverride(null);
    AsyncStorage.removeItem(k).catch(() => setStorageError('Reset could not be saved on this device.'));
  }, []);

  const loading = !!key && (hydratedKey !== key || (agency.isLoading && !agency.data));
  const error = storageError
    ?? (agency.isError ? 'Agency branding could not be loaded; using your profile details.' : undefined);
  return { settings, setSettings, loading, error, defaults: defaults ?? empty, reset };
}
