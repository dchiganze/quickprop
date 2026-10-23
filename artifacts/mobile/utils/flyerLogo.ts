import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

/** Pick a logo and copy it into the app document directory so it outlives the picker cache. */
export async function pickAndPersistLogo(scope: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo library permission is needed to choose a logo.');
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false });
  if (res.canceled || !res.assets[0]?.uri) return null;
  const fs = FileSystem;
  if (!fs.documentDirectory) throw new Error('Device storage is unavailable, so the logo cannot be saved.');
  const dir = `${fs.documentDirectory}flyer-logos/`;
  await fs.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  const ext = (res.assets[0].uri.split('?')[0].match(/\.(png|jpe?g|webp)$/i)?.[1] ?? 'jpg').toLowerCase();
  const to = `${dir}${scope.replace(/[^a-z0-9_-]/gi, '_')}-${Date.now()}.${ext}`;
  await fs.copyAsync({ from: res.assets[0].uri, to });
  return to;
}
