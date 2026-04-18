// Config Loader - Fetches and caches studio settings from Firebase
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'

import { db } from './firebase-init.js'

const SETTINGS_DOC_ID = 'studio_settings'
const SETTINGS_COLLECTION = 'settings'

// Global config object
let studioConfig = {
  payment: {
    mtn: '',
    airtel: '',
    bank: {
      name: '',
      account: '',
      accountName: ''
    },
    supportPhone: ''
  },
  plans: {
    weekly: {
      price: 0,
      description: ''
    },
    monthly: {
      price: 0,
      description: ''
    },
    yearly: {
      price: 0,
      description: ''
    }
  },
  services: {
    production: 0,
    mixing: 0,
    mastering: 0,
    vocal: 0,
    hourlyRate: 0,
    packagePrice: 0,
    songwriting: 0,
    restoration: 0,
    sessionMusicianMin: 0,
    sessionMusicianMax: 0
  },
  budgetTiers: {
    standard: 0,
    classic: 0,
    premium: 0,
    deluxe: 0
  }
}

// Load settings from Firebase
async function loadSettings() {
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID)
    const docSnap = await getDoc(settingsRef)
    
    if (docSnap.exists()) {
      studioConfig = docSnap.data()
      console.log('✅ Settings loaded from Firebase:', studioConfig)
    } else {
      console.log('⚠️ No settings found in Firebase, using defaults')
      // Create default settings document
      await setDoc(settingsRef, studioConfig)
    }
    
    return studioConfig
  } catch (error) {
    console.error('❌ Error loading settings:', error)
    return studioConfig
  }
}

// Save settings to Firebase
async function saveSettings(config) {
  try {
    const settingsRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID)
    await setDoc(settingsRef, {
      ...config,
      updatedAt: new Date().toISOString()
    })
    
    studioConfig = config
    console.log('✅ Settings saved to Firebase')
    return true
  } catch (error) {
    console.error('❌ Error saving settings:', error)
    return false
  }
}

// Get current config
function getConfig() {
  return studioConfig
}

// Get payment details
function getPaymentDetails() {
  return studioConfig.payment || {}
}

// Get plans
function getPlans() {
  return studioConfig.plans || {}
}

// Listen for real-time settings updates
function onSettingsUpdate(callback) {
  const settingsRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID)
  return onSnapshot(settingsRef, (doc) => {
    if (doc.exists()) {
      studioConfig = doc.data()
      console.log('🔄 Settings updated:', studioConfig)
      callback(studioConfig)
    }
  })
}

// Initialize settings on page load
async function initSettings() {
  await loadSettings()
  
  // Make config available globally
  window.studioConfig = studioConfig
  
  // Update homepage plan cards if the global function exists
  if (window.updatePlanCardsFromConfig && window.studioConfig) {
    window.updatePlanCardsFromConfig(window.studioConfig)
  }
  
  // Update service prices if the global function exists
  if (window.updateServicePricesFromConfig && window.studioConfig) {
    window.updateServicePricesFromConfig(window.studioConfig)
  }
  
  // Update budget tiers if the global function exists
  if (window.updateBudgetTiersFromConfig && window.studioConfig) {
    window.updateBudgetTiersFromConfig(window.studioConfig)
  }
  
  // Update billing cycle options if the global function exists
  if (window.updateBillingCycleOptionsFromConfig && window.studioConfig) {
    window.updateBillingCycleOptionsFromConfig(window.studioConfig)
  }
  
  // Set up real-time listener
  onSettingsUpdate((newConfig) => {
    studioConfig = newConfig
    window.studioConfig = newConfig
    
    // Update homepage plan cards when settings change
    if (window.updatePlanCardsFromConfig) {
      window.updatePlanCardsFromConfig(newConfig)
    }
    
    // Update service prices when settings change
    if (window.updateServicePricesFromConfig) {
      window.updateServicePricesFromConfig(newConfig)
    }
    
    // Update budget tiers when settings change
    if (window.updateBudgetTiersFromConfig) {
      window.updateBudgetTiersFromConfig(newConfig)
    }
    
    // Update billing cycle options when settings change
    if (window.updateBillingCycleOptionsFromConfig) {
      window.updateBillingCycleOptionsFromConfig(newConfig)
    }
    
    // Dispatch event for other scripts to listen
    window.dispatchEvent(new CustomEvent('settingsUpdated', {
      detail: newConfig
    }))
  })
  
  return studioConfig
}

// Export functions
export {
  loadSettings,
  saveSettings,
  getConfig,
  getPaymentDetails,
  getPlans,
  onSettingsUpdate,
  initSettings
}

// Auto-initialize when imported
initSettings().catch(console.error)
