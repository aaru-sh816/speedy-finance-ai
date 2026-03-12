import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { arrayMove } from '@dnd-kit/sortable'

export interface WatchlistItem {
    id: string
    ticker: string
    name: string
    scripCode: string          // BSE scrip code for real-time API calls
    price: number
    changeAbs: number
    changePct: number
    volume?: number
    dayHigh?: number
    dayLow?: number
    marketCap?: number
    logoColor: string
    sector: string
}

export type RightPanelState = 'closed' | 'search' | 'watchlist'

export interface WatchlistState {
    groups: Record<string, WatchlistItem[]>
    rightPanelState: RightPanelState
    searchQuery: string
    searchResults: any[] // Real API results
    selectedSearchStock: WatchlistItem | null
}

const initialState: WatchlistState = {
    groups: {
        "My Watchlist": [],
    },
    rightPanelState: 'closed',
    searchQuery: "",
    searchResults: [],
    selectedSearchStock: null
}



export const watchlistSlice = createSlice({
    name: 'watchlist',
    initialState,
    reducers: {
        moveItemWithinGroup: (state, action: PayloadAction<{ groupName: string, activeId: string, overId: string }>) => {
            const { groupName, activeId, overId } = action.payload;
            const group = state.groups[groupName];
            const oldIndex = group.findIndex(i => i.id === activeId);
            const newIndex = group.findIndex(i => i.id === overId);
            state.groups[groupName] = arrayMove(group, oldIndex, newIndex);
        },
        moveItemBetweenGroups: (state, action: PayloadAction<{ activeId: string, activeGroup: string, overId: string, overGroup: string }>) => {
            const { activeId, activeGroup, overId, overGroup } = action.payload;
            // Find item
            const itemIndex = state.groups[activeGroup].findIndex(i => i.id === activeId);
            const item = state.groups[activeGroup][itemIndex];
            // Remove from active
            state.groups[activeGroup].splice(itemIndex, 1);
            // Insert to over
            const overIndex = state.groups[overGroup].findIndex(i => i.id === overId);

            const insertIndex = overIndex >= 0 ? overIndex : state.groups[overGroup].length;
            state.groups[overGroup].splice(insertIndex, 0, item);
        },
        setRightPanelState: (state, action: PayloadAction<RightPanelState>) => {
            state.rightPanelState = action.payload;
            if (action.payload !== 'search') {
                state.searchQuery = "";
                state.searchResults = [];
            }
        },
        setSearchQuery: (state, action: PayloadAction<string>) => {
            state.searchQuery = action.payload;
            // Clear results if query is empty
            if (!action.payload) {
                state.searchResults = [];
            }
        },
        setSearchResults: (state, action: PayloadAction<any[]>) => {
            state.searchResults = action.payload;
        },
        setSelectedSearchStock: (state, action: PayloadAction<WatchlistItem | null>) => {
            state.selectedSearchStock = action.payload;
            if (action.payload) {
                state.rightPanelState = 'watchlist';
            }
        },
        addItemToGroup: (state, action: PayloadAction<{ item: WatchlistItem, groupName: string }>) => {
            const { item, groupName } = action.payload;
            if (state.groups[groupName]) {
                // Check if already exists in group
                if (!state.groups[groupName].some(i => i.id === item.id)) {
                    state.groups[groupName].unshift(item);
                }
            }
        }
    }
})

export const {
    moveItemWithinGroup,
    moveItemBetweenGroups,
    setRightPanelState,
    setSearchQuery,
    setSearchResults,
    setSelectedSearchStock,
    addItemToGroup
} = watchlistSlice.actions
export default watchlistSlice.reducer
