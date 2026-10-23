import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListNotificationsQueryKey, useListNotifications, useMarkNotificationRead,
} from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';

/** Account-scoped inbox shared by the dashboard badge and notifications page. */
export function useMatchNotifications() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [active, setActive] = useState(AppState.currentState !== 'background');
  const queryKey = [...getListNotificationsQueryKey(), user?.id];
  const inbox = useListNotifications({
    query: { queryKey, enabled: !!user, refetchInterval: active ? 10_000 : false, refetchOnMount: 'always' },
  });
  const markRead = useMarkNotificationRead({
    mutation: { onSuccess: () => { void client.invalidateQueries({ queryKey }); } },
  });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state === 'active' && user) void inbox.refetch();
    });
    return () => subscription.remove();
  }, [user?.id, inbox.refetch]);
  const notifications = inbox.data?.filter(notification => notification.type === 'collaboration_match') ?? [];
  return {
    notifications,
    unreadCount: notifications.filter(notification => !notification.read).length,
    markRead: (id: number) => markRead.mutate({ id }),
    refetch: inbox.refetch,
    error: inbox.error,
  };
}
