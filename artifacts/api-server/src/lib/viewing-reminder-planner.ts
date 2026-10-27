export const VIEWING_REMINDER_TIME_ZONE = "Africa/Harare";
export const VIEWING_REMINDER_START_MINUTE = 7 * 60 + 30;
export const VIEWING_REMINDER_CATCH_UP_MINUTES = 10;

function localDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VIEWING_REMINDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function getViewingReminderDateKey(value: Date): string {
  const parts = localDateParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isViewingReminderWindow(value: Date): boolean {
  const parts = localDateParts(value);
  const minuteOfDay = Number(parts.hour) * 60 + Number(parts.minute);
  return minuteOfDay >= VIEWING_REMINDER_START_MINUTE
    && minuteOfDay < VIEWING_REMINDER_START_MINUTE + VIEWING_REMINDER_CATCH_UP_MINUTES;
}

export function getHarareDayRange(value: Date): { dateKey: string; start: Date; end: Date } {
  const dateKey = getViewingReminderDateKey(value);
  const [year, month, day] = dateKey.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  const nextKey = [
    nextDate.getUTCFullYear(),
    String(nextDate.getUTCMonth() + 1).padStart(2, "0"),
    String(nextDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
  // Zimbabwe and South Africa use UTC+02:00 year-round.
  return {
    dateKey,
    start: new Date(`${dateKey}T00:00:00+02:00`),
    end: new Date(`${nextKey}T00:00:00+02:00`),
  };
}

export function formatViewingReminderTime(value: Date): string {
  return new Intl.DateTimeFormat("en-ZW", {
    timeZone: VIEWING_REMINDER_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}
