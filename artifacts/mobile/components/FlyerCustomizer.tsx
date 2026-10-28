import React, { useRef, useState } from 'react';
import { Modal, Platform, Pressable, useWindowDimensions, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { PropertyFlyer } from '@/components/PropertyFlyer';
import { useColors } from '@/hooks/useColors';
import { pickAndPersistLogo } from '@/utils/flyerLogo';
import { FLYER_TEMPLATES, isHexColor, type FlyerSettings } from '@/utils/propertyFlyer';

interface Props {
  visible: boolean;
  onClose: () => void;
  property: Parameters<typeof PropertyFlyer>[0]['property'];
  settings: FlyerSettings;
  onChange: (settings: FlyerSettings) => void;
  /** Optional: reset to agency defaults (from useFlyerSettings().reset). */
  onReset?: () => void;
  shareUrl?: string;
}

const SWATCHES = ['#1A3C6E', '#9F1239', '#B45309', '#4C1D95', '#111827'];

export function FlyerCustomizer({ visible, onClose, property, settings, onChange, onReset, shareUrl }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [logoError, setLogoError] = useState<string | undefined>();
  const [picking, setPicking] = useState(false);
  const busy = useRef(false);
  const { width: winW } = useWindowDimensions();
  const scale = Math.min(1, Math.max(0.5, (winW - 32) / 360));
  const pw = 360 * scale;
  const ph = 450 * scale;
  const set = (patch: Partial<FlyerSettings>) => onChange({ ...settings, ...patch });

  const chooseLogo = async () => {
    if (busy.current) return;
    busy.current = true; setPicking(true); setLogoError(undefined);
    try {
      const uri = await pickAndPersistLogo(property.id);
      if (uri) set({ logoUrl: uri, logoSource: 'custom' });
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : 'Could not choose that logo.');
    } finally { busy.current = false; setPicking(false); }
  };

  const field = (label: string, key: keyof FlyerSettings, extra?: object) => (
    <View style={{ marginTop: 12 }}>
      <Text style={[s.label, { color: c.mutedForeground }]}>{label}</Text>
      <TextInput
        value={String(settings[key])}
        onChangeText={t => set({
          [key]: t,
          ...(key === 'primaryColor' ? { accentSource: 'custom' } : {}),
        } as Partial<FlyerSettings>)}
        style={[s.input, { backgroundColor: c.input, color: c.foreground, borderColor: c.border }]}
        placeholderTextColor={c.mutedForeground}
        {...extra}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={[s.header, { borderBottomColor: c.border, paddingTop: 16 + (Platform.OS === 'ios' ? 0 : insets.top) }]}>
          <Text style={{ color: c.foreground, fontSize: 17, fontWeight: '800' }}>Customise flyer</Text>
          <Pressable onPress={onClose} hitSlop={10} testID="flyer-done"><Text style={{ color: c.primary, fontWeight: '800', fontSize: 15 }}>Done</Text></Pressable>
        </View>
        <KeyboardAwareScrollViewCompat style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} bottomOffset={24}>
          <Text style={[s.note, { color: c.mutedForeground }]}>Edits are saved on this device only and apply to this listing.</Text>
          <View style={{ alignItems: 'center', marginVertical: 12 }}>
            <View style={[s.preview, { borderColor: c.border, width: pw, height: ph, overflow: 'hidden' }]}>
              <View style={{ width: 360, height: 450, transform: [{ translateX: -(360 - pw) / 2 }, { translateY: -(450 - ph) / 2 }, { scale }] }}>
                {visible && <PropertyFlyer property={property} settings={settings} shareUrl={shareUrl ?? ''} />}
              </View>
            </View>
          </View>
          <Text style={[s.label, { color: c.mutedForeground }]}>TEMPLATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 6 }}>
            {FLYER_TEMPLATES.map(t => {
              const on = settings.template === t.id;
              return (
                <Pressable key={t.id} testID={`flyer-template-${t.id}`} onPress={() => set({ template: t.id })}
                  style={[s.tpl, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.secondary : c.card }]}>
                  <Text style={{ color: c.foreground, fontWeight: '800', fontSize: 13 }}>{t.label}</Text>
                  <Text style={{ color: c.mutedForeground, fontSize: 10, marginTop: 2 }}>{t.hint}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.label, { color: c.mutedForeground, marginTop: 16 }]}>LOGO</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <Pressable onPress={chooseLogo} disabled={picking} style={[s.btn, { backgroundColor: c.primary, opacity: picking ? 0.6 : 1 }]}>
              <Text style={{ color: c.primaryForeground, fontWeight: '700' }}>{picking ? 'Saving...' : 'Choose logo'}</Text>
            </Pressable>
            {!!settings.logoUrl && (
              <Pressable onPress={() => set({ logoUrl: '', logoSource: 'none' })} style={[s.btn, { backgroundColor: c.secondary }]}>
                <Text style={{ color: c.secondaryForeground, fontWeight: '700' }}>Remove</Text>
              </Pressable>
            )}
          </View>
          <Pressable onPress={() => set({ logoSource: 'agency' })} style={{ paddingTop: 10 }}>
            <Text style={{ color: c.primary, fontWeight: '700' }}>Use agency logo</Text>
          </Pressable>
          {!!logoError && <Text style={{ color: c.destructive, fontSize: 12, marginTop: 6 }}>{logoError}</Text>}

          <Text style={[s.label, { color: c.mutedForeground, marginTop: 16 }]}>AGENCY COLOUR</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {[...new Set([...(settings.logoColors ?? []), ...SWATCHES])].map(sw => (
              <Pressable key={sw} onPress={() => set({ primaryColor: sw, accentSource: 'custom' })}
                style={[s.swatch, { backgroundColor: sw, borderColor: settings.primaryColor.toLowerCase() === sw.toLowerCase() ? c.foreground : 'transparent' }]} />
            ))}
          </View>
          <Pressable
            onPress={() => set({
              accentSource: 'logo',
              primaryColor: settings.logoColors?.[0] ?? settings.agencyPrimaryColor ?? settings.primaryColor,
            })}
            style={{ paddingTop: 10 }}
          >
            <Text style={{ color: c.primary, fontWeight: '700' }}>Use logo colours</Text>
          </Pressable>
          {field('HEX COLOUR', 'primaryColor', { autoCapitalize: 'characters', autoCorrect: false, maxLength: 7 })}
          {!isHexColor(settings.primaryColor) && <Text style={{ color: c.destructive, fontSize: 11, marginTop: 4 }}>Use a 6-digit hex such as #1A3C6E. The flyer uses a fallback until valid.</Text>}
          {field('AGENCY NAME', 'agencyName')}
          {field('TAGLINE', 'tagline')}
          {field('HEADLINE', 'headline')}
          {field('CONTACT NAME', 'contactName')}
          {field('CONTACT PHONE', 'contactPhone', { keyboardType: 'phone-pad' })}

          {!!onReset && (
            <Pressable onPress={onReset} testID="flyer-reset" style={[s.btn, { backgroundColor: c.secondary, marginTop: 20, alignSelf: 'flex-start' }]}>
              <Text style={{ color: c.secondaryForeground, fontWeight: '700' }}>Reset to agency defaults</Text>
            </Pressable>
          )}
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  note: { fontSize: 12 },
  preview: { borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 5 },
  tpl: { borderWidth: 1.5, borderRadius: 12, padding: 12, width: 150 },
  btn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
});
