import React from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  subtitle?: string;
  onPress?: () => void;
  testID?: string;
}

export function StatCard({ label, value, icon, color, subtitle, onPress, testID }: Props) {
  const colors = useColors();
  const iconColor = color || colors.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.foreground },
        pressed && onPress ? { opacity: 0.7 } : undefined,
      ]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${value}`}
      testID={testID}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconColor + '15' }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, { color: colors.mutedForeground }]} numberOfLines={1} adjustsFontSizeToFit>
          {label}
        </Text>
        <Text style={[styles.value, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: iconColor }]} numberOfLines={1} adjustsFontSizeToFit>
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    height: 72,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  iconWrap: {
    width: 28, height: 28, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  value: { fontSize: 30, lineHeight: 33, fontWeight: '800' },
  label: { fontSize: 15, lineHeight: 18, fontWeight: '500' },
  subtitle: { fontSize: 13.5, lineHeight: 15, fontWeight: '600' },
});