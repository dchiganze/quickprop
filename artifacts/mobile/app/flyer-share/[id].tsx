import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getGetPropertyQueryKey,
  useGeneratePropertyAIFlyer,
  useGetProperty,
} from '@workspace/api-client-react';
import type { PropertyAIFlyerResult } from '@workspace/api-client-react';
import { getAIFlyerErrorMessage } from '@/lib/ai-flyer-errors';
import { useAuth } from '@/contexts/AuthContext';
import { useData, toMobileProperty } from '@/contexts/DataContext';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { PropertyFlyer, type PropertyFlyerHandle } from '@/components/PropertyFlyer';
import { useFlyerSettings } from '@/hooks/useFlyerSettings';
import { useColors } from '@/hooks/useColors';
import { resolveFlyerPalette, type FlyerSettings } from '@/utils/propertyFlyer';
import { propertyShareLinks } from '@/utils/shareLinks';
import { buildPropertyFlyerCaption } from '@/utils/shareContent';
import { sharePropertyGeneric } from '@/utils/whatsapp';
import type { Property } from '@/types';

type Step = 'choose' | 'prompt' | 'preview';
type FlyerMode = 'standard' | 'ai';

function ChoiceCard({
  title,
  detail,
  icon,
  selected,
  disabled,
  onPress,
  testID,
}: {
  title: string;
  detail: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[
        styles.choiceCard,
        {
          backgroundColor: selected ? colors.primary + '0D' : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.78}
      accessibilityRole="button"
      testID={testID}
    >
      <View style={[styles.choiceIcon, { backgroundColor: colors.primary + '16' }]}>
        <Ionicons name={icon} size={21} color={colors.primary} />
      </View>
      <View style={styles.choiceText}>
        <Text style={[styles.choiceTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.choiceDetail, { color: colors.mutedForeground }]}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

export default function FlyerShareScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { properties } = useData();
  const { user } = useAuth();
  const localProperty = properties.find((item) => item.id === String(id));
  const remoteId = /^\d+$/.test(String(id)) ? Number(id) : 0;
  const propertyQuery = useGetProperty(remoteId, {
    query: {
      queryKey: getGetPropertyQueryKey(remoteId),
      enabled: !localProperty && remoteId > 0,
      retry: false,
    },
  });
  const property: Property | undefined = localProperty
    ?? (propertyQuery.data ? toMobileProperty(propertyQuery.data) : undefined);
  const flyer = useFlyerSettings(property, user);
  const generateAIFlyer = useGeneratePropertyAIFlyer();
  const flyerRef = useRef<PropertyFlyerHandle>(null);
  const [step, setStep] = useState<Step>('choose');
  const [mode, setMode] = useState<FlyerMode | null>(null);
  const [stylePrompt, setStylePrompt] = useState('');
  const [generated, setGenerated] = useState<PropertyAIFlyerResult | null>(null);
  const [generationError, setGenerationError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sharing, setSharing] = useState(false);

  const listingStatus = property?.pendingStatus ?? property?.status;
  const aiAvailable = remoteId > 0
    && property?.syncStatus !== 'queued'
    && property?.syncStatus !== 'conflict'
    && (listingStatus === 'published' || listingStatus === 'draft');
  const isBusy = generating || sharing;
  const previewWidth = Math.min(width - 32, 360);
  const previewScale = previewWidth / 360;
  const previewHeight = 450 * previewScale;

  const previewSettings = useMemo<FlyerSettings>(() => {
    if (mode !== 'ai' || !generated) return flyer.settings;
    return {
      ...flyer.settings,
      designStyle: generated.designStyle,
      primaryColor: resolveFlyerPalette(
        generated.palette,
        flyer.settings.agencyPrimaryColor ?? flyer.settings.primaryColor,
      ),
    };
  }, [flyer.settings, generated, mode]);

  const goBack = () => {
    if (step === 'preview') {
      setStep(mode === 'ai' ? 'prompt' : 'choose');
      return;
    }
    if (step === 'prompt') {
      setStep('choose');
      setMode(null);
      setGenerated(null);
      setGenerationError('');
      return;
    }
    router.back();
  };

  const chooseMode = (nextMode: FlyerMode) => {
    setMode(nextMode);
    setGenerated(null);
    setGenerationError('');
    if (nextMode === 'ai') setStep('prompt');
    else setStep('preview');
  };

  const handleGenerate = async () => {
    const prompt = stylePrompt.trim();
    if (prompt.length < 3) {
      setGenerationError('Describe the flyer style in at least 3 characters.');
      return;
    }
    if (!property || !aiAvailable || remoteId <= 0) {
      setGenerationError('Save and sync this listing while online before generating an AI flyer.');
      return;
    }

    setGenerating(true);
    setGenerationError('');
    try {
      const result = await generateAIFlyer.mutateAsync({
        id: remoteId,
        data: { stylePrompt: prompt },
      });
      setGenerated(result);
      setMode('ai');
      setStep('preview');
    } catch (error) {
      setGenerationError(getAIFlyerErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!property || isBusy || (mode === 'ai' && !generated)) return;
    setSharing(true);
    try {
      await sharePropertyGeneric(
        property,
        () => flyerRef.current?.capture()
          ?? Promise.reject(new Error('Unable to prepare the flyer image.')),
        'Share property flyer',
        true,
        buildPropertyFlyerCaption(user?.id),
      );
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      if (!message.toLowerCase().includes('cancel') && !message.toLowerCase().includes('dismiss')) {
        Alert.alert('Could not share flyer', message);
      }
    } finally {
      setSharing(false);
    }
  };

  if (!property && propertyQuery.isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, padding: 24 }]}>
        <Ionicons name="home-outline" size={38} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Listing unavailable</Text>
        <Text style={[styles.choiceDetail, { color: colors.mutedForeground, textAlign: 'center' }]}>
          Return to the listing and try opening the flyer options again.
        </Text>
        <Pressable onPress={() => router.back()} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Back to listing</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={goBack}
          style={[styles.headerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="flyer-step-back"
        >
          <Ionicons name="arrow-back" size={19} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {step === 'choose' ? 'Choose a flyer' : step === 'prompt' ? 'Describe your AI flyer' : 'Flyer preview'}
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {property.referenceNumber} · {property.suburb}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Close flyer options"
          testID="flyer-step-close"
        >
          <Ionicons name="close" size={19} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {step === 'choose' && (
        <View style={styles.content}>
          <Text style={[styles.introTitle, { color: colors.foreground }]}>How should this flyer look?</Text>
          <Text style={[styles.introCopy, { color: colors.mutedForeground }]}>
            Choose your agency-branded standard flyer or ask AI to create a style and copy preview.
          </Text>
          <ChoiceCard
            title="Standard Flyer"
            detail="Use your saved agency branding and current listing details."
            icon="business-outline"
            onPress={() => chooseMode('standard')}
            testID="choose-standard-flyer"
          />
          <ChoiceCard
            title="AI Flyer"
            detail={aiAvailable
              ? 'Describe a style; AI will adapt the design and draft the copy.'
              : 'Available for published listings and saved drafts after syncing online.'}
            icon="sparkles-outline"
            disabled={!aiAvailable}
            onPress={() => chooseMode('ai')}
            testID="choose-ai-flyer"
          />
          <View style={[styles.infoNote, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark-outline" size={17} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.secondaryForeground }]}>
              AI keeps listing facts, photos, and your agency logo unchanged. Creating a flyer does not publish the listing.
            </Text>
          </View>
        </View>
      )}

      {step === 'prompt' && (
        <KeyboardAwareScrollViewCompat
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: (Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom) + 32 }]}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >
          <View style={[styles.aiIntro, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.aiIcon, { backgroundColor: colors.primary + '16' }]}>
              <Ionicons name="sparkles" size={20} color={colors.primary} />
            </View>
            <View style={styles.choiceText}>
              <Text style={[styles.choiceTitle, { color: colors.foreground }]}>Describe the design</Text>
              <Text style={[styles.choiceDetail, { color: colors.mutedForeground }]}>
                Tell AI the visual style and tone you want.
              </Text>
            </View>
          </View>
          <TextInput
            value={stylePrompt}
            onChangeText={(value) => {
              setStylePrompt(value);
              setGenerated(null);
              setGenerationError('');
            }}
            multiline
            maxLength={300}
            textAlignVertical="top"
            placeholder="For example: clean modern layout, deep blue accents, spacious and professional"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.promptInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            accessibilityLabel="Describe the AI flyer design"
            testID="ai-flyer-prompt"
          />
          <Text style={[styles.characterCount, { color: colors.mutedForeground }]}>{stylePrompt.length}/300</Text>
          <Text style={[styles.promptHelp, { color: colors.mutedForeground }]}>
            AI will choose a visual treatment and write a short description from saved listing facts. It will not create or replace property photos.
          </Text>
          {!!generationError && (
            <Text style={[styles.errorText, { color: colors.destructive }]} accessibilityRole="alert">
              {generationError}
            </Text>
          )}
          <Pressable
            onPress={handleGenerate}
            disabled={generating}
            style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: generating ? 0.7 : 1 }]}
            accessibilityRole="button"
            testID="generate-ai-flyer"
          >
            {generating
              ? <ActivityIndicator size="small" color={colors.primaryForeground} />
              : <Ionicons name="sparkles-outline" size={18} color={colors.primaryForeground} />}
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              {generating ? 'Creating preview…' : 'Create AI preview'}
            </Text>
          </Pressable>
        </KeyboardAwareScrollViewCompat>
      )}

      {step === 'preview' && (
        <KeyboardAwareScrollViewCompat
          style={styles.flex}
          contentContainerStyle={[styles.previewContent, { paddingBottom: (Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom) + 32 }]}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >
          <View style={[styles.previewBadge, { backgroundColor: colors.secondary }]}>
            <Ionicons name={mode === 'ai' ? 'sparkles' : 'business-outline'} size={15} color={colors.primary} />
            <Text style={[styles.previewBadgeText, { color: colors.secondaryForeground }]}>
              {mode === 'ai' ? 'AI flyer' : 'Standard flyer'}
            </Text>
          </View>
          <View style={[styles.flyerFrame, { width: previewWidth, height: previewHeight, borderColor: colors.border }]}>
            <View
              style={{
                width: 360,
                height: 450,
                transform: [
                  { translateX: -(360 - previewWidth) / 2 },
                  { translateY: -(450 - previewHeight) / 2 },
                  { scale: previewScale },
                ],
              }}
            >
              <PropertyFlyer
                key={`${property.id}-${mode}-${generated?.designStyle ?? 'standard'}`}
                ref={flyerRef}
                property={property}
                settings={previewSettings}
                summaryOverride={mode === 'ai' ? generated?.copy ?? null : null}
                shareUrl={propertyShareLinks(property).webUrl}
              />
            </View>
          </View>
          {mode === 'ai' && generated && (
            <Text style={[styles.previewNote, { color: colors.mutedForeground }]}>
              Check the AI-written text and design before sharing.
            </Text>
          )}
          {flyer.error && (
            <Text style={[styles.errorText, { color: colors.destructive }]}>{flyer.error}</Text>
          )}
          {mode === 'ai' && (
            <Pressable
              onPress={() => setStep('prompt')}
              style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card }]}
              testID="edit-ai-flyer-prompt"
            >
              <Ionicons name="create-outline" size={17} color={colors.primary} />
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Change design request</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleShare}
            disabled={isBusy || (mode === 'ai' && !generated)}
            style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: isBusy ? 0.7 : 1 }]}
            accessibilityRole="button"
            testID="share-flyer-preview"
          >
            {sharing
              ? <ActivityIndicator size="small" color={colors.primaryForeground} />
              : <Ionicons name="share-outline" size={18} color={colors.primaryForeground} />}
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              {sharing ? 'Preparing flyer…' : 'Share flyer'}
            </Text>
          </Pressable>
        </KeyboardAwareScrollViewCompat>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  header: {
    minHeight: 66,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSub: { fontSize: 11, marginTop: 2 },
  content: { paddingHorizontal: 18, paddingTop: 24, gap: 12 },
  introTitle: { fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -0.4 },
  introCopy: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  choiceCard: {
    minHeight: 82,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  choiceIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  choiceText: { flex: 1, gap: 3 },
  choiceTitle: { fontSize: 15, fontWeight: '800' },
  choiceDetail: { fontSize: 12, lineHeight: 17 },
  infoNote: { marginTop: 4, borderRadius: 13, borderWidth: 1, padding: 12, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
  aiIntro: { borderRadius: 15, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  promptInput: { minHeight: 132, maxHeight: 220, borderWidth: 1, borderRadius: 14, padding: 13, fontSize: 15, lineHeight: 22 },
  characterCount: { alignSelf: 'flex-end', fontSize: 11, marginTop: -7 },
  promptHelp: { fontSize: 12, lineHeight: 18 },
  errorText: { fontSize: 12, lineHeight: 18 },
  primaryButton: {
    minHeight: 50,
    paddingHorizontal: 18,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: { fontSize: 14, fontWeight: '800' },
  previewContent: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 18, gap: 12 },
  previewBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20 },
  previewBadgeText: { fontSize: 12, fontWeight: '700' },
  flyerFrame: { overflow: 'hidden', borderWidth: 1, borderRadius: 12 },
  previewNote: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  secondaryButton: { width: '100%', minHeight: 44, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButtonText: { fontSize: 13, fontWeight: '700' },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
});
