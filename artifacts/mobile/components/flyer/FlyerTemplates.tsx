import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ImageStyle } from 'react-native';
import type { Property } from '@/types';
import {
  flyerFeatures, flyerLocation, flyerPrice, flyerStats, flyerSummary, readableOn, safeColor,
  type FlyerSettings,
} from '@/utils/propertyFlyer';

export const FLYER_W = 360;
export const FLYER_H = 450;

export interface TemplateProps {
  property: Property;
  settings: FlyerSettings;
  shareUrl: string;
  main?: string;
  extras: string[];
  mainFailed: boolean;
  logoOk: boolean;
  pic: (uri: string, style: StyleProp<ImageStyle>) => React.ReactNode;
}

function Brand({ s, logoOk, pic, size = 34, color, align = 'flex-start' }: {
  s: FlyerSettings; logoOk: boolean; pic: TemplateProps['pic']; size?: number; color: string; align?: 'flex-start' | 'center';
}) {
  return (
    <View style={{ alignItems: align, maxWidth: 150 }}>
      {logoOk && !!s.logoUrl ? pic(s.logoUrl, { width: size * 2.6, height: size, resizeMode: 'contain' }) : null}
      {!!s.agencyName && (!logoOk || !s.logoUrl) && (
        <Text style={{ color, fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }} numberOfLines={2}>
          {s.agencyName.toUpperCase()}
        </Text>
      )}
      {!!s.tagline && <Text style={{ color, fontSize: 7, fontStyle: 'italic', marginTop: 2, opacity: 0.85 }} numberOfLines={1}>{s.tagline}</Text>}
    </View>
  );
}

function Failed() {
  return (
    <View style={[StyleSheet.absoluteFill, st.failed]}>
      <Text style={st.failedTitle}>Main photo could not be loaded</Text>
      <Text style={st.failedSub}>Check your connection and reopen the flyer.</Text>
    </View>
  );
}

function MainPhoto({ p, style }: { p: TemplateProps; style?: StyleProp<ImageStyle> }) {
  if (p.mainFailed || !p.main) return <Failed />;
  return <>{p.pic(p.main, [{ width: '100%', height: '100%' }, style])}</>;
}

function ContactLine({ s, color }: { s: FlyerSettings; color: string }) {
  if (!s.contactName && !s.contactPhone) return null;
  return (
    <View>
      {!!s.contactName && <Text style={{ color, fontSize: 8, fontWeight: '800', letterSpacing: 1 }} numberOfLines={1}>CONTACT {s.contactName.toUpperCase()}</Text>}
      {!!s.contactPhone && <Text style={{ color, fontSize: 21, fontWeight: '900' }} numberOfLines={1} adjustsFontSizeToFit>{s.contactPhone}</Text>}
    </View>
  );
}

export function EditorialTemplate(p: TemplateProps) {
  const { settings: s, property } = p;
  const c = safeColor(s.primaryColor);
  const on = readableOn(c);
  const features = flyerFeatures(property, 6);
  const summary = flyerSummary(property, 150);
  const price = flyerPrice(property);
  const words = (s.headline || '').trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : '';
  return (
    <View style={[st.root, { backgroundColor: '#FFFFFF' }]}>
      <View style={{ height: 150 }}>
        <View style={{ position: 'absolute', right: 0, top: 0, width: 230, height: 150, overflow: 'hidden', backgroundColor: '#E5E7EB' }}>
          <MainPhoto p={p} />
        </View>
        <View style={{ position: 'absolute', left: 0, top: 0, width: 150, height: 150, justifyContent: 'center', paddingLeft: 14 }}>
          <Brand s={s} logoOk={p.logoOk} pic={p.pic} color={c} />
        </View>
        <View style={{ position: 'absolute', right: 0, bottom: 0, width: 230, height: 5, backgroundColor: c }} />
      </View>
      <View style={{ paddingHorizontal: 14, paddingTop: 6 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: '#111827', letterSpacing: -0.5 }} numberOfLines={1} adjustsFontSizeToFit>
          {(last ? words.join(' ') : s.headline).toUpperCase()}
        </Text>
        {!!last && <Text style={{ fontSize: 30, fontWeight: '900', color: c, letterSpacing: -0.5, marginTop: -4 }} numberOfLines={1} adjustsFontSizeToFit>{last.toUpperCase()}</Text>}
      </View>
      <View style={[st.bar, { backgroundColor: c, marginHorizontal: 14, marginTop: 4 }]}>
        <Text style={{ color: on, fontSize: 8, fontWeight: '800', flex: 1 }} numberOfLines={2}>{flyerLocation(property).toUpperCase()}</Text>
        {!!price && <Text style={{ color: on, fontSize: 18, fontWeight: '900', marginLeft: 8 }} numberOfLines={1}>{price}</Text>}
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 14, marginTop: 6, gap: 8, flex: 1 }}>
        <View style={{ flex: 1.25 }}>
          {!!summary && <Text style={{ fontSize: 7.5, lineHeight: 10, color: '#374151' }} numberOfLines={5}>{summary}</Text>}
          {features.length > 0 && (
            <View style={[st.featBox, { borderColor: c }]}>
              <Text style={{ color: c, fontSize: 7, fontWeight: '900', letterSpacing: 1, marginBottom: 2 }}>PROPERTY FEATURES</Text>
              {features.map(f => (
                <Text key={f} style={{ fontSize: 7.5, color: '#111827', lineHeight: 10 }} numberOfLines={1}>{'\u2022 '}{f}</Text>
              ))}
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          {p.extras.slice(0, 3).map(u => (
            <View key={u} style={{ flex: 1, borderRadius: 3, overflow: 'hidden', borderWidth: 1.5, borderColor: c }}>
              {p.pic(u, { width: '100%', height: '100%' })}
            </View>
          ))}
        </View>
      </View>
      <View style={[st.footer, { backgroundColor: c }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: on, fontSize: 6.5, opacity: 0.85 }} numberOfLines={1}>{flyerStats(property).map(x => `${x.value} ${x.label}`).join('  |  ')}</Text>
          <Text style={{ color: on, fontSize: 6.5, opacity: 0.85, marginTop: 1 }} numberOfLines={1}>{p.shareUrl.replace(/^https?:\/\//i, '')}</Text>
        </View>
        <ContactLine s={s} color={on} />
      </View>
    </View>
  );
}

export function ShowcaseTemplate(p: TemplateProps) {
  const { settings: s, property } = p;
  const c = safeColor(s.primaryColor);
  const price = flyerPrice(property);
  const stats = flyerStats(property);
  return (
    <View style={[st.root, { backgroundColor: '#0B1220' }]}>
      <View style={StyleSheet.absoluteFill}><MainPhoto p={p} /></View>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,12,24,0.18)' }]} />
      <View style={{ position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 6 }}>
          <Brand s={s} logoOk={p.logoOk} pic={p.pic} color={c} size={26} />
        </View>
        {!!price && <View style={{ backgroundColor: c, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}><Text style={{ color: readableOn(c), fontWeight: '900', fontSize: 15 }}>{price}</Text></View>}
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,12,24,0.88)', padding: 14 }}>
        {p.extras.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 5, marginBottom: 9 }}>
            {p.extras.slice(0, 4).map(u => <View key={u} style={{ flex: 1, height: 52, borderRadius: 4, overflow: 'hidden' }}>{p.pic(u, { width: '100%', height: '100%' })}</View>)}
          </View>
        )}
        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={2}>{s.headline}</Text>
        <Text style={{ color: '#CBD5E1', fontSize: 9, marginTop: 2 }} numberOfLines={1}>{flyerLocation(property)}</Text>
        {stats.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
            {stats.map(x => (
              <View key={x.label}><Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>{x.value}</Text><Text style={{ color: '#94A3B8', fontSize: 7 }}>{x.label.toUpperCase()}</Text></View>
            ))}
          </View>
        )}
        <View style={{ height: 2, backgroundColor: c, marginVertical: 9 }} />
        <ContactLine s={s} color="#FFFFFF" />
      </View>
    </View>
  );
}

export function MinimalTemplate(p: TemplateProps) {
  const { settings: s, property } = p;
  const c = safeColor(s.primaryColor);
  const features = flyerFeatures(property, 6);
  const summary = flyerSummary(property, 170);
  const stats = flyerStats(property);
  const price = flyerPrice(property);
  return (
    <View style={[st.root, { backgroundColor: '#F7F4EE', padding: 18 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Brand s={s} logoOk={p.logoOk} pic={p.pic} color="#1F2937" size={24} />
        <Text style={{ fontSize: 7, letterSpacing: 2, color: '#6B7280' }}>{property.listingType === 'rent' || property.type === 'rent' ? 'TO RENT' : 'FOR SALE'}</Text>
      </View>
      <View style={{ height: 190, overflow: 'hidden', backgroundColor: '#E5E7EB' }}><MainPhoto p={p} /></View>
      {p.extras.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
          {p.extras.slice(0, 3).map(u => <View key={u} style={{ flex: 1, height: 44, overflow: 'hidden' }}>{p.pic(u, { width: '100%', height: '100%' })}</View>)}
        </View>
      )}
      <Text style={{ fontSize: 19, color: '#111827', fontWeight: '300', marginTop: 10, letterSpacing: -0.2 }} numberOfLines={2}>{s.headline}</Text>
      <Text style={{ fontSize: 8, color: '#6B7280', marginTop: 1 }} numberOfLines={1}>{flyerLocation(property)}</Text>
      {!!price && <Text style={{ fontSize: 17, fontWeight: '700', color: c, marginTop: 4 }}>{price}</Text>}
      <View style={{ height: 1, backgroundColor: '#D6D0C4', marginVertical: 6 }} />
      <Text style={{ fontSize: 7.5, color: '#374151', lineHeight: 10 }} numberOfLines={3}>
        {[stats.map(x => `${x.value} ${x.label.toLowerCase()}`).join(', '), summary].filter(Boolean).join('. ')}
      </Text>
      {features.length > 0 && <Text style={{ fontSize: 7, color: '#6B7280', marginTop: 3 }} numberOfLines={2}>{features.join('  /  ')}</Text>}
      <View style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <ContactLine s={s} color="#111827" />
        <View style={{ width: 28, height: 3, backgroundColor: c }} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { width: FLYER_W, height: FLYER_H, overflow: 'hidden' },
  bar: { flexDirection: 'row', alignItems: 'center', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 6 },
  featBox: { borderWidth: 1, borderRadius: 5, padding: 6, marginTop: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 8, marginTop: 6 },
  failed: { backgroundColor: '#7F1D1D', alignItems: 'center', justifyContent: 'center', padding: 16 },
  failedTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, textAlign: 'center' },
  failedSub: { color: '#FECACA', fontSize: 9, marginTop: 3, textAlign: 'center' },
});
