import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';

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

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, startPhoneLogin, verifyPhoneLogin, signInWithPasskey, registerPasskey } = useAuth();
  const [email, setEmail] = useState('demo@quickprop.co.zw');
  const [password, setPassword] = useState('demo1234');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneMode, setPhoneMode] = useState(true);
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

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await login(email.trim(), password);
    setLoading(false);
    if (result.success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('Login Failed', result.error || 'Invalid credentials.');
    }
  };

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

  const handleSocial = async (provider: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    const result = await login(`demo.${provider}@quickprop.co.zw`, 'demo1234');
    setLoading(false);
    if (result.success) router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.brand}>
          <Image
            source={require('../assets/images/quickprop-agent-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="QuickProp Agent"
          />
        </View>

        <Text style={[styles.heading, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
          Sign in to manage your property portfolio
        </Text>

        {/* Form */}
        <View style={styles.form}>
          {phoneMode ? (
            <>
              <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Ionicons name="call-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Mobile number, e.g. +263771234567"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                />
              </View>
              {phoneCodeSent && (
                <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <Ionicons name="key-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
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
                  />
                </View>
              )}
              {!phoneCodeSent && (
                <TouchableOpacity
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: smsConsent }}
                  onPress={() => setSmsConsent((value) => !value)}
                  style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 }}
                >
                  <Ionicons name={smsConsent ? 'checkbox' : 'square-outline'} size={20} color={smsConsent ? colors.primary : colors.mutedForeground} />
                  <Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
                    I agree to receive one-time SMS sign-in codes from QuickProp. Message and data rates may apply. Message frequency varies. Reply STOP to opt out or HELP for help.
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: loading ? colors.primary + '80' : colors.primary }]}
                onPress={phoneCodeSent ? () => handleVerifyPhoneCode() : handleSendPhoneCode}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{phoneCodeSent ? 'Verify code' : 'Send code'}</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
          <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: loading ? colors.primary + '80' : colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Sign In</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
          </TouchableOpacity>
              <TouchableOpacity style={styles.forgotBtn} onPress={() => setPhoneMode(true)}>
                <Text style={[styles.forgotText, { color: colors.primary }]}>Sign in with mobile number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {Platform.OS !== 'web' && (
          <>
            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </View>
            <TouchableOpacity
              testID="passkey-sign-in"
              accessibilityRole="button"
              style={[styles.primaryBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
              onPress={handlePasskeyLogin}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color={colors.primary} /> : (
                <>
                  <Ionicons name="finger-print-outline" size={20} color={colors.primary} />
                  <Text style={[styles.primaryBtnText, { color: colors.foreground }]}>Sign in with passkey</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 28 },
  brand: { width: '100%', alignItems: 'center', marginBottom: 32 },
  logo: { width: '100%', maxWidth: 346, height: 54, alignSelf: 'center' },
  heading: { fontSize: 30, fontWeight: '800', marginBottom: 6, letterSpacing: -0.5 },
  subheading: { fontSize: 15, marginBottom: 28, lineHeight: 22 },
  form: { gap: 14 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, height: 54,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15 },
  eyeBtn: { padding: 4 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, height: 54,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  forgotBtn: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { fontSize: 14, fontWeight: '500' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  socialRow: { flexDirection: 'row', gap: 10 },
  socialBtn: {
    flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 14, borderWidth: 1, paddingVertical: 14,
  },
  socialText: { fontSize: 12, fontWeight: '500' },
  demoHint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 24, padding: 12, borderRadius: 10, borderWidth: 1,
  },
  demoText: { fontSize: 13, fontWeight: '500', flex: 1 },
});
