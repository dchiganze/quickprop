import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, useWindowDimensions, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { PropertyFlyer } from '@/components/PropertyFlyer';
import { useColors } from '@/hooks/useColors';
import { pickAndPersistLogo } from '@/utils/flyerLogo';
import { isHexColor, type FlyerSettings } from '@/utils/propertyFlyer';
import { useGeneratePropertyFlyerCopy } from '@workspace/api-client-react';

interface Props {
  visible: boolean;
  onClose: () => void;
  property: Parameters<typeof PropertyFlyer>[0]['property'];
  settings: FlyerSettings;
  summaryOverride: string | null;
  onSummaryChange: (copy: string | null) => void;
  onChange: (settings: FlyerSettings) => void;
  /** Optional: reset to agency defaults (from useFlyerSettings().reset). */
  onReset?: () => void;
  shareUrl?: string;
}

const SWATCHES = ['#1A3C6E', '#9F1239', '#B45309', '#4C1D95', '#111827'];

export function FlyerCustomizer({
  visible,
  onClose,
  property,
  settings,
  summaryOverride,
  onSummaryChange,
  onChange,
  onReset,
  shareUrl,
}: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [logoError, setLogoError] = useState<string | undefined>();
  const [picking, setPicking] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState<string | undefined>();
  const busy = useRef(false);
  const copyRequestId = useRef(0);
  const generatePropertyFlyerCopy = useGeneratePropertyFlyerCopy();
  const { width: winW } = useWindowDimensions();
  const scale = Math.min(1, Math.max(0.5, (winW - 32) / 360));
  const pw = 360 * scale;
  const ph = 450 * scale;
  const set = (patch: Partial<FlyerSettings>) => onChange({ ...settings, ...patch });

  useEffect(() => {
    copyRequestId.current += 1;
    setCopyLoading(false);
    setCopyError(undefined);
  }, [property.id, visible]);

  const generateCopy = async () => {
    if (copyLoading) return;
    const id = Number(property.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setCopyError('Sync this published listing before generating flyer copy.');
      return;
    }

    const requestId = ++copyRequestId.current;
    setCopyLoading(true);
    setCopyError(undefined);
    try {
      const result = await generatePropertyFlyerCopy.mutateAsync({ id });
      if (copyRequestId.current === requestId) onSummaryChange(result.copy);
    } catch {
      if (copyRequestId.current === requestId) {
        setCopyError('Could not generate flyer copy. Check your connection and try again.');
      }
    } finally {
      if (copyRequestId.current === requestId) setCopyLoading(false);
    }
  };

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
                {visible && (
                  <PropertyFlyer
                    property={property}
                    settings={settings}
                    summaryOverride={summaryOverride}
                    shareUrl={shareUrl ?? ''}
                  />
                )}
              </View>
            </View>
          </View>
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

          <View style={[s.aiPanel, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={s.aiHeading}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: c.foreground }]}>FLYER COPY</Text>
                <Text style={[s.aiHint, { color: c.mutedForeground }]}>
                  Generate an optional, editable draft from this published listing.
                </Text>
              </View>
              <Pressable
                onPress={generateCopy}
                disabled={copyLoading}
                testID="generate-flyer-copy"
                accessibilityRole="button"
                accessibilityLabel={summaryOverride === null ? 'Generate AI flyer copy' : 'Regenerate AI flyer copy'}
                style={[s.aiGenerate, { backgroundColor: c.primary, opacity: copyLoading ? 0.65 : 1 }]}
              >
                {copyLoading
                  ? <ActivityIndicator size="small" color={c.primaryForeground} />
                  : <Ionicons name="sparkles-outline" size={16} color={c.primaryForeground} />}
                <Text style={[s.aiGenerateText, { color: c.primaryForeground }]}>
                  {copyLoading ? 'Writing' : summaryOverride === null ? 'Generate' : 'Regenerate'}
                </Text>
              </Pressable>
            </View>
            <TextInput
              value={summaryOverride ?? property.description ?? ''}
              onChangeText={onSummaryChange}
              multiline
              maxLength={220}
              textAlignVertical="top"
              accessibilityLabel="Editable flyer description"
              testID="flyer-copy-input"
              style={[s.aiInput, { backgroundColor: c.input, color: c.foreground, borderColor: c.border }]}
              placeholder="Generate or enter a short property description"
              placeholderTextColor={c.mutedForeground}
            />
            {summaryOverride !== null && (
              <Pressable
                onPress={() => onSummaryChange(null)}
                testID="use-original-flyer-copy"
                style={s.resetCopy}
              >
                <Text style={{ color: c.primary, fontWeight: '700', fontSize: 12 }}>Use listing description</Text>
              </Pressable>
            )}
            {!!copyError && <Text style={[s.aiError, { color: c.destructive }]}>{copyError}</Text>}
            <Text style={[s.aiHint, { color: c.mutedForeground }]}>
              Review the text before sharing. It does not change the saved listing.
            </Text>
          </View>

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
  aiPanel: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 22 },
  aiHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiHint: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  aiGenerate: { minHeight: 38, borderRadius: 10, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  aiGenerateText: { fontSize: 12, fontWeight: '800' },
  aiInput: { minHeight: 96, maxHeight: 150, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, fontSize: 14, lineHeight: 20, marginTop: 11 },
  resetCopy: { paddingVertical: 8, alignSelf: 'flex-start' },
  aiError: { fontSize: 12, marginTop: 6 },
  btn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
});
