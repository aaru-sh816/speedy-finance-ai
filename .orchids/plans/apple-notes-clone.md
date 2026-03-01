# Apple Notes Clone - Ultimate Edition

## Requirements

Build a pixel-perfect Apple Notes clone that rivals the original in design quality, featuring:
- **Three-pane layout**: Sidebar (folders), Notes List, and Editor
- **Dual theme system**: Light and Dark modes with smooth transitions
- **Rich text editing**: Full formatting (bold, italic, headings, lists, checklists)
- **Smart organization**: Folders, tags, pinning, search with fuzzy matching
- **Advanced features**: Templates, markdown support, version history, encryption
- **Responsive design**: Flawless experience on desktop, tablet, and mobile
- **Premium animations**: Fluid transitions following Apple's design philosophy

---

## Implementation Phases

### Phase 1: Core Infrastructure & Data Layer
1. Create new localStorage schema for general notes (separate from stock notes)
2. Build `src/lib/notes-storage.ts` with full CRUD operations for notes, folders, tags
3. Create `src/hooks/useNotes.ts` hook with reactive state management
4. Create `src/hooks/useFolders.ts` hook for folder operations
5. Create `src/hooks/useNotesSearch.ts` hook with fuzzy search algorithm
6. Add auto-save with debouncing (500ms delay)
7. Implement version history tracking (store last 10 versions per note)

### Phase 2: Theme System & CSS Variables
8. Extend `globals.css` with Apple Notes color palette (light + dark)
9. Create CSS custom properties for all design tokens
10. Implement theme context provider with system preference detection
11. Add smooth 300ms theme transition animations
12. Create sun/moon toggle with morphing animation

### Phase 3: Layout Components
13. Create `src/app/apple-notes/page.tsx` main page with three-pane layout
14. Build `src/components/notes/NotesSidebar.tsx` - folder tree navigation
15. Build `src/components/notes/NotesList.tsx` - virtualized note cards
16. Build `src/components/notes/NoteEditor.tsx` - rich text editor canvas
17. Implement responsive breakpoints (desktop/tablet/mobile)
18. Add collapsible sidebar with smooth animations
19. Build mobile navigation with slide transitions

### Phase 4: Sidebar Features
20. Create folder tree with expand/collapse animations
21. Add folder context menu (rename, delete, change color)
22. Implement drag-and-drop for notes between folders
23. Build folder creation modal with color picker
24. Add smart folders (All Notes, Favorites, Recently Deleted)
25. Show note counts per folder with tabular-nums styling
26. Add storage usage indicator in footer

### Phase 5: Notes List Features
27. Build search bar with clear button and focus states
28. Implement filter chips (All, Pinned, Locked)
29. Add sort dropdown (Date Modified, Date Created, Title)
30. Create note card component with preview extraction
31. Implement list/grid view toggle
32. Add skeleton loading states
33. Build pull-to-refresh for mobile
34. Implement infinite scroll with virtualization

### Phase 6: Rich Text Editor
35. Create ContentEditable-based editor with formatting
36. Build floating toolbar (appears on text selection)
37. Build sticky top toolbar with all formatting buttons
38. Implement bold, italic, underline, strikethrough
39. Add heading levels (H1, H2, H3, Paragraph)
40. Implement bullet lists, numbered lists, checklists
41. Add code blocks with syntax highlighting
42. Implement blockquotes with left border styling
43. Add horizontal rule insertion
44. Build link insertion modal
45. Implement image upload with lightbox preview
46. Add table creation and editing
47. Create markdown auto-conversion (# for headings, ** for bold, etc.)

### Phase 7: Advanced Note Features
48. Build note locking with password/biometrics
49. Implement note pinning with visual indicator
50. Add tags system with autocomplete
51. Create template picker modal
52. Build template library (Daily Journal, Meeting Notes, Project Plan)
53. Implement version history sidebar
54. Add diff view for version comparison
55. Build note sharing modal with link generation
56. Add export options (Markdown, PDF, HTML, JSON)

### Phase 8: Keyboard Shortcuts
57. Create global shortcut handler
58. Implement Cmd+N for new note
59. Implement Cmd+F for search focus
60. Implement Cmd+B/I/U for formatting
61. Implement Cmd+K for link insertion
62. Add Cmd+Shift+D for dark mode toggle
63. Implement Cmd+\ for sidebar toggle
64. Create keyboard shortcuts help modal (Cmd+/)

### Phase 9: Animations & Polish
65. Add note selection slide-in animation
66. Implement folder expand/collapse with staggered children
67. Create modal entrance/exit animations
68. Add delete swipe animation for mobile
69. Implement toast notification system
70. Add context menu with smooth appearance
71. Create ripple effect for buttons
72. Implement hover lift effect for cards

### Phase 10: Mobile Optimization
73. Build mobile-first bottom toolbar
74. Implement swipe gestures (back navigation)
75. Add floating action button for new note
76. Create touch-optimized context menus
77. Implement pull-to-refresh animation
78. Add safe area insets for notched devices
79. Build keyboard-aware scroll behavior

### Phase 11: Data Management & Sync
80. Implement import/export for backup
81. Add conflict resolution UI for sync conflicts
82. Create data migration system for schema updates
83. Build Recently Deleted (trash) with 30-day auto-delete
84. Add empty trash confirmation modal

### Phase 12: Final Polish & Testing
85. Performance audit and optimization
86. Accessibility audit (WCAG AAA compliance)
87. Cross-browser testing
88. Add error boundaries and fallback UI
89. Final visual polish and spacing adjustments

---

## Technical Architecture

### File Structure
```
src/
├── app/
│   └── apple-notes/
│       ├── page.tsx              # Main notes app
│       └── layout.tsx            # Notes-specific layout
├── components/
│   └── notes/
│       ├── NotesSidebar.tsx      # Folder navigation
│       ├── NotesList.tsx         # Notes list view
│       ├── NoteCard.tsx          # Individual note card
│       ├── NoteEditor.tsx        # Rich text editor
│       ├── EditorToolbar.tsx     # Formatting toolbar
│       ├── SelectionToolbar.tsx  # Floating toolbar
│       ├── FolderTree.tsx        # Folder tree component
│       ├── FolderItem.tsx        # Single folder item
│       ├── TemplateModal.tsx     # Template picker
│       ├── SearchBar.tsx         # Search with suggestions
│       ├── NotesThemeToggle.tsx  # Sun/moon toggle
│       └── NotesContextMenu.tsx  # Right-click menu
├── lib/
│   ├── notes-storage.ts          # localStorage operations
│   ├── notes-types.ts            # TypeScript interfaces
│   └── notes-utils.ts            # Utility functions
└── hooks/
    ├── useNotes.ts               # Notes state management
    ├── useFolders.ts             # Folder operations
    └── useNotesSearch.ts         # Search functionality
```

### Data Schema
```typescript
interface Note {
  id: string
  title: string
  content: string           // HTML content
  plainText: string         // For search
  folderId: string
  tags: string[]
  pinned: boolean
  locked: boolean
  passwordHash?: string
  created: number
  modified: number
  wordCount: number
  versions: NoteVersion[]
}

interface Folder {
  id: string
  name: string
  icon: string
  color: string
  parentId: string | null
  order: number
  expanded: boolean
}

interface NoteVersion {
  id: string
  content: string
  timestamp: number
  description: string
}
```

### Key Dependencies
- React 18+ with hooks
- Next.js App Router
- TailwindCSS for styling
- Lucide React for icons
- No external rich text library (custom implementation)

---

## Design Specifications

### Color Palette (Dark Mode - Primary)
- Background Primary: `#000000`
- Background Secondary: `#0A0A0A`
- Background Tertiary: `#141414`
- Text Primary: `#FFFFFF`
- Text Secondary: `#E5E5E7`
- Accent Blue: `#0A84FF`
- Border: `rgba(255,255,255,0.12)`

### Typography
- Font: SF Pro (system font stack)
- Title: 32px, weight 700, -0.02em tracking
- Body: 17px, weight 400, line-height 26px
- Caption: 12px, weight 400

### Animations
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)`
- Fast: 150ms (hovers)
- Normal: 200ms (transitions)
- Slow: 300ms (page changes)

---

## Risks & Mitigations

1. **Performance with large note collections**
   - Mitigation: Virtualized list rendering, lazy loading

2. **Rich text editor complexity**
   - Mitigation: Start with ContentEditable, add features incrementally

3. **Mobile keyboard handling**
   - Mitigation: Test extensively on real devices

4. **Theme transition jank**
   - Mitigation: Use CSS custom properties, avoid layout shifts

---

## Success Criteria

- [ ] Pixel-perfect match to Apple Notes design
- [ ] Sub-100ms interaction response times
- [ ] Zero layout shifts during animations
- [ ] WCAG AAA accessibility compliance
- [ ] Works offline with localStorage
- [ ] Smooth 60fps animations throughout
