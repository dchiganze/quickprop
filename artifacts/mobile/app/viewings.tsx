import React, { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/contexts/DataContext';
import { useColors } from '@/hooks/useColors';
import { addToDeviceCalendar } from '@/utils/calendar';

export default function UpcomingViewingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { viewings, properties } = useData();

  const upcoming = useMemo(() => viewings
    .filter((viewing) => viewing.status === 'scheduled' && new Date(viewing.scheduledAt).getTime() >= Date.now())
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()), [viewings]);

  const addViewingToCalendar = async (viewing: typeof upcoming[number]) => {
    const property = properties.find((item) => item.id === String(viewing.propertyId));
    const address = property ? `${property.address}, ${property.suburb}` : `Property ${viewing.propertyId}`;
    const result = await addToDeviceCalendar({
      title: `QuickProp viewing · ${property?.referenceNumber ?? address}`,
      startDate: new Date(viewing.scheduledAt),
      location: address,
      notes: `Buyer: ${viewing.buyerName || 'Not specified'}${viewing.notes ? `\n${viewing.notes}` : ''}`,
    });
    if (result.ok) {
      Alert.alert('Added to calendar', 'This viewing was added to the writable calendar on your device.');
    } else if (result.reason === 'unavailable') {
      Alert.alert('Calendar unavailable', 'Calendar access is not available in this app session. Try again in the installed app.');
    } else if (result.reason === 'permission-blocked') {
      Alert.alert('Calendar access blocked', 'Enable calendar access in your device settings, then try again.');
    } else if (result.reason === 'permission-denied') {
      Alert.alert('Calendar permission needed', 'Allow QuickProp to access your calendar to add this viewing.');
    } else {
      Alert.alert('Could not add viewing', 'Please try again.');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.foreground }]}>Upcoming Viewings</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Your scheduled property appointments</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {upcoming.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No upcoming viewings</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Scheduled property appointments will appear here.</Text>
          </View>
        ) : upcoming.map((viewing) => {
          const property = properties.find((item) => item.id === String(viewing.propertyId));
          const address = property ? `${property.address}, ${property.suburb}` : `Property ${viewing.propertyId}`;
          const start = new Date(viewing.scheduledAt);
          return (
            <View key={viewing.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <View style={[styles.dateIcon, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="calendar" size={18} color={colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.date, { color: colors.foreground }]}>
                    {start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' · '}
                    {start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                  <Text style={[styles.address, { color: colors.mutedForeground }]}>{address}</Text>
                </View>
              </View>
              <View style={[styles.detailRow, { borderTopColor: colors.border }]}>
                <Ionicons name="person-outline" size={16} color={colors.mutedForeground} />
                <Text style={[styles.detailText, { color: colors.mutedForeground }]}>{viewing.buyerName || 'Buyer not specified'}</Text>
              </View>
              {viewing.notes ? <Text style={[styles.notes, { color: colors.mutedForeground }]}>{viewing.notes}</Text> : null}
              <TouchableOpacity
                style={[styles.calendarButton, { borderColor: colors.border }]}
                onPress={() => void addViewingToCalendar(viewing)}
                activeOpacity={0.75}
              >
                <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                <Text style={[styles.calendarButtonText, { color: colors.primary }]}>Add to device calendar</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 18 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerText: { flex: 1 },
  title: { fontSize: 25, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 3 },
  content: { paddingHorizontal: 18, paddingTop: 4, gap: 12 },
  emptyCard: { borderWidth: 1, borderRadius: 20, padding: 28, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateIcon: { height: 42, width: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  date: { fontSize: 15, fontWeight: '700' },
  address: { fontSize: 13, marginTop: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 13 },
  detailText: { fontSize: 13 },
  notes: { fontSize: 13, lineHeight: 18, marginTop: 10 },
  calendarButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 11, marginTop: 14 },
  calendarButtonText: { fontSize: 13, fontWeight: '700' },
});
