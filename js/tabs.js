// --- TABS MODULE ---
// Manages multi-document tab state, persistence, and snapshot operations.

import { recipeData } from './state.js'

export const tabsState = {
  tabs: [],
  activeTabId: null,
  nextTabNum: 1,
  groups: [],
  nextGroupNum: 1
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

export function moveTab (fromId, toId) {
  if (fromId === toId) return false
  const fromIdx = tabsState.tabs.findIndex((t) => t.id === fromId)
  const toIdx = tabsState.tabs.findIndex((t) => t.id === toId)
  if (fromIdx === -1 || toIdx === -1) return false
  const [tab] = tabsState.tabs.splice(fromIdx, 1)
  tabsState.tabs.splice(toIdx, 0, tab)
  return true
}

export function createGroup (label = null) {
  const id = `grp_${Date.now()}_${tabsState.nextGroupNum++}`
  const group = {
    id,
    label: label || `Group ${tabsState.groups.length + 1}`,
    color: 'b',
    collapsed: false
  }
  tabsState.groups.push(group)
  return group
}

export function renameGroup (id, newLabel) {
  const group = tabsState.groups.find((g) => g.id === id)
  if (group && newLabel.trim()) {
    group.label = newLabel.trim()
  }
}

export function setGroupColor (id, color) {
  const group = tabsState.groups.find((g) => g.id === id)
  if (group) group.color = color
}

export function toggleGroupCollapse (id) {
  const group = tabsState.groups.find((g) => g.id === id)
  if (group) group.collapsed = !group.collapsed
}

export function addTabToGroup (tabId, groupId) {
  const tab = tabsState.tabs.find((t) => t.id === tabId)
  if (tab) tab.groupId = groupId
}

export function removeTabFromGroup (tabId) {
  const tab = tabsState.tabs.find((t) => t.id === tabId)
  if (!tab || !tab.groupId) return

  const groupId = tab.groupId
  delete tab.groupId

  // Automatically remove the group if it no longer has any tabs
  const remainingGroupTabs = getGroupTabs(groupId)
  if (remainingGroupTabs.length === 0) {
    const groupIdx = tabsState.groups.findIndex((g) => g.id === groupId)
    if (groupIdx !== -1) {
      tabsState.groups.splice(groupIdx, 1)
    }
  }
}

export function getGroupTabs (groupId) {
  return tabsState.tabs.filter((t) => t.groupId === groupId)
}

export function closeGroupTabs (groupId) {
  const groupTabIds = new Set(
    tabsState.tabs.filter((t) => t.groupId === groupId).map((t) => t.id)
  )

  const groupIdx = tabsState.groups.findIndex((g) => g.id === groupId)
  if (groupIdx !== -1) tabsState.groups.splice(groupIdx, 1)

  if (groupTabIds.size === 0) return null

  const wasActiveInGroup = groupTabIds.has(tabsState.activeTabId)

  tabsState.tabs = tabsState.tabs.filter((t) => !groupTabIds.has(t.id))

  if (tabsState.tabs.length === 0) {
    const newTab = createTab()
    tabsState.activeTabId = newTab.id
    return { newActiveId: newTab.id, recipeData: newTab.savedRecipeData }
  }

  if (wasActiveInGroup) {
    const newActiveTab = tabsState.tabs[0]
    tabsState.activeTabId = newActiveTab.id
    return {
      newActiveId: tabsState.activeTabId,
      recipeData: newActiveTab.savedRecipeData
    }
  }

  return null
}

export function ungroupGroup (groupId) {
  tabsState.tabs.forEach((t) => {
    if (t.groupId === groupId) delete t.groupId
  })
  const idx = tabsState.groups.findIndex((g) => g.id === groupId)
  if (idx !== -1) tabsState.groups.splice(idx, 1)
}

export function moveGroup (groupId, beforeTabId) {
  // No-op if the target tab belongs to the group being moved
  const targetTab = tabsState.tabs.find((t) => t.id === beforeTabId)
  if (targetTab && targetTab.groupId === groupId) return false

  const groupTabs = tabsState.tabs.filter((t) => t.groupId === groupId)
  if (groupTabs.length === 0) return false

  tabsState.tabs = tabsState.tabs.filter((t) => t.groupId !== groupId)

  const insertIdx = tabsState.tabs.findIndex((t) => t.id === beforeTabId)
  const pos = insertIdx === -1 ? tabsState.tabs.length : insertIdx

  tabsState.tabs.splice(pos, 0, ...groupTabs)
  return true
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
        groupId: t.groupId,
        savedRecipeData: t.savedRecipeData
      })),
      activeTabId: tabsState.activeTabId,
      nextTabNum: tabsState.nextTabNum,
      groups: tabsState.groups.map((g) => ({ ...g })),
      nextGroupNum: tabsState.nextGroupNum
    }
    globalThis.localStorage?.setItem(TABS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors.
  }
}

export function restoreTabsFromCache () {
  try {
    const raw = globalThis.localStorage?.getItem(TABS_STORAGE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw)
    if (!state || !Array.isArray(state.tabs) || state.tabs.length === 0) {
      return null
    }
    const restoredTabs = state.tabs
    // Resolve a valid activeTabId; fall back to the first tab if stored ID is invalid.
    let resolvedActiveTabId = state.activeTabId
    const hasValidActiveTab = restoredTabs.some(
      (t) => t && t.id === resolvedActiveTabId
    )
    if (!hasValidActiveTab && restoredTabs[0]?.id != null) {
      resolvedActiveTabId = restoredTabs[0].id
    }
    tabsState.tabs = restoredTabs
    tabsState.activeTabId = resolvedActiveTabId
    if (
      typeof state.nextTabNum === 'number' &&
      state.nextTabNum > tabsState.nextTabNum
    ) {
      tabsState.nextTabNum = state.nextTabNum
    }
    if (Array.isArray(state.groups)) {
      tabsState.groups = state.groups
    }
    if (
      typeof state.nextGroupNum === 'number' &&
      state.nextGroupNum > tabsState.nextGroupNum
    ) {
      tabsState.nextGroupNum = state.nextGroupNum
    }
    const activeTab =
      tabsState.tabs.find((t) => t.id === tabsState.activeTabId) || null
    return activeTab ? activeTab.savedRecipeData : null
  } catch {
    return null
  }
}
