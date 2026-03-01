"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import {
  getCalendarPreferences,
  setCalendarPreferences,
  type CalendarPreferences,
} from "@/lib/storage"

interface CalendarPreferencesContextValue extends CalendarPreferences {
  setWeekStartsOn: (v: 0 | 1) => void
  setTimezone: (v: string) => void
  setCalendarFilterWatchlistId: (v: string | "all") => void
}

const defaults: CalendarPreferencesContextValue = {
  weekStartsOn: 1,
  timezone: "Asia/Kolkata",
  calendarFilterWatchlistId: "all",
  setWeekStartsOn: () => {},
  setTimezone: () => {},
  setCalendarFilterWatchlistId: () => {},
}

const CalendarPreferencesContext =
  createContext<CalendarPreferencesContextValue>(defaults)

export function CalendarPreferencesProvider({
  children,
}: {
  children: ReactNode
}) {
  const [prefs, setPrefs] = useState<CalendarPreferences>(() =>
    typeof window !== "undefined" ? getCalendarPreferences() : defaults
  )

  useEffect(() => {
    const handler = () => setPrefs(getCalendarPreferences())
    window.addEventListener("calendar-preferences-updated", handler)
    return () => window.removeEventListener("calendar-preferences-updated", handler)
  }, [])

  const setWeekStartsOn = useCallback((v: 0 | 1) => {
    setCalendarPreferences({ weekStartsOn: v })
    setPrefs((p) => ({ ...p, weekStartsOn: v }))
  }, [])

  const setTimezone = useCallback((v: string) => {
    setCalendarPreferences({ timezone: v })
    setPrefs((p) => ({ ...p, timezone: v }))
  }, [])

  const setCalendarFilterWatchlistId = useCallback((v: string | "all") => {
    setCalendarPreferences({ calendarFilterWatchlistId: v })
    setPrefs((p) => ({ ...p, calendarFilterWatchlistId: v }))
  }, [])

  const value: CalendarPreferencesContextValue = {
    ...prefs,
    setWeekStartsOn,
    setTimezone,
    setCalendarFilterWatchlistId,
  }

  return (
    <CalendarPreferencesContext.Provider value={value}>
      {children}
    </CalendarPreferencesContext.Provider>
  )
}

export function useCalendarPreferences() {
  const ctx = useContext(CalendarPreferencesContext)
  return ctx ?? defaults
}
