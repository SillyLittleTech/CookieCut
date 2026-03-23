// --- TABS MODULE ---
// Manages multi-document tab state, persistence, and snapshot operations.

import { recipeData } from './state.js'

export const tabsState = {
  tabs: [],
  activeTabId: null,
  nextTabNum: 1
}

const TABS_STORAGE_KEY = 'cookiecut_tabs_state'

function makeEmptyRecipeData () {
  return {
    title: '',
    description: '',
    items: [],
    settings: {
      fontStyle: 'display',
      fontApplyToText: false,
      fontApplyToTips: false,
      editorMode: 'classic',
      previewMode: 'continuous',
      fileName: ''
    }
  }
}

function snapshotRecipeData () {
  return {
    title: recipeData.title,
    description: recipeData.description,
    items: recipeData.items.map((item) => ({ ...item })),
    settings: { ...recipeData.settings }
  }
}

export function getActiveTab () {
  return tabsState.tabs.find((t) => t.id === tabsState.activeTabId) || null
}

export function saveCurrentTabSnapshot () {
  const activeTab = getActiveTab()
  if (activeTab) {
    activeTab.savedRecipeData = snapshotRecipeData()
  }
}

export function createTab (initialRecipeData = null) {
  const id = `tab_${Date.now()}_${tabsState.nextTabNum++}`
  const tab = {
    id,
    label: `Document ${tabsState.tabs.length + 1}`,
    savedRecipeData: initialRecipeData || makeEmptyRecipeData()
  }
  tabsState.tabs.push(tab)
  return tab
}

export function switchToTab (id) {
  if (id === tabsState.activeTabId) return null
  saveCurrentTabSnapshot()
  tabsState.activeTabId = id
  const tab = tabsState.tabs.find((t) => t.id === id)
  return tab ? tab.savedRecipeData : null
}

export function closeTab (id) {
  const idx = tabsState.tabs.findIndex((t) => t.id === id)
  if (idx === -1) return null

  const isActive = tabsState.activeTabId === id
  tabsState.tabs.splice(idx, 1)

  if (tabsState.tabs.length === 0) {
    const newTab = createTab()
    tabsState.activeTabId = newTab.id
    return { newActiveId: newTab.id, recipeData: newTab.savedRecipeData }
  }

  if (isActive) {
    const newIdx = Math.min(idx, tabsState.tabs.length - 1)
    tabsState.activeTabId = tabsState.tabs[newIdx].id
    return {
      newActiveId: tabsState.activeTabId,
      recipeData: tabsState.tabs[newIdx].savedRecipeData
    }
  }

  return null
}

export function renameTab (id, newLabel) {
  const tab = tabsState.tabs.find((t) => t.id === id)
  if (tab && newLabel.trim()) {
    tab.label = newLabel.trim()
  }
}

export function initTabsState (initialRecipeData = null) {
  if (tabsState.tabs.length > 0) return
  const tab = createTab(initialRecipeData)
  tabsState.activeTabId = tab.id
}

export function persistTabsToCache () {
  try {
    saveCurrentTabSnapshot()
    const state = {
      tabs: tabsState.tabs.map((t) => ({
        id: t.id,
        label: t.label,
        savedRecipeData: t.savedRecipeData
      })),
      activeTabId: tabsState.activeTabId,
      nextTabNum: tabsState.nextTabNum
    }
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors.
  }
}

export function restoreTabsFromCache () {
  try {
    const raw = localStorage.getItem(TABS_STORAGE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw)
    if (!state || !Array.isArray(state.tabs) || state.tabs.length === 0) {
      return null
    }
    tabsState.tabs = state.tabs
    tabsState.activeTabId = state.activeTabId
    if (
      typeof state.nextTabNum === 'number' &&
      state.nextTabNum > tabsState.nextTabNum
    ) {
      tabsState.nextTabNum = state.nextTabNum
    }
    const activeTab = getActiveTab()
    return activeTab ? activeTab.savedRecipeData : null
  } catch {
    return null
  }
}
