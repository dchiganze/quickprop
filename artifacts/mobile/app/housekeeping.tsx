import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  applyListingHousekeepingAction,
  confirmListingHousekeeping,
  getListingHousekeeping,
  type ListingHousekeepingItem,
  type ListingHousekeepingResponse,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/contexts/DataContext";
import { useNetworkStatus } from "@/contexts/ConnectivityContext";

const CACHE_KEY = "@qp_listing_housekeeping";
const QUEUE_KEY = "@qp_listing_housekeeping_queue";
type PendingAction = { action: "confirm" | "mark_unavailable" | "reactivate"; propertyId: number; relationshipId?: number | null };

const LABELS: Record<string, string> = {
  new: "New listing",
  fresh: "Fresh",
  due: "Due for confirmation",
  update_required: "Update required",
  potentially_stale: "Potentially stale",
  stale: "Stale",
  inactive: "Inactive",
};
const COLORS: Record<string, string> = {
  new: "#0EA5E9",
  fresh: "#10B981",
  due: "#F59E0B",
  update_required: "#F97316",
  potentially_stale: "#E11D48",
  stale: "#DC2626",
  inactive: "#64748B",
};

function localHousekeeping(properties: ReturnType<typeof useData>["properties"]): ListingHousekeepingResponse {
  const listings: ListingHousekeepingItem[] = properties
    .filter((property) => property.status !== "archived")
    .map((property, index) => {
      const days = Math.max(0, Math.floor((Date.now() - new Date(property.updatedAt).getTime()) / 86400000));
      const freshnessStatus = property.freshnessStatus ?? (days > 30 ? "stale" : days > 14 ? "potentially_stale" : "fresh");
      return {
        id: Number(property.id) || index + 1,
        propertyId: Number(property.id) || index + 1,
        relationshipId: null,
        agentId: Number(property.agentId) || null,
        agencyId: null,
        reference: property.referenceNumber,
        title: property.address || "Untitled listing",
        suburb: property.suburb,
        city: "Harare",
        price: property.price,
        currency: property.currency,
        status: property.status,
        availabilityStatus: property.availabilityStatus ?? "available",
        freshnessStatus,
        freshnessLabel: days === 0 ? "Updated today" : `Updated ${days} days ago`,
        lastConfirmedAt: property.lastConfirmedAt ?? null,
        lastUpdate: property.updatedAt,
        nextConfirmationAt: property.nextConfirmationAt ?? null,
        daysSinceConfirmation: days,
        freshnessScore: property.freshnessScore ?? Math.max(0, 100 - days),
        qualityScore: property.qualityScore ?? 0,
        reminderCount: 0,
        staleSince: null,
        photos: property.photos,
        bedrooms: property.bedrooms ?? null,
        bathrooms: property.bathrooms ?? null,
      };
    });
  const summary = listings.reduce<Record<string, number>>((result, listing) => {
    result[listing.freshnessStatus] = (result[listing.freshnessStatus] ?? 0) + 1;
    return result;
  }, {});
  return { listings, summary: { total: listings.length, ...summary }, thresholds: {
    softReminderDays: 7,
    firstConfirmationDays: 14,
    recurringConfirmationDays: 30,
    updateRequiredOverdueDays: 7,
    potentiallyStaleOverdueDays: 14,
    staleOverdueDays: 30,
  } };
}

export default function HousekeepingScreen() {
  const colors = useColors();
  const { properties } = useData();
  const network = useNetworkStatus();
  const [data, setData] = useState<ListingHousekeepingResponse>(() => localHousekeeping(properties));
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const saveQueueCount = useCallback(async () => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    setPendingCount(raw ? JSON.parse(raw).length : 0);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const remote = await getListingHousekeeping();
      setData(remote);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote));
      await saveQueueCount();
    } catch {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) setData(JSON.parse(cached));
    } finally {
      setRefreshing(false);
    }
  }, [saveQueueCount]);

  const flushQueue = useCallback(async () => {
    if (!network.isOnline) return;
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: PendingAction[] = raw ? JSON.parse(raw) : [];
    if (!queue.length) return;
    const remaining: PendingAction[] = [];
    for (const pending of queue) {
      try {
        if (pending.action === "confirm") {
          await confirmListingHousekeeping({ propertyId: pending.propertyId, relationshipId: pending.relationshipId ?? undefined });
        } else {
          await applyListingHousekeepingAction({ propertyId: pending.propertyId, relationshipId: pending.relationshipId ?? undefined, action: pending.action });
        }
      } catch {
        remaining.push(pending);
      }
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    setPendingCount(remaining.length);
    if (remaining.length !== queue.length) refresh();
  }, [network.isOnline, refresh]);

  useEffect(() => {
    const cached = AsyncStorage.getItem(CACHE_KEY).then((raw) => { if (raw) setData(JSON.parse(raw)); });
    refresh();
    saveQueueCount();
    return () => { void cached; };
  }, [refresh, saveQueueCount]);

  useEffect(() => { flushQueue(); }, [flushQueue]);

  const needsAttention = useMemo(() => data.listings.filter((listing) => ["due", "update_required", "potentially_stale", "stale"].includes(listing.freshnessStatus)).length, [data.listings]);
  const optimistic = (listing: ListingHousekeepingItem, action: PendingAction["action"]) => {
    setData((current) => ({
      ...current,
      listings: current.listings.map((item) => item.id !== listing.id ? item : {
        ...item,
        freshnessStatus: action === "confirm" || action === "reactivate" ? "fresh" : "inactive",
        availabilityStatus: action === "confirm" || action === "reactivate" ? "available" : "temporarily_unavailable",
        freshnessLabel: action === "confirm" ? "Updated today" : "Inactive until reactivated",
        daysSinceConfirmation: 0,
        freshnessScore: action === "confirm" || action === "reactivate" ? 100 : 0,
      }),
    }));
  };
  const act = async (listing: ListingHousekeepingItem, action: PendingAction["action"]) => {
    optimistic(listing, action);
    try {
      if (action === "confirm") await confirmListingHousekeeping({ propertyId: listing.propertyId, relationshipId: listing.relationshipId ?? undefined });
      else await applyListingHousekeepingAction({ propertyId: listing.propertyId, relationshipId: listing.relationshipId ?? undefined, action });
      await refresh();
    } catch {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      const queue: PendingAction[] = raw ? JSON.parse(raw) : [];
      queue.push({ action, propertyId: listing.propertyId, relationshipId: listing.relationshipId });
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      setPendingCount(queue.length);
      Alert.alert("Saved offline", "Your action is on the device queue and will sync when you reconnect.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={26} color={colors.foreground} /></TouchableOpacity>
        <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.foreground }]}>Listing housekeeping</Text><Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{needsAttention} need attention{pendingCount ? ` · ${pendingCount} queued offline` : ""}</Text></View>
        <Ionicons name="sparkles-outline" size={24} color={colors.primary} />
      </View>
      {!network.isOnline && <View style={[styles.offline, { backgroundColor: colors.secondary }]}><Ionicons name="cloud-offline-outline" size={16} color={colors.primary} /><Text style={[styles.offlineText, { color: colors.foreground }]}>Offline mode — actions will sync automatically.</Text></View>}
      <View style={styles.summaryRow}>
        {[
          ["fresh", "Fresh"], ["due", "Due"], ["update_required", "Update"], ["stale", "Stale"],
        ].map(([key, label]) => <View key={key} style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.summaryNumber, { color: COLORS[key] }]}>{data.summary[key] ?? 0}</Text><Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text></View>)}
      </View>
      <FlatList
        data={data.listings}
        keyExtractor={(item) => `${item.propertyId}-${item.relationshipId ?? "property"}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardTop}><View style={[styles.dot, { backgroundColor: COLORS[item.freshnessStatus] ?? colors.mutedForeground }]} /><View style={styles.cardCopy}><Text style={[styles.reference, { color: colors.foreground }]}>{item.reference}</Text><Text style={[styles.address, { color: colors.mutedForeground }]} numberOfLines={1}>{item.title}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{item.suburb} · {item.daysSinceConfirmation} days since confirmation</Text></View><Text style={[styles.score, { color: COLORS[item.freshnessStatus] ?? colors.primary }]}>{item.freshnessScore}</Text></View>
            <View style={styles.statusLine}><Text style={[styles.status, { color: COLORS[item.freshnessStatus] ?? colors.foreground }]}>{LABELS[item.freshnessStatus] ?? item.freshnessStatus}</Text><Text style={[styles.quality, { color: colors.mutedForeground }]}>Quality {item.qualityScore}</Text></View>
            <View style={styles.actions}><TouchableOpacity style={[styles.primaryAction, { backgroundColor: colors.primary }]} onPress={() => act(item, "confirm")}><Ionicons name="checkmark-circle-outline" size={17} color="#FFF" /><Text style={styles.primaryText}>Confirm</Text></TouchableOpacity>{item.freshnessStatus !== "inactive" ? <TouchableOpacity style={[styles.secondaryAction, { borderColor: colors.border }]} onPress={() => act(item, "mark_unavailable")}><Text style={[styles.secondaryText, { color: colors.foreground }]}>Unavailable</Text></TouchableOpacity> : <TouchableOpacity style={[styles.secondaryAction, { borderColor: colors.border }]} onPress={() => act(item, "reactivate")}><Text style={[styles.secondaryText, { color: colors.foreground }]}>Reactivate</Text></TouchableOpacity>}</View>
          </View>
        )}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.mutedForeground }]}>No listings need housekeeping.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 58 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 12 },
  back: { padding: 4, marginRight: 8 },
  headerCopy: { flex: 1 },
  title: { fontSize: 22, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 3 },
  offline: { marginHorizontal: 18, marginBottom: 12, padding: 10, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 7 },
  offlineText: { fontSize: 12, flex: 1 },
  summaryRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingBottom: 10 },
  summaryCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10 },
  summaryNumber: { fontSize: 20, fontWeight: "800" },
  summaryLabel: { fontSize: 10, marginTop: 2 },
  list: { padding: 18, paddingTop: 8, gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 15 },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 5, marginRight: 9 },
  cardCopy: { flex: 1 },
  reference: { fontSize: 15, fontWeight: "800" },
  address: { fontSize: 13, marginTop: 3 },
  meta: { fontSize: 11, marginTop: 4 },
  score: { fontSize: 20, fontWeight: "800" },
  statusLine: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  status: { fontSize: 12, fontWeight: "700" },
  quality: { fontSize: 12 },
  actions: { flexDirection: "row", gap: 8, marginTop: 13 },
  primaryAction: { flex: 1, borderRadius: 9, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  primaryText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  secondaryAction: { flex: 1, borderWidth: 1, borderRadius: 9, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontSize: 12, fontWeight: "700" },
  empty: { textAlign: "center", padding: 32 },
});