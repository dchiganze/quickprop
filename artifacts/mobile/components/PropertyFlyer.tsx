import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ImageStyle, StyleProp } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import type { Property } from '@/types';
import { ListingImage } from '@/components/ListingImage';
import type { FlyerSettings } from '@/utils/propertyFlyer';
import {
  EditorialTemplate, FLYER_H, FLYER_W, MinimalTemplate, ShowcaseTemplate, type TemplateProps,
} from '@/components/flyer/FlyerTemplates';

export interface PropertyFlyerHandle {
  capture: () => Promise<string>;
}
interface Props { property: Property; settings: FlyerSettings; shareUrl: string }

const READY_TIMEOUT_MS = 10_000;
const EXTRA_SLOTS = { editorial: 3, showcase: 4, minimal: 3 } as const;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export const PropertyFlyer = forwardRef<PropertyFlyerHandle, Props>(function PropertyFlyer(
  { property, settings, shareUrl }, ref,
) {
  const viewShot = useRef<ViewShotRef>(null);
  const main = property.photos?.[0] || undefined;
  const slots = EXTRA_SLOTS[settings.template] ?? 3;
  const candidates = useMemo(
    () => (property.photos ?? []).slice(1).filter((u, i, a) => !!u && u !== main && a.indexOf(u) === i).slice(0, slots + 3),
    [property.photos, main, slots],
  );
  const logo = settings.logoUrl || undefined;
  // Status per uri: settled once it loaded or failed; same uri never re-waits.
  const [status, setStatus] = useState<Record<string, 'ok' | 'fail'>>({});
  const statusRef = useRef(status);
  statusRef.current = status;
  // Failed supporting photos are omitted; the next candidate takes the slot.
  const extras = useMemo(
    () => candidates.filter(u => status[u] !== 'fail').slice(0, slots),
    [candidates, status, slots],
  );

  const mark = useCallback((uri: string, s: 'ok' | 'fail') => {
    if (statusRef.current[uri] === s) return;
    statusRef.current = { ...statusRef.current, [uri]: s };
    setStatus(statusRef.current);
  }, []);

  // A failed uri may be retried when the property/photo set changes.
  useEffect(() => {
    const keep = new Set([main, logo, ...candidates].filter(Boolean) as string[]);
    const next: Record<string, 'ok' | 'fail'> = {};
    Object.entries(statusRef.current).forEach(([k, v]) => { if (keep.has(k) && v === 'ok') next[k] = v; });
    statusRef.current = next;
    setStatus(next);
  }, [main, logo, candidates]);

  const pic = useCallback((
    uri: string,
    style: StyleProp<ImageStyle>,
    resizeMode: 'cover' | 'contain' = 'cover',
  ) => (
    <ListingImage
      key={uri}
      uri={uri}
      style={style}
      resizeMode={resizeMode}
      onLoad={() => mark(uri, 'ok')}
      onError={() => mark(uri, 'fail')}
    />
  ), [mark]);

  const required = useMemo(() => [main, logo, ...extras].filter(Boolean) as string[], [main, logo, extras]);
  const requiredRef = useRef(required);
  requiredRef.current = required;

  useImperativeHandle(ref, () => ({
    capture: async () => {
      if (!main) throw new Error('This listing has no main photo, so a flyer cannot be created.');
      const deadline = Date.now() + READY_TIMEOUT_MS;
      while (requiredRef.current.some(u => !statusRef.current[u])) {
        if (statusRef.current[main] === 'fail') break;
        if (Date.now() > deadline) break;
        await sleep(100);
      }
      if (statusRef.current[main] !== 'ok') throw new Error('The main property photo could not be loaded. Check your connection and try again.');
      await sleep(150);
      const cap = viewShot.current?.capture;
      if (!cap) throw new Error('Unable to prepare the flyer image.');
      return cap.call(viewShot.current);
    },
  }), [main]);

  const tp: TemplateProps = {
    property, settings, shareUrl, main, extras, pic,
    mainFailed: !main || status[main] === 'fail',
    logoOk: !!logo && status[logo] !== 'fail',
  };
  const Template = settings.template === 'showcase' ? ShowcaseTemplate
    : settings.template === 'minimal' ? MinimalTemplate : EditorialTemplate;

  return (
    <ViewShot
      ref={viewShot}
      style={{ width: FLYER_W, height: FLYER_H }}
      options={{ format: 'jpg', quality: 0.92, width: 1080, height: 1350 }}
    >
      <Template {...tp} />
    </ViewShot>
  );
});
