import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

// Expo Go's bundled Android notifications native module can lag the SDK patch
// installed by the project. Keep it out of the startup module graph there, but
// don't classify installed production builds as Expo Go based on executionEnvironment alone.
const isExpoGo = Constants.appOwnership === 'expo'
  || (
    Constants.appOwnership == null
    && Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );

export const supportsNativePush =
  Platform.OS !== 'web' &&
  !isExpoGo;
