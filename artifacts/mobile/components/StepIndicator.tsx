import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  currentStep: number;
  totalSteps: number;
  stepLabel?: string;
}

export function StepIndicator({ currentStep, totalSteps, stepLabel }: Props) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < currentStep ? colors.primary : i === currentStep ? colors.accent : colors.border,
                flex: i === currentStep ? 2.5 : 1,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        Step {currentStep + 1} of {totalSteps}{stepLabel ? ` — ${stepLabel}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', gap: 4, height: 4 },
  dot: { height: 4, borderRadius: 2 },
  label: { fontSize: 12, fontWeight: '500' },
});
