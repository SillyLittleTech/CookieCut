// --- STATE ---
export const recipeData = {
  title: '',
  description: '',
  items: [],
  settings: {
    fontStyle: 'display',
    fontApplyToText: false, // also apply font to description and text items
    fontApplyToTips: false, // also apply font to tips/toasts
    editorMode: 'classic', // 'classic' or 'inline'
    previewMode: 'continuous', // 'continuous' or 'paged'
    fileName: '', // custom filename for print/download
    hideTitle: false, // hide the title in preview
    hideDescription: false // hide the description in preview
  }
}
