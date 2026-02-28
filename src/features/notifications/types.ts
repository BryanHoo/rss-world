export type NotificationType = 'success' | 'error' | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: number;
}
