import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

// Expo Go's bundled Android notifications native module can lag the SDK patch
// installed by the project. Keep it out of the startup module graph there.
export const supportsNativePush =
  Platform.OS !== 'web' &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
