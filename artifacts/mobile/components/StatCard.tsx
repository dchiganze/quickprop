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
}

export function StatCard({ label, value, icon, color, subtitle, onPress }: Props) {
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
    >
      <View style={[styles.iconWrap, { backgroundColor: iconColor + '15' }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: iconColor }]}>{subtitle}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    height: 108,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    alignItems: 'flex-start',
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  iconWrap: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 5,
  },
  value: { fontSize: 23, lineHeight: 27, fontWeight: '800', marginBottom: 1 },
  label: { fontSize: 11, lineHeight: 13, fontWeight: '500' },
  subtitle: { fontSize: 10, lineHeight: 12, fontWeight: '600', marginTop: 2 },
});