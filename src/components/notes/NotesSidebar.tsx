'use client'

import { useState, useCallback } from 'react'
import { Folder, SYSTEM_FOLDERS, SMART_FOLDERS } from '@/lib/notes-types'
import {
  FileText,
  Star,
  Trash2,
  Folder as FolderIcon,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  X,
  Pencil,
  Palette,
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  Crosshair,
  BarChart3,
  Trophy,
  Building2,
  Activity,
} from 'lucide-react'

interface StockGroup {
  scripCode: string
  symbol: string
  companyName: string
  count: number
}

interface ThesisStats {
  active: number
  closedWin: number
  closedLoss: number
  invalidated: number
  winRate: number
  totalPnlPercent: number
}

interface NotesSidebarProps {
  folders: Folder[]
  selectedFolderId: string
  folderNoteCounts: Record<string, number>
  onSelectFolder: (folderId: string) => void
  onCreateFolder: (name: string, color?: string, icon?: string) => void
  onUpdateFolder: (id: string, updates: Partial<Pick<Folder, 'name' | 'color' | 'icon' | 'expanded'>>) => void
  onDeleteFolder: (id: string) => void
  onToggleExpanded: (id: string) => void
  onToggleTheme: () => void
  theme: 'notes-dark' | 'notes-light'
  stats: { totalNotes: number; totalWords: number; totalFolders: number }
  stockGroups: StockGroup[]
  thesisStats: ThesisStats
  onCloseMobile?: () => void
}

const FOLDER_COLORS = [
  { name: 'Blue', value: '#0A84FF' },
  { name: 'Green', value: '#30D158' },
  { name: 'Yellow', value: '#FFD60A' },
  { name: 'Orange', value: '#FF9F0A' },
  { name: 'Red', value: '#FF453A' },
  { name: 'Purple', value: '#BF5AF2' },
  { name: 'Gray', value: '#8E8E93' },
]

export default function NotesSidebar({
  folders,
  selectedFolderId,
  folderNoteCounts,
  onSelectFolder,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onToggleExpanded,
  onToggleTheme,
  theme,
  stats,
  stockGroups,
  thesisStats,
  onCloseMobile,
}: NotesSidebarProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0].value)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ folderId: string; x: number; y: number } | null>(null)
  const [stocksExpanded, setStocksExpanded] = useState(true)
  const [smartExpanded, setSmartExpanded] = useState(true)

  const handleCreateFolder = useCallback(() => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), newFolderColor)
      setNewFolderName('')
      setNewFolderColor(FOLDER_COLORS[0].value)
      setIsCreating(false)
    }
  }, [newFolderName, newFolderColor, onCreateFolder])

  const handleContextMenu = useCallback((e: React.MouseEvent, folderId: string) => {
    e.preventDefault()
    const folder = folders.find(f => f.id === folderId)
    if (folder?.isSystem) return
    setContextMenu({ folderId, x: e.clientX, y: e.clientY })
  }, [folders])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const systemFolders = folders.filter(f => f.isSystem && f.id !== SYSTEM_FOLDERS.RECENTLY_DELETED)
  const recentlyDeletedFolder = folders.find(f => f.id === SYSTEM_FOLDERS.RECENTLY_DELETED)
  const customFolders = folders.filter(f => !f.isSystem)

  const renderFolderItem = (
    id: string,
    name: string,
    icon: React.ReactNode,
    count: number,
    depth: number = 0,
    badge?: React.ReactNode
  ) => {
    const isSelected = id === selectedFolderId
    return (
      <div
        key={id}
        className={`notes-folder-item ${isSelected ? 'active' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelectFolder(id)}
      >
        <span className="folder-icon">{icon}</span>
        <span className="flex-1 truncate">{name}</span>
        {badge}
        {count > 0 && (
          <span className="folder-count">{count}</span>
        )}
      </div>
    )
  }

  const renderCustomFolder = (folder: Folder, depth: number = 0) => {
    const isSelected = folder.id === selectedFolderId
    const count = folderNoteCounts[folder.id] || 0
    const isEditing = editingFolderId === folder.id
    const childFolders = customFolders.filter(f => f.parentId === folder.id)
    const hasChildren = childFolders.length > 0

    return (
      <div key={folder.id}>
        <div
          className={`notes-folder-item ${isSelected ? 'active' : ''}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => onSelectFolder(folder.id)}
          onContextMenu={(e) => handleContextMenu(e, folder.id)}
        >
          {hasChildren && (
            <button
              className="p-0.5 -ml-1 hover:bg-[var(--notes-bg-hover)] rounded"
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpanded(folder.id)
              }}
            >
              {folder.expanded ? (
                <ChevronDown className="w-4 h-4 text-[var(--notes-text-tertiary)]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--notes-text-tertiary)]" />
              )}
            </button>
          )}
          
          <span className="folder-icon">
            <FolderIcon className="w-5 h-5" style={{ color: folder.color }} />
          </span>
          
          {isEditing ? (
            <input
              type="text"
              defaultValue={folder.name}
              autoFocus
              className="flex-1 bg-transparent border-b border-[var(--notes-accent-blue)] outline-none text-[var(--notes-text-primary)] text-sm"
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== folder.name) {
                  onUpdateFolder(folder.id, { name: e.target.value.trim() })
                }
                setEditingFolderId(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                else if (e.key === 'Escape') setEditingFolderId(null)
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 truncate">{folder.name}</span>
          )}
          
          {count > 0 && <span className="folder-count">{count}</span>}
        </div>

        {hasChildren && folder.expanded && (
          <div className="notes-animate-fade-in">
            {childFolders.map(child => renderCustomFolder(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--notes-border-tertiary)]">
          <h2 className="text-lg font-semibold text-[var(--notes-text-primary)] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[var(--notes-accent-blue)]" />
            Research
          </h2>
          <div className="flex items-center gap-1">
            <button 
              onClick={onToggleTheme} 
              className="notes-theme-toggle"
              title={theme === 'notes-dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'notes-dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {onCloseMobile && (
              <button onClick={onCloseMobile} className="lg:hidden notes-toolbar-btn">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Thesis Scorecard */}
        {(thesisStats.active > 0 || thesisStats.closedWin > 0 || thesisStats.closedLoss > 0) && (
          <div className="mx-3 mt-3 p-3 rounded-lg bg-[var(--notes-bg-tertiary)] border border-[var(--notes-border-tertiary)]">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-[var(--notes-accent-yellow)]" />
              <span className="text-xs font-semibold text-[var(--notes-text-secondary)] uppercase tracking-wide">Thesis Scorecard</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-[var(--notes-accent-blue)]">{thesisStats.active}</div>
                <div className="text-[10px] text-[var(--notes-text-tertiary)]">Active</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[#30D158]">{thesisStats.closedWin}</div>
                <div className="text-[10px] text-[var(--notes-text-tertiary)]">Wins</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[#FF453A]">{thesisStats.closedLoss}</div>
                <div className="text-[10px] text-[var(--notes-text-tertiary)]">Losses</div>
              </div>
            </div>
          {(thesisStats.closedWin + thesisStats.closedLoss) > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--notes-border-tertiary)] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--notes-text-tertiary)]">Win Rate</span>
                    <span className={`text-xs font-bold ${thesisStats.winRate >= 50 ? 'text-[#30D158]' : 'text-[#FF453A]'}`}>
                      {thesisStats.winRate.toFixed(0)}%
                    </span>
                  </div>
                  {thesisStats.totalPnlPercent !== 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--notes-text-tertiary)] flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Total P&L
                      </span>
                      <span className={`text-xs font-bold ${thesisStats.totalPnlPercent >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`}>
                        {thesisStats.totalPnlPercent >= 0 ? '+' : ''}{thesisStats.totalPnlPercent.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}

        {/* System Folders */}
        <div className="py-2 px-2">
          {renderFolderItem(
            SYSTEM_FOLDERS.ALL_NOTES, 'All Research', 
            <FileText className="w-5 h-5" style={{ color: '#0A84FF' }} />,
            folderNoteCounts[SYSTEM_FOLDERS.ALL_NOTES] || 0
          )}
          {renderFolderItem(
            SYSTEM_FOLDERS.FAVORITES, 'Favorites',
            <Star className="w-5 h-5" style={{ color: '#FFD60A' }} />,
            folderNoteCounts[SYSTEM_FOLDERS.FAVORITES] || 0
          )}
        </div>

        <div className="h-px bg-[var(--notes-border-tertiary)] mx-4" />

        {/* Smart Folders */}
        <div className="py-2 px-2">
          <button
            className="flex items-center justify-between w-full px-3 py-1.5"
            onClick={() => setSmartExpanded(!smartExpanded)}
          >
            <span className="text-xs font-medium text-[var(--notes-text-tertiary)] uppercase tracking-wide flex items-center gap-1.5">
              <Zap className="w-3 h-3" /> Smart Filters
            </span>
            {smartExpanded ? (
              <ChevronDown className="w-3 h-3 text-[var(--notes-text-tertiary)]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[var(--notes-text-tertiary)]" />
            )}
          </button>
          {smartExpanded && (
            <div className="notes-animate-fade-in">
              {renderFolderItem(
                SMART_FOLDERS.BULLISH, 'Bullish',
                <TrendingUp className="w-5 h-5" style={{ color: '#30D158' }} />,
                folderNoteCounts[SMART_FOLDERS.BULLISH] || 0,
                0,
                <span className="w-2 h-2 rounded-full bg-[#30D158]" />
              )}
              {renderFolderItem(
                SMART_FOLDERS.BEARISH, 'Bearish',
                <TrendingDown className="w-5 h-5" style={{ color: '#FF453A' }} />,
                folderNoteCounts[SMART_FOLDERS.BEARISH] || 0,
                0,
                <span className="w-2 h-2 rounded-full bg-[#FF453A]" />
              )}
              {renderFolderItem(
                SMART_FOLDERS.HIGH_CONVICTION, 'High Conviction',
                <Zap className="w-5 h-5" style={{ color: '#FF9F0A' }} />,
                folderNoteCounts[SMART_FOLDERS.HIGH_CONVICTION] || 0
              )}
              {renderFolderItem(
                SMART_FOLDERS.ACTIVE_THESES, 'Active Theses',
                <Target className="w-5 h-5" style={{ color: '#BF5AF2' }} />,
                folderNoteCounts[SMART_FOLDERS.ACTIVE_THESES] || 0
              )}
              {renderFolderItem(
                SMART_FOLDERS.WITH_TARGETS, 'With Targets',
                <Crosshair className="w-5 h-5" style={{ color: '#64D2FF' }} />,
                folderNoteCounts[SMART_FOLDERS.WITH_TARGETS] || 0
              )}
            </div>
          )}
        </div>

        <div className="h-px bg-[var(--notes-border-tertiary)] mx-4" />

        {/* Stock Groups */}
        {stockGroups.length > 0 && (
          <>
            <div className="py-2 px-2">
              <button
                className="flex items-center justify-between w-full px-3 py-1.5"
                onClick={() => setStocksExpanded(!stocksExpanded)}
              >
                <span className="text-xs font-medium text-[var(--notes-text-tertiary)] uppercase tracking-wide flex items-center gap-1.5">
                  <Building2 className="w-3 h-3" /> By Stock
                </span>
                {stocksExpanded ? (
                  <ChevronDown className="w-3 h-3 text-[var(--notes-text-tertiary)]" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-[var(--notes-text-tertiary)]" />
                )}
              </button>
              {stocksExpanded && (
                <div className="notes-animate-fade-in">
                  {stockGroups.map(group => (
                    <div
                      key={group.scripCode}
                      className={`notes-folder-item ${selectedFolderId === `stock-${group.scripCode}` ? 'active' : ''}`}
                      style={{ paddingLeft: '12px' }}
                      onClick={() => onSelectFolder(`stock-${group.scripCode}`)}
                    >
                      <span className="folder-icon">
                        <div className="w-5 h-5 rounded bg-[var(--notes-bg-hover)] flex items-center justify-center text-[9px] font-bold text-[var(--notes-accent-blue)]">
                          {group.symbol.slice(0, 2)}
                        </div>
                      </span>
                      <span className="flex-1 truncate text-sm">{group.symbol}</span>
                      <span className="folder-count">{group.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="h-px bg-[var(--notes-border-tertiary)] mx-4" />
          </>
        )}

        {/* Custom Folders Section */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-medium text-[var(--notes-text-tertiary)] uppercase tracking-wide">
              Folders
            </span>
            <button
              onClick={() => setIsCreating(true)}
              className="p-1 hover:bg-[var(--notes-bg-hover)] rounded-md transition-colors"
              title="New Folder"
            >
              <FolderPlus className="w-4 h-4 text-[var(--notes-text-tertiary)]" />
            </button>
          </div>

          {isCreating && (
            <div className="mx-2 mb-2 p-3 bg-[var(--notes-bg-tertiary)] rounded-lg notes-animate-scale-in">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                autoFocus
                className="w-full bg-transparent border-b border-[var(--notes-border-primary)] pb-2 mb-3 outline-none text-[var(--notes-text-primary)] text-sm placeholder:text-[var(--notes-text-placeholder)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                  if (e.key === 'Escape') setIsCreating(false)
                }}
              />
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-[var(--notes-text-tertiary)]">Color:</span>
                <div className="flex gap-1">
                  {FOLDER_COLORS.map(color => (
                    <button
                      key={color.value}
                      className={`w-5 h-5 rounded-full transition-transform ${
                        newFolderColor === color.value ? 'scale-125 ring-2 ring-white/30' : ''
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setNewFolderColor(color.value)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsCreating(false)}
                  className="flex-1 py-1.5 text-sm text-[var(--notes-text-secondary)] hover:bg-[var(--notes-bg-hover)] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="flex-1 py-1.5 text-sm bg-[var(--notes-accent-blue)] text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {customFolders.filter(f => !f.parentId).map(folder => renderCustomFolder(folder))}
        </div>

        {/* Recently Deleted */}
        {recentlyDeletedFolder && (
          <>
            <div className="h-px bg-[var(--notes-border-tertiary)] mx-4" />
            <div className="py-2 px-2">
              {renderFolderItem(
                SYSTEM_FOLDERS.RECENTLY_DELETED, 'Recently Deleted',
                <Trash2 className="w-5 h-5" style={{ color: '#FF453A' }} />,
                folderNoteCounts[SYSTEM_FOLDERS.RECENTLY_DELETED] || 0
              )}
            </div>
          </>
        )}

        {/* Footer Stats */}
        <div className="p-4 border-t border-[var(--notes-border-tertiary)]">
          <div className="flex items-center justify-between text-xs text-[var(--notes-text-quaternary)]">
            <span>{stats.totalNotes} notes</span>
            <span>{stats.totalWords.toLocaleString()} words</span>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[999]" onClick={closeContextMenu} />
          <div
            className="notes-context-menu open"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              className="notes-context-item"
              onClick={() => {
                setEditingFolderId(contextMenu.folderId)
                closeContextMenu()
              }}
            >
              <Pencil className="w-4 h-4" />
              Rename
            </button>
            <button
              className="notes-context-item"
              onClick={closeContextMenu}
            >
              <Palette className="w-4 h-4" />
              Change Color
            </button>
            <div className="notes-context-divider" />
            <button
              className="notes-context-item danger"
              onClick={() => {
                onDeleteFolder(contextMenu.folderId)
                closeContextMenu()
              }}
            >
              <Trash2 className="w-4 h-4" />
              Delete Folder
            </button>
          </div>
        </>
      )}
    </>
  )
}
