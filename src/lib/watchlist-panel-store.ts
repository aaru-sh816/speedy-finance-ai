/**
 * Lightweight global state for the persistent watchlist panel.
 * Uses useSyncExternalStore — no extra dependencies (Zustand, Redux, etc.).
 */

type Listener = () => void

let isOpen = false
const listeners = new Set<Listener>()

function notify() {
    listeners.forEach((l) => l())
}

export const watchlistPanelStore = {
    getSnapshot: () => isOpen,
    subscribe: (l: Listener) => {
        listeners.add(l)
        return () => listeners.delete(l)
    },
    open: () => { isOpen = true; notify() },
    close: () => { isOpen = false; notify() },
    toggle: () => { isOpen = !isOpen; notify() },
}
