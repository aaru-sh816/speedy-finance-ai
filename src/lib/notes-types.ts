// Stock Research Notes - Type Definitions

export interface Note {
  id: string
  title: string
  content: string           // HTML content
  plainText: string         // For search indexing
  folderId: string
  tags: string[]
  pinned: boolean
  locked: boolean
  passwordHash?: string
  created: number           // Unix timestamp
  modified: number          // Unix timestamp
  wordCount: number
  versions: NoteVersion[]
  deleted?: boolean         // Soft delete flag
  deletedAt?: number        // When moved to trash

  // Stock Research Fields
  scripCode?: string        // BSE scrip code
  symbol?: string           // Stock symbol (e.g., RELIANCE)
  companyName?: string      // Full company name
  sentiment?: 'bullish' | 'bearish' | 'neutral'
  priceAtCreation?: number  // Stock price when note was created
  priceTarget?: number      // Target price
  stopLoss?: number         // Stop-loss level
  confidence?: 1 | 2 | 3 | 4 | 5  // Conviction level (stars)
  timeframe?: 'short' | 'medium' | 'long'
  template?: 'earnings' | 'technical' | 'fundamental' | 'news' | 'thesis' | 'custom'
  linkedAnnouncements?: LinkedAnnouncement[]
  linkedNoteIds?: string[]  // Cross-reference other notes
  // Thesis tracking
  thesisStatus?: 'active' | 'closed-win' | 'closed-loss' | 'invalidated'
  closedAt?: number         // When thesis was closed
  closedPrice?: number      // Price when closed
  // Calculated P&L (not stored, computed from priceAtCreation + current price)
}

export interface LinkedAnnouncement {
  id: string
  headline: string
  date: string
  category?: string
}

export interface Folder {
  id: string
  name: string
  icon: string              // Lucide icon name
  color: string             // Hex color
  parentId: string | null   // For nested folders
  order: number
  expanded: boolean
  isSystem?: boolean        // For system folders
  isSmartFolder?: boolean   // For auto-filtered folders
  smartFilter?: SmartFilter // Filter criteria for smart folders
}

export interface SmartFilter {
  type: 'sentiment' | 'stock' | 'confidence' | 'timeframe' | 'template' | 'thesis-status' | 'has-target'
  value: string
}

export interface NoteVersion {
  id: string
  content: string
  plainText: string
  timestamp: number
  description: string
}

export interface NotesState {
  notes: Note[]
  folders: Folder[]
  selectedNoteId: string | null
  selectedFolderId: string
  searchQuery: string
  sortBy: SortOption
  sortDirection: 'asc' | 'desc'
  viewMode: 'list' | 'grid'
  sidebarCollapsed: boolean
  listCollapsed: boolean
}

export type SortOption = 'modified' | 'created' | 'title' | 'wordCount' | 'sentiment' | 'symbol' | 'confidence'

export interface NotesFilter {
  folderId?: string
  pinned?: boolean
  locked?: boolean
  tags?: string[]
  searchQuery?: string
  sentiment?: Note['sentiment']
  scripCode?: string
}

// Default system folders
export const SYSTEM_FOLDERS = {
  ALL_NOTES: 'all-notes',
  FAVORITES: 'favorites',
  RECENTLY_DELETED: 'recently-deleted',
} as const

// Smart folder IDs
export const SMART_FOLDERS = {
  BULLISH: 'smart-bullish',
  BEARISH: 'smart-bearish',
  HIGH_CONVICTION: 'smart-high-conviction',
  ACTIVE_THESES: 'smart-active-theses',
  WITH_TARGETS: 'smart-with-targets',
} as const

// Research templates
export interface NoteTemplate {
  id: string
  name: string
  icon: string
  content: string
  tags: string[]
  template?: Note['template']
}

export const DEFAULT_TEMPLATES: NoteTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Note',
    icon: 'FileText',
    content: '',
    tags: [],
  },
  {
    id: 'thesis',
    name: 'Investment Thesis',
    icon: 'Target',
    content: `<h2>Thesis</h2>
<p></p>
<h2>Key Catalysts</h2>
<ul><li></li></ul>
<h2>Risks</h2>
<ul><li></li></ul>
<h2>Valuation</h2>
<p></p>
<h2>Entry / Exit Strategy</h2>
<p><strong>Entry:</strong> </p>
<p><strong>Target:</strong> </p>
<p><strong>Stop Loss:</strong> </p>`,
    tags: ['thesis'],
    template: 'thesis',
  },
  {
    id: 'earnings',
    name: 'Earnings Analysis',
    icon: 'BarChart3',
    content: `<h2>Revenue</h2>
<p></p>
<h2>Margins</h2>
<p></p>
<h2>Key Highlights</h2>
<ul><li></li></ul>
<h2>Management Commentary</h2>
<p></p>
<h2>Outlook</h2>
<p></p>`,
    tags: ['earnings'],
    template: 'earnings',
  },
  {
    id: 'technical',
    name: 'Technical Setup',
    icon: 'TrendingUp',
    content: `<h2>Pattern / Setup</h2>
<p></p>
<h2>Key Levels</h2>
<p><strong>Support:</strong> </p>
<p><strong>Resistance:</strong> </p>
<h2>Volume Analysis</h2>
<p></p>
<h2>Trade Plan</h2>
<p><strong>Entry:</strong> </p>
<p><strong>Target:</strong> </p>
<p><strong>Stop Loss:</strong> </p>`,
    tags: ['technical'],
    template: 'technical',
  },
  {
    id: 'fundamental',
    name: 'Fundamental Review',
    icon: 'BookOpen',
    content: `<h2>Business Overview</h2>
<p></p>
<h2>Competitive Advantage / Moat</h2>
<ul><li></li></ul>
<h2>Financial Health</h2>
<p></p>
<h2>Growth Drivers</h2>
<ul><li></li></ul>
<h2>Risks</h2>
<ul><li></li></ul>`,
    tags: ['fundamental'],
    template: 'fundamental',
  },
  {
    id: 'news',
    name: 'News / Event Note',
    icon: 'Newspaper',
    content: `<h2>Event</h2>
<p></p>
<h2>Impact Analysis</h2>
<p></p>
<h2>Action Items</h2>
<ul class="checklist"><li><input type="checkbox"> </li></ul>`,
    tags: ['news'],
    template: 'news',
  },
]

// Storage key
export const NOTES_STORAGE_KEY = 'apple-notes-data-v1'
