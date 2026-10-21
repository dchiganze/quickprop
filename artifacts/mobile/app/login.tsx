import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, Image,
  Alert, Linking, Animated, useWindowDimensions, useColorScheme,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { welcomeIllustrationXml } from '@/constants/welcomeIllustration';

type OtpAutofillModule = typeof import('expo-otp-autofill');
const androidOtpAutofill: OtpAutofillModule | null = (() => {
  if (Platform.OS !== 'android') return null;
  try {
    return require('expo-otp-autofill') as OtpAutofillModule;
  } catch {
    // Expo Go does not include this native module; manual OTP entry remains available.
    return null;
  }
})();

const PRIVACY_URL = 'https://quickprop.melios.co.zw/privacy';
const TERMS_URL = 'https://quickprop.melios.co.zw/terms';
const openUrl = (url: string) => {
  Linking.openURL(url).catch(() => Alert.alert('Could not open link', url));
};

type Mode = 'welcome' | 'phone';

export default function LoginScreen() {
  const colors = useColors();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { startPhoneLogin, verifyPhoneLogin, signInWithPasskey, registerPasskey } = useAuth();
  const [mode, setMode] = useState<Mode>('welcome');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const phoneRef = useRef(phone);
  const phoneCodeSentRef = useRef(phoneCodeSent);
  const autoVerifyingRef = useRef(false);
  const retrievedOtpRef = useRef<string | null>(null);
  const verifyOtpRef = useRef<(code: string) => Promise<void>>(async () => {});
  phoneRef.current = phone;
  phoneCodeSentRef.current = phoneCodeSent;

  const fade = useRef(new Animated.Value(1)).current;
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    rise.setValue(16);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [mode, phoneCodeSent, fade, rise]);

  const go = (next: Mode) => {
    void Haptics.selectionAsync().catch(() => {});
    setMode(next);
  };

  useEffect(() => {
    if (!androidOtpAutofill) return;
    const subscription = androidOtpAutofill.addListener('onOtpReceived', ({ message }) => {
      const code = androidOtpAutofill.extractOtp(message, { length: [4, 10] });
      if (!code) return;
      retrievedOtpRef.current = code;
      setPhoneCode(code);
      if (phoneCodeSentRef.current && !autoVerifyingRef.current) {
        autoVerifyingRef.current = true;
        void verifyOtpRef.current(code).finally(() => {
          autoVerifyingRef.current = false;
        });
      }
    });
    return () => {
      subscription.remove();
      void androidOtpAutofill.stopSmsRetrieverAsync().catch(() => {});
    };
  }, []);

  const handleSendPhoneCode = async () => {
    if (!phone.trim()) { Alert.alert('Mobile number required', 'Enter your mobile number, including country code.'); return; }
    if (!smsConsent) { Alert.alert('SMS consent required', 'Please agree to receive the one-time sign-in code by SMS.'); return; }
    setLoading(true);
    let androidAppHash: string | undefined;
    if (androidOtpAutofill) {
      try {
        setPhoneCode('');
        phoneCodeSentRef.current = false;
        retrievedOtpRef.current = null;
        await androidOtpAutofill.startSmsRetrieverAsync();
        androidAppHash = await androidOtpAutofill.getAppHashAsync();
      } catch (error) {
        console.warn('Android SMS Retriever could not start; continuing with manual code entry.', error);
      }
    }
    const result = await startPhoneLogin(phone.trim(), smsConsent, androidAppHash);
    setLoading(false);
    if (result.success) {
      phoneCodeSentRef.current = true;
      setPhoneCodeSent(true);
      const receivedCode = retrievedOtpRef.current;
      if (receivedCode && !autoVerifyingRef.current) {
        autoVerifyingRef.current = true;
        void verifyOtpRef.current(receivedCode).finally(() => {
          autoVerifyingRef.current = false;
        });
      }
    }
    else Alert.alert('Could not send code', result.error || 'Please try again.');
  };

  const handleVerifyPhoneCode = async (codeValue = phoneCode) => {
    const cleanCode = codeValue.replace(/\D/g, '');
    if (cleanCode.length < 4) return;
    setLoading(true);
    const result = await verifyPhoneLogin(phone.trim(), cleanCode);
    setLoading(false);
    if (result.success) {
      Alert.alert('Signed in', 'Would you like to add a passkey for faster sign-in on this device?', [
        { text: 'Not now', style: 'cancel', onPress: () => router.replace('/(tabs)') },
        { text: 'Add passkey', onPress: async () => {
          const added = await registerPasskey();
          if (!added.success) Alert.alert('Passkey not added', added.error || 'Try again from your next sign-in.');
          router.replace('/(tabs)');
        } },
      ]);
    }
    else Alert.alert('Sign-in failed', result.error || 'Check the code and try again.');
  };
  verifyOtpRef.current = handleVerifyPhoneCode;

  const handlePasskeyLogin = async () => {
    setLoading(true);
    const result = await signInWithPasskey();
    setLoading(false);
    if (result.success) router.replace('/(tabs)');
    else Alert.alert('Passkey sign-in', result.error || 'No passkey is available for this account yet. Sign in with SMS first to add one.');
  };

  // Palette: deep navy hero, emerald action, derived from the QuickProp identity.
  const heroBg = dark ? '#071322' : '#12396E';
  const sheetBg = dark ? colors.card : '#FFFFFF';
  const emerald = '#0FBF8A';
  const onEmerald = '#04281D';
  const compact = height < 700;
  const illoSize = mode === 'welcome' ? (compact ? 190 : 250) : 112;

  const inputBox = [styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }];

  const Primary = ({ label, onPress, icon }: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) => (
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.bigBtn, { backgroundColor: emerald, opacity: loading ? 0.7 : 1 }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? <ActivityIndicator color={onEmerald} /> : (
        <>
          {icon ? <Ionicons name={icon} size={22} color={onEmerald} /> : null}
          <Text style={[styles.bigBtnText, { color: onEmerald }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );

  const Back = ({ onPress }: { onPress: () => void }) => (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} style={styles.back} hitSlop={10}>
      <Ionicons name="arrow-back" size={20} color={colors.foreground} />
      <Text style={[styles.backText, { color: colors.foreground }]}>Back</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.flex, { backgroundColor: heroBg }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.hero, { paddingTop: insets.top + (compact ? 14 : 24) }]}>
          <View style={styles.brandRow}>
            <Image
              source={require('../assets/images/quickprop-house-mark-white.png')}
              style={styles.brandIcon}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="QuickProp house logo"
            />
            <Text style={styles.brandText}>QuickProp</Text>
          </View>
          <View style={[styles.illoWrap, { width: illoSize, height: illoSize, borderRadius: illoSize / 2 }]}>
            <SvgXml xml={welcomeIllustrationXml} width={illoSize} height={illoSize} />
          </View>
          {mode === 'welcome' && (
            <Text style={styles.tagline} accessibilityRole="header">
              Every listing, lead and viewing. One tap away.
            </Text>
          )}
        </View>

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: sheetBg, paddingBottom: insets.bottom + 20, opacity: fade, transform: [{ translateY: rise }] },
          ]}
        >
          {mode === 'welcome' && (
            <>
              <Text style={[styles.title, { color: colors.foreground }]}>Welcome to QuickProp</Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                Built for Zimbabwe's property agents. Sign in fast and get back to closing.
              </Text>
              <View style={styles.stack}>
                {Platform.OS !== 'web' && (
                  <Primary label="Continue with passkey" icon="finger-print" onPress={handlePasskeyLogin} />
                )}
                <TouchableOpacity
                  testID="phone-sign-in"
                  accessibilityRole="button"
                  style={[styles.bigBtn, { backgroundColor: dark ? colors.secondary : '#EAF0FA' }]}
                  onPress={() => go('phone')}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <Ionicons name="call" size={20} color={colors.foreground} />
                  <Text style={[styles.bigBtnText, { color: colors.foreground }]}>Continue with phone number</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {mode === 'phone' && (
            <>
              <Back onPress={() => (phoneCodeSent ? setPhoneCodeSent(false) : go('welcome'))} />
              <Text style={[styles.title, { color: colors.foreground }]}>
                {phoneCodeSent ? 'Enter your code' : 'Your mobile number'}
              </Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                {phoneCodeSent ? `We sent a code to ${phone.trim()}. It fills in automatically when we can read it.` : 'Include the country code. We will text you a one-time code.'}
              </Text>
              <View style={styles.stack}>
                {!phoneCodeSent && (
                  <View style={inputBox}>
                    <Ionicons name="call-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: colors.foreground }]}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="+263771234567"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      accessibilityLabel="Mobile number"
                    />
                  </View>
                )}
                {phoneCodeSent && (
                  <View style={inputBox}>
                    <Ionicons name="key-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, styles.codeInput, { color: colors.foreground }]}
                      value={phoneCode}
                      onChangeText={(value) => {
                        const digits = value.replace(/\D/g, '').slice(0, 10);
                        setPhoneCode(digits);
                        if (digits.length === 6) void handleVerifyPhoneCode(digits);
                      }}
                      placeholder="Verification code"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      autoComplete="sms-otp"
                      textContentType="oneTimeCode"
                      maxLength={10}
                      accessibilityLabel="Verification code"
                    />
                  </View>
                )}
                {!phoneCodeSent && (
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: smsConsent }}
                    onPress={() => setSmsConsent((value) => !value)}
                    style={styles.consent}
                  >
                    <Ionicons name={smsConsent ? 'checkbox' : 'square-outline'} size={22} color={smsConsent ? '#0A9C70' : colors.mutedForeground} />
                    <Text style={[styles.consentText, { color: colors.mutedForeground }]}>
                      I agree to QuickProp SMS sign-in codes. Msg/data rates may apply; reply STOP to opt out or HELP for help.
                    </Text>
                  </TouchableOpacity>
                )}
                <Primary
                  label={phoneCodeSent ? 'Verify code' : 'Send code'}
                  onPress={phoneCodeSent ? () => handleVerifyPhoneCode() : handleSendPhoneCode}
                />
                {phoneCodeSent && (
                  <TouchableOpacity accessibilityRole="button" onPress={handleSendPhoneCode} disabled={loading} style={styles.textBtn}>
                    <Text style={[styles.textBtnLabel, { color: colors.foreground }]}>Resend code</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          <Text style={[styles.legal, { color: colors.mutedForeground }]}>
            By continuing you accept our{' '}
            <Text style={[styles.legalLink, { color: colors.foreground }]} accessibilityRole="link" onPress={() => openUrl(TERMS_URL)}>Terms</Text>
            {' '}and{' '}
            <Text style={[styles.legalLink, { color: colors.foreground }]} accessibilityRole="link" onPress={() => openUrl(PRIVACY_URL)}>Privacy Policy</Text>.
          </Text>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 22, gap: 14 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  brandIcon: { width: 36, height: 36, borderRadius: 10 },
  brandText: { color: '#F3F7FF', fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  illoWrap: { backgroundColor: 'rgba(15,191,138,0.16)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tagline: { color: '#F3F7FF', fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.6, lineHeight: 30, maxWidth: 320 },
  sheet: {
    flexGrow: 1, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 22, paddingTop: 26,
  },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: 14.5, lineHeight: 21, marginBottom: 18 },
  stack: { gap: 12 },
  bigBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 58, borderRadius: 18, paddingHorizontal: 16,
  },
  bigBtnText: { fontSize: 16, fontWeight: '700' },
  textBtn: { alignItems: 'center', paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  textBtnLabel: { fontSize: 14.5, fontWeight: '600' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, alignSelf: 'flex-start', minHeight: 32 },
  backText: { fontSize: 14, fontWeight: '600' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, height: 58 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, height: '100%' },
  codeInput: { letterSpacing: 4, fontWeight: '700' },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  consentText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  legal: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 'auto', paddingTop: 22 },
  legalLink: { fontWeight: '700', textDecorationLine: 'underline' },
});
