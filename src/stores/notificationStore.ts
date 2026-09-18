import { create } from 'zustand';
import { Notification } from '@/types';

interface NotificationState {
  /** No leídas del usuario (ver `subscribeUserNotifications`) — es lo que alimenta el badge. */
  unreadNotifications: Notification[];
  setUnreadNotifications: (notifications: Notification[]) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadNotifications: [],
  setUnreadNotifications: (unreadNotifications) => set({ unreadNotifications }),
}));
