// This screen exists only so Expo Router registers the "share" route.
// The tab press is intercepted in _layout.tsx and opens ShareHubSheet instead,
// so this screen should never actually render. If it does, redirect home.
import { Redirect } from 'expo-router';
export default function ShareScreen() {
  return <Redirect href="/(tabs)" />;
}
