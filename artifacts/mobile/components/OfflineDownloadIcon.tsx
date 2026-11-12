import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  saved: boolean;
  downloading?: boolean;
  iconSize?: number;
}

export function OfflineDownloadIcon({ saved, downloading = false, iconSize = 16 }: Props) {
  const colors = useColors();

  if (downloading) {
    return <ActivityIndicator size="small" color={colors.accent} />;
  }

  if (!saved) {
    return <Ionicons name="arrow-down" size={iconSize} color={colors.mutedForeground} />;
  }

  const circleSize = iconSize + 16;
  return (
    <View
      style={[
        styles.savedCircle,
        { width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: colors.accent },
      ]}
    >
      <Ionicons name="arrow-down" size={iconSize} color={colors.statusText} />
    </View>
  );
}

const styles = StyleSheet.create({
  savedCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
