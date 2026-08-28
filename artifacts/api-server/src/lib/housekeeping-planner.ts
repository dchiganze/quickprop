export type HousekeepingActionPlanInput = {
  previousStatus: string;
  nextStatus: string;
  reminderKey: string | null;
  agentId: number | null;
  existingReminder: boolean;
  hasOpenTask: boolean;
};

export function planHousekeepingActions(input: HousekeepingActionPlanInput) {
  const reminderEvent = Boolean(
    input.reminderKey && input.agentId !== null && !input.existingReminder,
  );
  return {
    statusEvent: input.previousStatus !== input.nextStatus,
    reminderEvent,
    notification: reminderEvent,
    task: reminderEvent && !input.hasOpenTask,
  };
}