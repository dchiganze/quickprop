import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

export function FeatureChip({ label, selected, onToggle }: Props) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.muted,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      {selected && <Ionicons name="checkmark" size={13} color="#FFF" />}
      <Text style={[styles.label, { color: selected ? '#FFF' : colors.foreground }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    margin: 4,
  },
  label: { fontSize: 13, fontWeight: '500' },
});
