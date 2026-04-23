import { isFavorite, toggleFavorite, getFavorites } from './user-data.js'

class LikedTracksManager {
  constructor() {
    this.likedTrackIds = new Set()
    this.currentUser = null
    this.initialized = false
    this.init()
  }

  init() {
    // Listen for auth state changes
    document.addEventListener('authStateChanged', (e) => {
      this.handleAuthChange(e.detail.user)
    })

    // Also check for window.userAuth (for pages that load auth.js)
    if (window.userAuth) {
      this.handleAuthChange(window.userAuth.getCurrentUser())
    }

    // Listen for auth initialization
    document.addEventListener('includes:loaded', () => {
      if (window.userAuth) {
        this.handleAuthChange(window.userAuth.getCurrentUser())
      }
    })
  }

  async handleAuthChange(user) {
    if (user && user.uid !== this.currentUser?.uid) {
      this.currentUser = user
      await this.loadLikedTracks()
    } else if (!user) {
      this.currentUser = null
      this.likedTrackIds.clear()
      this.initialized = false
    }
  }

  async loadLikedTracks() {
    if (!this.currentUser) {
      this.likedTrackIds.clear()
      this.initialized = false
      return
    }

    try {
      const favorites = await getFavorites(this.currentUser.uid, 500)
      this.likedTrackIds = new Set(favorites.map(f => f.trackId))
      this.initialized = true
      console.log('[LikedTracksManager] Loaded', this.likedTrackIds.size, 'liked tracks')
      
      // Dispatch event to notify all pages that liked tracks are loaded
      this.dispatchUpdateEvent()
    } catch (error) {
      console.error('[LikedTracksManager] Error loading liked tracks:', error)
      this.likedTrackIds.clear()
      this.initialized = false
    }
  }

  isTrackLiked(trackId) {
    return this.likedTrackIds.has(trackId)
  }

  async toggleLike(track, btn = null) {
    if (!this.currentUser) {
      console.warn('[LikedTracksManager] User not authenticated')
      return { liked: false, requiresAuth: true }
    }

    const trackId = track.id
    const currentlyLiked = this.isTrackLiked(trackId)

    // Optimistic UI update
    if (currentlyLiked) {
      this.likedTrackIds.delete(trackId)
    } else {
      this.likedTrackIds.add(trackId)
    }

    // Update UI immediately if button provided
    if (btn) {
      this.updateButtonUI(btn, !currentlyLiked)
    }

    // Dispatch event to update all other heart icons on the page
    this.dispatchUpdateEvent(trackId, !currentlyLiked)

    try {
      const result = await toggleFavorite(this.currentUser.uid, track)
      
      // Sync with actual result
      if (result.liked !== !currentlyLiked) {
        // Rollback if server result differs
        if (result.liked) {
          this.likedTrackIds.add(trackId)
        } else {
          this.likedTrackIds.delete(trackId)
        }
        if (btn) {
          this.updateButtonUI(btn, result.liked)
        }
        this.dispatchUpdateEvent(trackId, result.liked)
      }

      return result
    } catch (error) {
      console.error('[LikedTracksManager] Error toggling like:', error)
      
      // Rollback on error
      if (currentlyLiked) {
        this.likedTrackIds.add(trackId)
      } else {
        this.likedTrackIds.delete(trackId)
      }
      if (btn) {
        this.updateButtonUI(btn, currentlyLiked)
      }
      this.dispatchUpdateEvent(trackId, currentlyLiked)
      
      return { liked: currentlyLiked, error }
    }
  }

  updateButtonUI(btn, isLiked) {
    const icon = btn.querySelector('i')
    if (icon) {
      if (isLiked) {
        icon.classList.remove('far')
        icon.classList.add('fas')
        btn.classList.add('liked')
      } else {
        icon.classList.remove('fas')
        icon.classList.add('far')
        btn.classList.remove('liked')
      }
    }
  }

  dispatchUpdateEvent(trackId = null, isLiked = null) {
    const event = new CustomEvent('likedTracksUpdated', {
      detail: {
        trackId,
        isLiked,
        allLikedIds: Array.from(this.likedTrackIds)
      }
    })
    document.dispatchEvent(event)
  }

  // Update all heart icons for a specific track across the page
  updateTrackHeartIcons(trackId, isLiked) {
    const buttons = document.querySelectorAll(`.like-btn-mini[data-like-track-id="${trackId}"]`)
    buttons.forEach(btn => {
      this.updateButtonUI(btn, isLiked)
    })
  }

  // Update all heart icons on the page based on current liked state
  updateAllHeartIcons() {
    const buttons = document.querySelectorAll('.like-btn-mini[data-like-track-id]')
    buttons.forEach(btn => {
      const trackId = btn.dataset.likeTrackId
      const isLiked = this.isTrackLiked(trackId)
      this.updateButtonUI(btn, isLiked)
    })
  }

  // Force reload from Firestore
  async refresh() {
    await this.loadLikedTracks()
  }
}

// Create singleton instance
const likedTracksManager = new LikedTracksManager()

// Make it available globally
window.likedTracksManager = likedTracksManager

// Export for module usage
export { likedTracksManager }
