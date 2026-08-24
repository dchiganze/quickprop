/**
 * Module-level flags for intentional navigation.
 * Because this is a plain JS object (not React state or AsyncStorage),
 * it resets to its default values on every cold launch (fresh JS context).
 * This lets screens distinguish "user navigated here" from "state was restored".
 */
export const NavigationFlags = {
  notificationsFromDashboard: false,
  tasksFilter: null as string | null,
  tasksDateScope: null as 'today' | null,
  tasksTitle: null as string | null,
};
