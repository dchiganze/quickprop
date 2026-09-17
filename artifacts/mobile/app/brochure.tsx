import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Property } from '@/types';
import { catalogueBrochureHtml, BrochureAgent } from '@/utils/brochureHtml';
import { getListUsersQueryKey, useListUsers } from '@workspace/api-client-react';

type BrochureMode = 'my' | 'company' | 'custom';
type ListingFilter = 'sale' | 'rent';
type PropertyGroup = 'residential' | 'commercial' | 'stand' | 'mine' | 'farm' | 'other_land';
type LandGroupKey = Extract<PropertyGroup, 'stand' | 'mine' | 'farm' | 'other_land'>;
type SetupStep = 'personnel' | 'listing' | 'property';

const LAND_TYPE_GROUPS: Record<string, LandGroupKey> = {
  stand: 'stand',
  stands: 'stand',
  mine: 'mine',
  mines: 'mine',
  mining: 'mine',
  farm: 'farm',
  farms: 'farm',
  other_land: 'other_land',
  land: 'other_land',
  plot: 'other_land',
  vacant_land: 'other_land',
};
const COMMERCIAL_TYPES = new Set(['commercial', 'industrial', 'office', 'retail', 'warehouse', 'shop', 'business']);

function propertyGroup(property: Property): PropertyGroup {
  const type = (property.propertyType ?? property.type).toLowerCase();
  return LAND_TYPE_GROUPS[type] ?? (COMMERCIAL_TYPES.has(type) ? 'commercial' : 'residential');
}

function listingType(property: Property): ListingFilter {
  return property.listingType ?? (property.type === 'rent' ? 'rent' : 'sale');
}

function CheckboxRow({
  checked,
  label,
  detail,
  onPress,
  colors,
}: {
  checked: boolean;
  label: string;
  detail?: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      style={[styles.filterRow, { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary + '12' : colors.card }]}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[styles.checkbox, { borderColor: checked ? colors.primary : colors.mutedForeground, backgroundColor: checked ? colors.primary : 'transparent' }]}>
        {checked && <Ionicons name="checkmark" size={14} color={colors.primaryForeground} />}
      </View>
      <View style={styles.filterCopy}>
        <Text style={[styles.filterLabel, { color: colors.foreground }]}>{label}</Text>
        {detail && <Text style={[styles.filterDetail, { color: colors.mutedForeground }]}>{detail}</Text>}
      </View>
    </Pressable>
  );
}

function ModeCard({
  icon,
  label,
  detail,
  count,
  selected,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  count: number;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      style={[styles.modeCard, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '12' : colors.card }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={[styles.modeIcon, { backgroundColor: selected ? colors.primary : colors.muted }]}>
        <Ionicons name={icon} size={19} color={selected ? colors.primaryForeground : colors.mutedForeground} />
      </View>
      <View style={styles.modeCopy}>
        <Text style={[styles.modeLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.modeDetail, { color: colors.mutedForeground }]}>{detail}</Text>
      </View>
      <View style={[styles.selectedDot, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' }]}>
        {selected && <Ionicons name="checkmark" size={12} color={colors.primaryForeground} />}
      </View>
      <Text style={[styles.modeCount, { color: colors.primary }]}>{count}</Text>
    </TouchableOpacity>
  );
}

export default function BrochureSetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { properties, isLoading } = useData();
  const { data: directoryUsers = [], refetch: refetchDirectoryUsers } = useListUsers({
    query: { enabled: true, queryKey: getListUsersQueryKey() },
  });
  const [mode, setMode] = useState<BrochureMode>('my');
  const [activeStep, setActiveStep] = useState<SetupStep>('personnel');
  const [listingFilters, setListingFilters] = useState<Set<ListingFilter>>(new Set(['sale', 'rent']));
  const [propertyGroups, setPropertyGroups] = useState<Set<PropertyGroup>>(
    new Set(['residential', 'commercial', 'stand', 'mine', 'farm', 'other_land']),
  );
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const publishedProperties = useMemo(
    () => properties.filter((property) => property.status === 'published'),
    [properties],
  );
  const myProperties = useMemo(
    () => publishedProperties.filter((property) => property.agentId === user?.id),
    [publishedProperties, user?.id],
  );
  const selectedProperties = useMemo(
    () => publishedProperties.filter((property) => selectedPropertyIds.has(property.id)),
    [publishedProperties, selectedPropertyIds],
  );
  const sourceProperties = mode === 'my'
    ? myProperties
    : mode === 'custom'
      ? selectedProperties
      : publishedProperties;
  const filteredProperties = useMemo(
    () => sourceProperties.filter((property) =>
      listingFilters.has(listingType(property)) && propertyGroups.has(propertyGroup(property)),
    ),
    [sourceProperties, listingFilters, propertyGroups],
  );
  const agentGroups = useMemo(() => {
    const groups = new Map<string, Property[]>();
    publishedProperties.forEach((property) => {
      const group = groups.get(property.agentId) ?? [];
      group.push(property);
      groups.set(property.agentId, group);
    });
    return [...groups.entries()];
  }, [publishedProperties]);
  const propertyGroupCount = (group: PropertyGroup) =>
    sourceProperties.filter((property) => propertyGroup(property) === group).length;
  const toggleSet = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        if (next.size === 1) return current;
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const toggleAgent = (agentId: string, agentProperties: Property[]) => {
    setSelectedPropertyIds((current) => {
      const next = new Set(current);
      const allSelected = agentProperties.length > 0 && agentProperties.every((property) => next.has(property.id));
      agentProperties.forEach((property) => allSelected ? next.delete(property.id) : next.add(property.id));
      return next;
    });
  };

  const toggleProperty = (propertyId: string) => {
    setSelectedPropertyIds((current) => {
      const next = new Set(current);
      next.has(propertyId) ? next.delete(propertyId) : next.add(propertyId);
      return next;
    });
  };

  const generate = async (action: 'print' | 'share') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLoading(true);
    try {
      const refreshedDirectory = await refetchDirectoryUsers();
      const availableUsers = refreshedDirectory.data ?? directoryUsers;
      const agents: BrochureAgent[] = availableUsers.map((directoryUser) => ({
        id: String(directoryUser.id),
        name: directoryUser.name,
        email: directoryUser.email,
        phone: directoryUser.phone,
      }));
      if (user && !agents.some((directoryUser) => String(directoryUser.id) === String(user.id))) {
        agents.push({
          id: String(user.id),
          name: user.name,
          email: user.email,
          phone: user.phone,
        });
      }
      const Print: typeof import('expo-print') = await import('expo-print');
      const html = catalogueBrochureHtml(filteredProperties, user, mode, agents);
      if (action === 'print') {
        await Print.printAsync({ html });
      } else {
        const Sharing: typeof import('expo-sharing') = await import('expo-sharing');
        const { uri } = await Print.printToFileAsync({ html });
        if (!(await Sharing.isAvailableAsync())) throw new Error('PDF sharing is not available on this device.');
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Property Brochure' });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not generate brochure. Please try again.';
      if (!message.toLowerCase().includes('cancel')) {
        const { Alert } = await import('react-native');
        Alert.alert('Brochure unavailable', message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 36 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>BROCHURE STUDIO</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Build your brochure</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Choose the listings your clients should see.</Text>
          </View>
        </View>

        <View style={styles.stepper}>
          {([
            ['personnel', '01', 'Personnel', mode === 'my' ? 'My listings' : mode === 'company' ? 'Company' : 'Custom agents'],
            ['listing', '02', 'Sale / Rent', `${listingFilters.size} selected`],
            ['property', '03', 'Property type', `${propertyGroups.size} selected`],
          ] as const).map(([step, number, label, detail]) => (
            <TouchableOpacity
              key={step}
              style={[
                styles.stepCard,
                {
                  borderColor: activeStep === step ? colors.primary : colors.border,
                  backgroundColor: activeStep === step ? colors.primary + '12' : colors.card,
                },
              ]}
              onPress={() => setActiveStep(step)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeStep === step }}
            >
              <View style={[styles.stepNumber, { backgroundColor: activeStep === step ? colors.primary : colors.muted }]}>
                <Text style={[styles.stepNumberText, { color: activeStep === step ? colors.primaryForeground : colors.mutedForeground }]}>{number}</Text>
              </View>
              <View style={styles.stepCopy}>
                <Text style={[styles.stepLabel, { color: colors.foreground }]} numberOfLines={1}>{label}</Text>
                <Text style={[styles.stepDetail, { color: colors.mutedForeground }]} numberOfLines={1}>{detail}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {activeStep === 'personnel' && <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SELECT PERSONNEL</Text>
          <ModeCard icon="person-outline" label="My Listings" detail="Your published properties" count={myProperties.length} selected={mode === 'my'} onPress={() => setMode('my')} colors={colors} />
          <ModeCard icon="people-outline" label="Custom Agents" detail="Pick agents and properties" count={selectedPropertyIds.size} selected={mode === 'custom'} onPress={() => setMode('custom')} colors={colors} />
          <ModeCard icon="business-outline" label="Company Brochure" detail="Every published listing" count={publishedProperties.length} selected={mode === 'company'} onPress={() => setMode('company')} colors={colors} />
        </View>}

        {activeStep === 'listing' && <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SALE / RENT</Text>
          <CheckboxRow checked={listingFilters.has('sale')} label="For Sale" detail="Include sales listings only if selected" onPress={() => toggleSet<ListingFilter>(setListingFilters, 'sale')} colors={colors} />
          <CheckboxRow checked={listingFilters.has('rent')} label="To Rent" detail="Include rental listings only if selected" onPress={() => toggleSet<ListingFilter>(setListingFilters, 'rent')} colors={colors} />
        </View>}

        {activeStep === 'property' && <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PROPERTY TYPE</Text>
          <CheckboxRow checked={propertyGroups.has('residential')} label="Residential" detail="Homes, apartments and townhouses" onPress={() => toggleSet<PropertyGroup>(setPropertyGroups, 'residential')} colors={colors} />
          <CheckboxRow checked={propertyGroups.has('commercial')} label="Commercial" detail="Offices, retail and industrial" onPress={() => toggleSet<PropertyGroup>(setPropertyGroups, 'commercial')} colors={colors} />
          <CheckboxRow checked={propertyGroups.has('stand')} label="Stands" detail={`${propertyGroupCount('stand')} available`} onPress={() => toggleSet<PropertyGroup>(setPropertyGroups, 'stand')} colors={colors} />
          <CheckboxRow checked={propertyGroups.has('mine')} label="Mines" detail={`${propertyGroupCount('mine')} available`} onPress={() => toggleSet<PropertyGroup>(setPropertyGroups, 'mine')} colors={colors} />
          <CheckboxRow checked={propertyGroups.has('farm')} label="Farms" detail={`${propertyGroupCount('farm')} available`} onPress={() => toggleSet<PropertyGroup>(setPropertyGroups, 'farm')} colors={colors} />
          <CheckboxRow checked={propertyGroups.has('other_land')} label="Other land" detail={`${propertyGroupCount('other_land')} available`} onPress={() => toggleSet<PropertyGroup>(setPropertyGroups, 'other_land')} colors={colors} />
        </View>}

        {activeStep === 'personnel' && mode === 'custom' && (
          <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CUSTOM SELECTION</Text>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>Pick agents and properties</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPropertyIds(new Set(publishedProperties.map((property) => property.id)))} accessibilityLabel="Select all properties">
                <Text style={[styles.actionText, { color: colors.primary }]}>Select all</Text>
              </TouchableOpacity>
            </View>
            {agentGroups.map(([agentId, agentProperties]) => {
              const selectedCount = agentProperties.filter((property) => selectedPropertyIds.has(property.id)).length;
              const expanded = expandedAgents.has(agentId);
               const agentName = agentId === user?.id ? `${user.name} (My Listings)` : `Agent ${agentId}`;
              return (
                <View key={agentId} style={[styles.agentGroup, { borderTopColor: colors.border }]}>
                  <View style={styles.agentRow}>
                    <CheckboxRow
                      checked={selectedCount === agentProperties.length}
                      label={agentName}
                      detail={`${selectedCount}/${agentProperties.length} selected`}
                      onPress={() => toggleAgent(agentId, agentProperties)}
                      colors={colors}
                    />
                     <TouchableOpacity onPress={() => toggleSet(setExpandedAgents, agentId)} style={styles.expandButton} accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${agentName} listings`}>
                      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                  {expanded && agentProperties.map((property) => (
                    <CheckboxRow
                      key={property.id}
                      checked={selectedPropertyIds.has(property.id)}
                      label={property.title ?? property.address}
                      detail={`${property.referenceNumber} · ${property.suburb}`}
                      onPress={() => toggleProperty(property.id)}
                      colors={colors}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        )}

        <View style={[styles.summary, { backgroundColor: colors.primary }]}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryEyebrow}>BROCHURE CHECK</Text>
              <Text style={styles.summaryTitle}>{filteredProperties.length} matching listings</Text>
            </View>
            <Ionicons name="albums-outline" size={28} color={colors.primaryForeground} />
          </View>
          <Text style={styles.summaryDetail}>
            {filteredProperties.filter((property) => listingType(property) === 'sale').length} for sale · {filteredProperties.filter((property) => listingType(property) === 'rent').length} to rent
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.generateButton, { backgroundColor: colors.primaryForeground }]} onPress={() => generate('print')} disabled={loading || filteredProperties.length === 0}>
              {loading ? <ActivityIndicator color={colors.primary} /> : <><Ionicons name="print-outline" size={18} color={colors.primary} /><Text style={[styles.generateText, { color: colors.primary }]}>Print / Save PDF</Text></>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.generateButton, { borderColor: colors.primaryForeground }]} onPress={() => generate('share')} disabled={loading || filteredProperties.length === 0}>
              <Ionicons name="share-outline" size={18} color={colors.primaryForeground} />
              <Text style={styles.generateTextSecondary}>Share PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingBottom: 24 },
  backButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.7, marginTop: 5 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 5 },
  stepper: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  stepCard: { flex: 1, minHeight: 68, borderWidth: 1.5, borderRadius: 14, padding: 9, gap: 7, justifyContent: 'center' },
  stepNumber: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 10, fontWeight: '800' },
  stepCopy: { minWidth: 0 },
  stepLabel: { fontSize: 11, fontWeight: '800' },
  stepDetail: { fontSize: 10, marginTop: 2 },
  section: { paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  modeCard: { minHeight: 70, borderWidth: 1.5, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  modeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modeCopy: { flex: 1 },
  modeLabel: { fontSize: 14, fontWeight: '800' },
  modeDetail: { fontSize: 12, marginTop: 3 },
  selectedDot: { width: 22, height: 22, borderWidth: 1.5, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  modeCount: { fontSize: 12, fontWeight: '800', minWidth: 22, textAlign: 'right' },
  panel: { marginHorizontal: 20, padding: 16, borderWidth: 1, borderRadius: 18, marginBottom: 16 },
  panelHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  panelTitle: { fontSize: 17, fontWeight: '800', marginTop: -2, marginBottom: 10 },
  actionText: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  filterRow: { minHeight: 56, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 8 },
  checkbox: { width: 21, height: 21, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  filterCopy: { flex: 1 },
  filterLabel: { fontSize: 13, fontWeight: '700' },
  filterDetail: { fontSize: 11, marginTop: 3 },
  agentGroup: { borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  agentRow: { flexDirection: 'row', alignItems: 'center' },
  expandButton: { padding: 8, marginLeft: 4 },
  summary: { marginHorizontal: 20, borderRadius: 20, padding: 18, marginTop: 4 },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  summaryTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 6 },
  summaryDetail: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 6 },
  actions: { gap: 9, marginTop: 18 },
  generateButton: { minHeight: 48, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  generateText: { fontSize: 14, fontWeight: '800' },
  generateTextSecondary: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});