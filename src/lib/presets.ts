import type { ExperienceSettings, UserPreset } from '../types';

const PREF_KEY = 'echoform.preferences.v1';
const PRESET_KEY = 'echoform.presets.v1';

export const loadPreferences = (): Partial<ExperienceSettings> | null => {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<ExperienceSettings>;
  } catch {
    return null;
  }
};

export const savePreferences = (settings: ExperienceSettings): void => {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(settings));
  } catch {
    // Local storage may be disabled in private mode.
  }
};

export const loadPresets = (): UserPreset[] => {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UserPreset[];
    return Array.isArray(parsed) ? parsed.slice(0, 18) : [];
  } catch {
    return [];
  }
};

export const savePreset = (preset: UserPreset): UserPreset[] => {
  const existing = loadPresets().filter((item) => item.id !== preset.id);
  const next = [preset, ...existing].slice(0, 18);
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(next));
  } catch {
    // Storage quota may be exceeded; keep the session usable.
  }
  return next;
};

export const deletePreset = (id: string): UserPreset[] => {
  const next = loadPresets().filter((item) => item.id !== id);
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(next));
  } catch {
    // Ignore.
  }
  return next;
};
