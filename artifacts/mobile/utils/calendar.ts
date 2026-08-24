import { Linking, Platform, Share } from 'react-native';

type CalendarModule = {
  EntityTypes: { EVENT: string };
  requestCalendarPermissionsAsync: () => Promise<{ granted: boolean; canAskAgain: boolean }>;
  getCalendarsAsync: (entityType: string) => Promise<Array<{ id: string; allowsModifications?: boolean; isPrimary?: boolean }>>;
  createEventAsync: (calendarId: string, event: {
    title: string;
    startDate: Date;
    endDate: Date;
    location?: string;
    notes?: string;
  }) => Promise<string>;
};

type FileSystemModule = {
  cacheDirectory?: string;
  documentDirectory?: string;
  writeAsStringAsync: (uri: string, contents: string, options?: { encoding?: string }) => Promise<void>;
  EncodingType?: { UTF8?: string };
};

type SharingModule = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (uri: string, options?: { mimeType?: string; dialogTitle?: string; UTI?: string }) => Promise<void>;
};

export interface CalendarEventDetails {
  title: string;
  startDate: Date;
  location?: string;
  notes?: string;
}

export type CalendarResult =
  | { ok: true; mode: 'calendar' | 'export' }
  | { ok: false; reason: 'unavailable' | 'permission-denied' | 'permission-blocked' | 'export-unavailable' | 'error' };

// These optional modules are intentionally loaded at runtime. This keeps the app
// usable in Expo Go/builds that do not include expo-calendar or expo-file-system.
const optionalModule = <T,>(name: string): T | null => {
  try {
    // Metro exposes require globally in native builds. eval prevents a missing
    // optional package from being resolved while this app is bundled.
    const runtimeRequire = (0, eval)('require') as (moduleName: string) => T;
    return runtimeRequire(name);
  } catch {
    return null;
  }
};

const escapeIcs = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

const toIcsDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const icsFor = ({ title, startDate, location, notes }: CalendarEventDetails) => {
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//QuickProp//Agent//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:quickprop-${Date.now()}@quickprop`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(startDate)}`,
    `DTEND:${toIcsDate(endDate)}`,
    `SUMMARY:${escapeIcs(title)}`,
    location ? `LOCATION:${escapeIcs(location)}` : '',
    notes ? `DESCRIPTION:${escapeIcs(notes)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].filter(Boolean).join('\r\n');
};

export async function addToDeviceCalendar(event: CalendarEventDetails): Promise<CalendarResult> {
  if (Platform.OS === 'web') return { ok: false, reason: 'unavailable' };
  const Calendar = optionalModule<CalendarModule>('expo-calendar');
  if (!Calendar) return { ok: false, reason: 'unavailable' };

  try {
    const permission = await Calendar.requestCalendarPermissionsAsync();
    if (!permission.granted) {
      return { ok: false, reason: permission.canAskAgain ? 'permission-denied' : 'permission-blocked' };
    }
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const calendar = calendars.find(item => item.allowsModifications && item.isPrimary)
      ?? calendars.find(item => item.allowsModifications);
    if (!calendar) return { ok: false, reason: 'unavailable' };
    await Calendar.createEventAsync(calendar.id, {
      ...event,
      endDate: new Date(event.startDate.getTime() + 60 * 60 * 1000),
    });
    return { ok: true, mode: 'calendar' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function exportCalendarEvent(event: CalendarEventDetails): Promise<CalendarResult> {
  const ics = icsFor(event);
  if (Platform.OS === 'web') {
    try {
      await Linking.openURL(`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`);
      return { ok: true, mode: 'export' };
    } catch {
      return { ok: false, reason: 'error' };
    }
  }

  const FileSystem = optionalModule<FileSystemModule>('expo-file-system/legacy')
    ?? optionalModule<FileSystemModule>('expo-file-system');
  const Sharing = optionalModule<SharingModule>('expo-sharing');
  const directory = FileSystem?.cacheDirectory ?? FileSystem?.documentDirectory;
  if (FileSystem && Sharing && directory && await Sharing.isAvailableAsync()) {
    try {
      const uri = `${directory}quickprop-event-${Date.now()}.ics`;
      await FileSystem.writeAsStringAsync(uri, ics, { encoding: FileSystem.EncodingType?.UTF8 });
      await Sharing.shareAsync(uri, {
        mimeType: 'text/calendar',
        UTI: 'com.apple.ical.ics',
        dialogTitle: 'Export QuickProp calendar event',
      });
      return { ok: true, mode: 'export' };
    } catch {
      return { ok: false, reason: 'error' };
    }
  }

  try {
    await Share.share({ title: event.title, message: ics });
    return { ok: true, mode: 'export' };
  } catch {
    return { ok: false, reason: 'export-unavailable' };
  }
}