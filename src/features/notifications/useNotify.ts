import { useNotificationContext } from './NotificationProvider';

export function useNotify() {
  const { success, error, info, dismiss } = useNotificationContext();
  return { success, error, info, dismiss };
}
