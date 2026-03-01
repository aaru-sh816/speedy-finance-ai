# Speedy Finance AI — Agent Guidelines

This project uses **vercel-labs/agent-skills** to ensure best practices. Agents and AI tools **MUST** read and comply with these skills.

## Mandatory Skills

1. **vercel-react-best-practices** (`.agents/skills/vercel-react-best-practices/AGENTS.md`)
   - Performance: eliminate waterfalls with `Promise.all`, defer awaits
   - Bundle: `optimizePackageImports` for lucide-react and Radix UI
   - Server: `React.cache()` for dedup, parallel data fetching
   - Client: SWR for fetching, passive listeners, versioned localStorage
   - Re-renders: lazy state init, functional setState, `useMemo` only for expensive work
   - Use `.toSorted()` instead of `.sort()` to avoid mutation

2. **vercel-composition-patterns** (`.agents/skills/vercel-composition-patterns/AGENTS.md`)
   - Avoid boolean prop proliferation; use composition and compound components
   - Lift state into providers; prefer children over render props
   - React 19: `use()` instead of `useContext()`, ref as normal prop (no forwardRef)

## Quick Reference

- **API routes**: Use `Promise.all([...])` for independent fetches; avoid sequential awaits
- **Imports**: lucide-react and Radix UI are in `optimizePackageImports`; import normally
- **State**: `useState(() => expensiveInit())` for lazy init; use functional setState when next state depends on prev
- **Arrays**: Use `.toSorted()` or `[...arr].sort()` instead of mutating `.sort()`
