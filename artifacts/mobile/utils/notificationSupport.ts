import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supportsNativePushForRuntime } from '@/lib/notification-support';

// Expo Go's bundled Android notifications native module can lag the SDK patch
// installed by the project. Keep it out of the startup module graph there, but
// identify it by app ownership so a standalone build is never treated as Expo Go.
export const supportsNativePush = supportsNativePushForRuntime(
  Platform.OS,
  Constants.appOwnership,
);
