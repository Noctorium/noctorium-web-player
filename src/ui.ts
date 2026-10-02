import { useSyncExternalStore, type ReactNode } from 'react';

/*
 * What is laid over the page: the now playing screen, a dialog, a menu. Kept outside React's tree so any
 * button anywhere can open one without threading callbacks through every component between.
 */

interface Ui {
  nowPlaying: boolean;
  panel: 'queue' | 'lyrics';
  dialog: ReactNode | null;
  menu: { x: number; y: number; content: ReactNode } | null;
}

let ui: Ui = { nowPlaying: false, panel: 'queue', dialog: null, menu: null };
const listeners = new Set<() => void>();

function set(change: Partial<Ui>) {
  ui = { ...ui, ...change };
  listeners.forEach((l) => l());
}

export function useUi(): Ui {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => ui);
}

export const openNowPlaying = (panel?: Ui['panel']) => set({ nowPlaying: true, ...(panel ? { panel } : {}) });
export const closeNowPlaying = () => set({ nowPlaying: false });
export const setPanel = (panel: Ui['panel']) => set({ panel });
export const openDialog = (dialog: ReactNode) => set({ dialog, menu: null });
export const closeDialog = () => set({ dialog: null });

/** Opens [content] as a menu by the element that was clicked, kept on screen. */
export function openMenu(event: { clientX: number; clientY: number; currentTarget?: EventTarget | null }, content: ReactNode) {
  const target = event.currentTarget as HTMLElement | null;
  const rect = target?.getBoundingClientRect?.();
  const x = rect ? rect.right : event.clientX;
  const y = rect ? rect.bottom + 4 : event.clientY;
  set({ menu: { x, y, content } });
}

export const closeMenu = () => set({ menu: null });
