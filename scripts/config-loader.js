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
      basePrice: 0,
      price: 0,
      description: ''
    },
    monthly: {
      basePrice: 0,
      price: 0,
      description: ''
    },
    yearly: {
      basePrice: 0,
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
  },
  contact: {
    phone: '',
    email: '',
    location: '',
    whatsapp: ''
  },
  social: {
    instagram: '',
    youtube: '',
    tiktok: '',
    twitter: '',
    spotify: ''
  },
  about: {
    projects: '',
    artists: '',
    streams: ''
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

// Get budget tiers
function getBudgetTiers() {
  return studioConfig.budgetTiers || {}
}

// Get contact details
function getContactDetails() {
  return studioConfig.contact || {}
}

// Get social links
function getSocialLinks() {
  return studioConfig.social || {}
}

// Populate DOM with contact and social data
function populateContactAndSocialData() {
  const contact = studioConfig.contact || {}
  const social = studioConfig.social || {}

  // Populate homepage hero social links
  const heroInstagram = document.getElementById('heroInstagram')
  const heroYouTube = document.getElementById('heroYouTube')
  const heroTikTok = document.getElementById('heroTikTok')

  if (heroInstagram && social.instagram) heroInstagram.href = social.instagram
  if (heroYouTube && social.youtube) heroYouTube.href = social.youtube
  if (heroTikTok && social.tiktok) heroTikTok.href = social.tiktok

  // Populate contact page elements
  const contactEmailLink = document.getElementById('contactEmailLink')
  const contactPhone = document.getElementById('contactPhone')
  const contactEmail = document.getElementById('contactEmail')
  const contactPhoneLink = document.getElementById('contactPhoneLink')

  if (contactEmailLink && contact.email) {
    contactEmailLink.href = `mailto:${contact.email}`
    contactEmailLink.textContent = contact.email
  }
  if (contactPhone && contact.phone) {
    contactPhone.textContent = contact.phone
  }
  if (contactEmail && contact.email) {
    contactEmail.textContent = contact.email
  }
  if (contactPhoneLink && contact.phone) {
    contactPhoneLink.href = `tel:${contact.phone}`
    contactPhoneLink.textContent = contact.phone
  }

  // Populate contact page social links
  const contactInstagram = document.getElementById('contactInstagram')
  const contactYouTube = document.getElementById('contactYouTube')
  const contactSpotify = document.getElementById('contactSpotify')
  const contactTikTok = document.getElementById('contactTikTok')
  const contactTwitter = document.getElementById('contactTwitter')

  if (contactInstagram && social.instagram) contactInstagram.href = social.instagram
  if (contactYouTube && social.youtube) contactYouTube.href = social.youtube
  if (contactSpotify && social.spotify) contactSpotify.href = social.spotify
  if (contactTikTok && social.tiktok) contactTikTok.href = social.tiktok
  if (contactTwitter && social.twitter) contactTwitter.href = social.twitter

  // Populate footer contact info
  const footerPhone = document.getElementById('footerPhone')
  const footerEmail = document.getElementById('footerEmail')
  const footerLocation = document.getElementById('footerLocation')
  const whatsappFloat = document.getElementById('whatsappFloat')

  if (footerPhone && contact.phone) footerPhone.textContent = contact.phone
  if (footerEmail && contact.email) footerEmail.textContent = contact.email
  if (footerLocation && contact.location) footerLocation.textContent = contact.location

  // Populate WhatsApp floating button
  if (whatsappFloat && social.whatsapp) {
    // Remove any non-digit characters for the WhatsApp API
    const cleanNumber = social.whatsapp.replace(/\D/g, '')
    whatsappFloat.href = `https://wa.me/${cleanNumber}`
  }

  // Hide WhatsApp floating button when footer copyright area is visible
  if (whatsappFloat && !window.__whatsappFooterObserverAttached) {
    window.__whatsappFooterObserverAttached = true

    const attach = () => {
      const footerBottom = document.querySelector('.footer-bottom')
      if (!footerBottom) return false

      const setHidden = (hidden) => {
        whatsappFloat.style.display = hidden ? 'none' : ''
      }

      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
          (entries) => {
            const isVisible = entries.some(e => e.isIntersecting)
            setHidden(isVisible)
          },
          { root: null, threshold: 0.01 }
        )
        observer.observe(footerBottom)
      } else {
        const onScroll = () => {
          const rect = footerBottom.getBoundingClientRect()
          const isVisible = rect.top < window.innerHeight && rect.bottom > 0
          setHidden(isVisible)
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll)
        onScroll()
      }

      return true
    }

    if (!attach()) {
      let tries = 0
      const t = setInterval(() => {
        tries += 1
        if (attach() || tries > 40) clearInterval(t)
      }, 250)
    }
  }

  // Populate footer social links
  const footerInstagram = document.getElementById('footerInstagram')
  const footerYouTube = document.getElementById('footerYouTube')
  const footerSpotify = document.getElementById('footerSpotify')
  const footerTikTok = document.getElementById('footerTikTok')
  const footerTwitter = document.getElementById('footerTwitter')

  if (footerInstagram && social.instagram) footerInstagram.href = social.instagram
  if (footerYouTube && social.youtube) footerYouTube.href = social.youtube
  if (footerSpotify && social.spotify) footerSpotify.href = social.spotify
  if (footerTikTok && social.tiktok) footerTikTok.href = social.tiktok
  if (footerTwitter && social.twitter) footerTwitter.href = social.twitter

  console.log('✅ Contact and social data populated in DOM')
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
  
  // Populate contact and social data
  populateContactAndSocialData()
  
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
    
    // Populate contact and social data when settings change
    populateContactAndSocialData()
    
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
  getBudgetTiers,
  getContactDetails,
  getSocialLinks,
  populateContactAndSocialData,
  getPlans,
  onSettingsUpdate,
  initSettings
}

// Auto-initialize when imported
initSettings().catch(console.error)
