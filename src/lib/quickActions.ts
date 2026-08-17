import type { EventType } from './supabase';

export interface QuickAction {
  type: EventType;
  emoji: string;
  label: string;
  message: string;
}

export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { type: 'READY', emoji: '❤️', label: 'Ready to be disturbed', message: "I'm ready to be disturbed" },
  { type: 'ARRIVED', emoji: '🏢', label: 'Reached Office', message: 'Reached Office safely' },
  { type: 'ARRIVED', emoji: '🎓', label: 'Reached College', message: 'Reached College safely' },
  { type: 'ARRIVED', emoji: '🏠', label: 'Reached Home', message: 'Reached Home safely' },
  { type: 'CALL_ME', emoji: '💬', label: 'Call me', message: 'Call me when you can' },
  { type: 'THINKING', emoji: '🫶', label: 'Thinking of you', message: 'Thinking of you' },
  { type: 'SLEEPING', emoji: '😴', label: 'Going to sleep', message: 'Going to sleep' },
  { type: 'DND', emoji: '🔕', label: 'Do not disturb', message: "I'm not available right now" },
];

export const DEFAULT_CUSTOM_MESSAGES = [
  { emoji: '❤️', label: 'I reached safely', message: 'I reached safely ❤️' },
  { emoji: '😊', label: "I'm free now", message: "I'm free now" },
  { emoji: '📞', label: 'Call me', message: 'Call me' },
  { emoji: '🤐', label: "Can't talk", message: "Can't talk right now" },
  { emoji: '🚗', label: "On my way", message: "I'm on my way" },
  { emoji: '🥰', label: 'I miss you', message: 'I miss you' },
  { emoji: '🫶', label: 'Thinking about you', message: 'Thinking about you' },
  { emoji: '😴', label: 'Going to sleep', message: 'Going to sleep' },
  { emoji: '🌅', label: 'Wake me up', message: 'Wake me up' },
  { emoji: '🆘', label: 'Please call me', message: 'Please call me' },
  { emoji: '✅', label: "All okay", message: 'Everything is okay' },
  { emoji: '💜', label: 'I need you', message: 'I need you' },
];
