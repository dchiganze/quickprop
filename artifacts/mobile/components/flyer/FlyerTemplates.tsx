import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ImageStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Property } from '@/types';
import {
  FALLBACK_FLYER_COLOR, flyerFeatures, flyerLocation, flyerPrice, flyerStats, flyerSummary, readableOn, safeColor,
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
  pic: (
    uri: string,
    style: StyleProp<ImageStyle>,
    resizeMode?: 'cover' | 'contain',
  ) => React.ReactNode;
}

function Brand({ s, logoOk, pic, size = 102, color, align = 'flex-start' }: {
  s: FlyerSettings; logoOk: boolean; pic: TemplateProps['pic']; size?: number; color: string; align?: 'flex-start' | 'center';
}) {
  return (
    <View style={{ alignItems: align, maxWidth: 150, width: 150 }}>
      {logoOk && !!s.logoUrl
        ? pic(s.logoUrl, { width: Math.min(size * 2.6, 150), height: size }, 'contain')
        : null}
      {!!s.agencyName && (!logoOk || !s.logoUrl) && (
        <Text style={{ color, fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }} numberOfLines={2}>
          {s.agencyName.toUpperCase()}
        </Text>
      )}
      {!!s.logoUrl && !logoOk && (
        <Text style={{ color, fontSize: 7 }}>Logo unavailable</Text>
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
       {!!s.contactName && <Text style={{ color, fontSize: 6, fontWeight: '800', letterSpacing: 1 }} numberOfLines={1}>CONTACT {s.contactName.toUpperCase()}</Text>}
       {!!s.contactPhone && <Text style={{ color, fontSize: 15.75, fontWeight: '900' }} numberOfLines={1} adjustsFontSizeToFit>{s.contactPhone}</Text>}
    </View>
  );
}

function contrastingBrandColor(value: string, fallback: string): string {
  const color = safeColor(value);
  return readableOn(color) === '#0B1929' ? fallback : color;
}

function StatIcon({
  label, primary, accent,
}: {
  label: string;
  primary: string;
  accent: string;
}) {
  const isBedroom = label.includes('Bedroom');
  const isBathroom = label.includes('Bathroom');
  const icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] = isBedroom ? 'bed'
    : isBathroom ? 'bathtub'
      : label.includes('Garage') ? 'garage'
        : label === 'Land Area' ? 'land-plots' : 'floor-plan';

  return (
    <View style={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 1 }}>
      <View style={{ height: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        {isBathroom ? (
          <>
            <MaterialCommunityIcons name="bathtub" size={22} color={primary} />
            <MaterialCommunityIcons name="shower-head" size={18} color={accent} />
          </>
        ) : (
          <MaterialCommunityIcons name={icon} size={22} color={primary} />
        )}
      </View>
    </View>
  );
}

export function EditorialTemplate(p: TemplateProps) {
  const { settings: s, property } = p;
  const c = safeColor(s.primaryColor);
  const on = readableOn(c);
  const features = flyerFeatures(property, 6);
  const summary = flyerSummary(property, 150);
  const stats = flyerStats(property);
  const iconPrimary = contrastingBrandColor(s.logoColors?.[0] ?? s.primaryColor, FALLBACK_FLYER_COLOR);
  const iconAccent = contrastingBrandColor(s.logoColors?.[1] ?? iconPrimary, iconPrimary);
  const price = flyerPrice(property);
  const words = (s.headline || '').trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : '';
  return (
    <View style={[st.root, { backgroundColor: '#FFFFFF' }]}>
      <View style={{ height: 172, position: 'relative' }}>
        <View style={{ position: 'absolute', right: 0, top: 0, width: 200, height: 172, overflow: 'hidden', backgroundColor: '#E5E7EB' }}>
          <MainPhoto p={p} />
        </View>
        <View style={{ position: 'absolute', left: 0, top: 0, width: 160, height: 102, paddingLeft: 5 }}>
          <Brand s={s} logoOk={p.logoOk} pic={p.pic} color={c} size={92} />
        </View>
        <View style={{ position: 'absolute', left: 0, bottom: 0, width: 160, height: 64, justifyContent: 'flex-end', paddingLeft: 5 }}>
          <Text style={{ fontSize: 22, lineHeight: 24, fontWeight: '900', color: '#111827', letterSpacing: -0.5 }} numberOfLines={1} adjustsFontSizeToFit>
            {(last ? words.join(' ') : s.headline).toUpperCase()}
          </Text>
          {!!last && <Text style={{ fontSize: 30, lineHeight: 33, fontWeight: '900', color: c, letterSpacing: -0.5, marginTop: -3 }} numberOfLines={1} adjustsFontSizeToFit>{last.toUpperCase()}</Text>}
        </View>
        <View style={{ position: 'absolute', right: 0, bottom: 0, width: 200, height: 5, backgroundColor: c }} />
      </View>
      <View style={[st.bar, { backgroundColor: c, marginHorizontal: 14, marginTop: 1.2 }]}>
        <Text style={{ color: on, fontSize: 8, fontWeight: '800', flex: 1 }} numberOfLines={2}>{flyerLocation(property).toUpperCase()}</Text>
        {!!price && <Text style={{ color: on, fontSize: 18, fontWeight: '900', marginLeft: 8 }} numberOfLines={1}>{price}</Text>}
      </View>
      {stats.length > 0 && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 14, marginTop: 6, marginBottom: 4, gap: 2 }}>
          {stats.map((stat, index) => (
            <View key={stat.label} style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
              <StatIcon label={stat.label} primary={index % 2 === 0 ? iconPrimary : iconAccent} accent={iconAccent} />
              <Text style={{ color: '#111827', fontSize: 8, lineHeight: 10, fontWeight: '900', marginTop: -2 }}>{stat.value}</Text>
              <Text style={{ color: '#4B5563', fontSize: 6.5, lineHeight: 7.5, fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}
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
      <View style={{ paddingHorizontal: 14, marginTop: 4, marginBottom: 4 }}>
        <ContactLine s={s} color="#111827" />
      </View>
      <View style={[st.footer, { backgroundColor: c }]}>
        <Text style={{ color: on, fontSize: 8, fontWeight: '700', letterSpacing: 0.3 }}>Powered by quickprop.co.zw</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { width: FLYER_W, height: FLYER_H, overflow: 'hidden' },
  bar: { flexDirection: 'row', alignItems: 'center', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 6 },
  featBox: { borderWidth: 1, borderRadius: 5, padding: 6, marginTop: 6 },
  footer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 5, marginTop: 4 },
  failed: { backgroundColor: '#7F1D1D', alignItems: 'center', justifyContent: 'center', padding: 16 },
  failedTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, textAlign: 'center' },
  failedSub: { color: '#FECACA', fontSize: 9, marginTop: 3, textAlign: 'center' },
});
