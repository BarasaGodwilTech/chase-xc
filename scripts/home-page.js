import { fetchArtists } from './data/content-repo.js'

function formatNumber(num) {
  if (typeof num !== 'number') return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return String(num)
}

// Helper to escape HTML
function escapeHtml(str) {
  if (!str) return ''
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;'
    if (m === '<') return '&lt;'
    if (m === '>') return '&gt;'
    return m
  })
}

function renderArtistCard(artist, index) {
  const imageUrl = artist.image || artist.artwork || 'images/headphones.png'
  const genre = artist.genre || 'Music'
  const bio = artist.bio || artist.description || 'Talented artist at Chase x Records'
  const socials = artist.socials || {}
  
  return `
    <div class="artist-card" data-artist="${index}">
      <div class="artist-image">
        <img src="${imageUrl}" alt="${artist.name || 'Artist'}">
      </div>
      <h4>${artist.name || 'Unknown Artist'}</h4>
      <p class="artist-genre">${genre}</p>
      <p class="artist-bio">${bio}</p>
      <div class="artist-stats">
        <span>${artist.trackCount || 0} Releases</span>
        <span>Since ${artist.sinceYear || '2024'}</span>
      </div>
      <div class="artist-socials">
        ${socials.instagram ? `<a href="${socials.instagram}" target="_blank" title="Instagram"><i class="fab fa-instagram"></i></a>` : ''}
        ${socials.spotify ? `<a href="${socials.spotify}" target="_blank" title="Spotify"><i class="fab fa-spotify"></i></a>` : ''}
        ${socials.youtube ? `<a href="${socials.youtube}" target="_blank" title="YouTube"><i class="fab fa-youtube"></i></a>` : ''}
        ${socials.soundcloud ? `<a href="${socials.soundcloud}" target="_blank" title="SoundCloud"><i class="fab fa-soundcloud"></i></a>` : ''}
        ${socials.tiktok ? `<a href="${socials.tiktok}" target="_blank" title="TikTok"><i class="fab fa-tiktok"></i></a>` : ''}
        ${socials.appleMusic ? `<a href="${socials.appleMusic}" target="_blank" title="Apple Music"><i class="fab fa-apple"></i></a>` : ''}
      </div>
    </div>
  `
}

async function loadFeaturedArtists() {
  console.log('[HomePage] Loading featured artists...')
  const container = document.querySelector('#artists .artists-grid')
  
  if (!container) {
    console.log('[HomePage] Artists grid container not found')
    return
  }

  try {
    const artists = await fetchArtists()
    console.log('[HomePage] Fetched artists:', artists.length)

    if (!Array.isArray(artists) || artists.length === 0) {
      container.innerHTML = '<p class="text-center">No artists available yet. Check back soon!</p>'
      return
    }

    // Filter for active artists and limit to 4 for the homepage
    const activeArtists = artists
      .filter(artist => artist.status === 'active' || !artist.status)
      .slice(0, 4)

    if (activeArtists.length === 0) {
      container.innerHTML = '<p class="text-center">No active artists available yet. Check back soon!</p>'
      return
    }

    container.innerHTML = activeArtists.map((artist, index) => renderArtistCard(artist, index)).join('')
    console.log('[HomePage] Rendered', activeArtists.length, 'artists')
  } catch (error) {
    console.error('[HomePage] Error loading artists:', error)
    container.innerHTML = '<p class="text-center">Error loading artists. Please check console for details.</p>'
  }
}

async function loadFeaturedTracks() {
  console.log('[HomePage] Loading featured tracks...')
  const container = document.querySelector('#music .music-grid')

  if (!container) {
    console.log('[HomePage] Music grid container not found (might be commented out)')
    return
  }

  try {
    const { fetchPublishedTracks, fetchArtistById } = await import('./data/content-repo.js')
    const tracks = await fetchPublishedTracks()
    console.log('[HomePage] Fetched tracks:', tracks.length)

    if (!Array.isArray(tracks) || tracks.length === 0) {
      container.innerHTML = '<p class="text-center">No tracks available yet. Check back soon!</p>'
      return
    }

    // Limit to 4 featured tracks for the homepage
    const featuredTracks = tracks.slice(0, 4)

    // Fetch artist data for each track
    const artistCache = new Map()
    const tracksWithArtists = await Promise.all(featuredTracks.map(async (track) => {
      let artistSocials = {}
      if (track.artist) {
        if (artistCache.has(track.artist)) {
          artistSocials = artistCache.get(track.artist)
        } else {
          const artist = await fetchArtistById(track.artist)
          artistSocials = artist?.socials || {}
          artistCache.set(track.artist, artistSocials)
        }
      }
      return { ...track, artistSocials }
    }))

    // Populate window.__tracks for audio player compatibility (same as music-page.js)
    window.__tracks = tracksWithArtists.map((track) => ({
      ...track,
      artistName: track.artistName || 'Unknown Artist'
    }))

    container.innerHTML = tracksWithArtists.map((track, index) => {
      const categories = ['all']
      if (track.featured) categories.push('featured')
      if ((track.streams || 0) > 50000) categories.push('popular')
      if ((track.streams || 0) > 100000) categories.push('trending')

      const releaseDate = track.releaseDate ? new Date(track.releaseDate) : null
      if (releaseDate) {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        if (releaseDate > thirtyDaysAgo) categories.push('new')
      }

      const badge = (track.streams || 0) > 100000 ? 'Trending' :
                   (track.streams || 0) > 50000 ? 'Popular' :
                   (releaseDate && releaseDate > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) ? 'New' : ''

      const spotifyUrl = track.spotifyUrl || (track.platformLinks?.spotify) || ''

      return `
        <div class="track-card" data-track="${index}" data-category="${categories.join(' ')}" data-spotify-url="${spotifyUrl}" data-track-id="${track.id || ''}">
          <div class="track-artwork">
            <img src="${escapeHtml(track.artwork || '')}" alt="${escapeHtml(track.title || '')}">
            ${badge ? `<div class="track-badge ${badge === 'Trending' ? 'trending' : badge === 'Popular' ? 'popular' : 'new-release'}">${badge}</div>` : ''}
            ${spotifyUrl ? '<div class="spotify-indicator" title="Listen on Spotify"><i class="fab fa-spotify"></i></div>' : ''}
            <button class="track-play-btn" aria-label="Play ${escapeHtml(track.title || '')}" type="button">
              <i class="fas fa-play"></i>
            </button>
          </div>
          <div class="track-content">
            <div class="track-header">
              <div class="track-info">
                <h4 class="track-title">${escapeHtml(track.title || '')}</h4>
                <p class="track-artist">${escapeHtml(track.artistName || 'Unknown Artist')}</p>
              </div>
              <button class="like-btn-mini" title="Like" data-like-track-id="${track.id}" type="button">
                <i class="far fa-heart"></i>
              </button>
            </div>
          </div>
        </div>
      `
    }).join('')

    console.log('[HomePage] Rendered', featuredTracks.length, 'tracks')

    // Setup event listeners for the newly rendered track cards
    setupTrackCardListeners()
  } catch (error) {
    console.error('[HomePage] Error loading tracks:', error)
    if (container) {
      container.innerHTML = '<p class="text-center">Error loading tracks. Please check console for details.</p>'
    }
  }
}

function setupTrackCardListeners() {
  // Play button listeners - plays track on all devices
  document.querySelectorAll('.track-play-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const card = btn.closest('.track-card')
      const trackIndex = parseInt(card.dataset.track)
      const track = window.__tracks[trackIndex]

      if (track) {
        handlePlayTrack(track)
      }
    })
  })

  // Card click listeners - navigate to detail page on all devices
  document.querySelectorAll('.track-card').forEach(card => {
    if (card._clickHandler) {
      card.removeEventListener('click', card._clickHandler)
    }
    
    card._clickHandler = (e) => {
      // Don't navigate if clicking on play button, like button, or spotify indicator
      if (e.target.closest('.track-play-btn') || 
          e.target.closest('.like-btn-mini') || 
          e.target.closest('.spotify-indicator')) {
        return
      }
      const trackId = card.dataset.trackId
      if (trackId) {
        window.location.href = `track-detail.html?id=${trackId}`
      }
    }
    card.addEventListener('click', card._clickHandler)
  })

  // Like button listeners
  document.querySelectorAll('.like-btn-mini[data-like-track-id]').forEach(btn => {
    if (btn._likeHandler) {
      btn.removeEventListener('click', btn._likeHandler)
    }
    btn._likeHandler = (e) => {
      e.stopPropagation()
      const trackId = btn.dataset.likeTrackId
      handleLikeTrack(trackId, btn)
    }
    btn.addEventListener('click', btn._likeHandler)
  })

  // Spotify indicator click
  document.querySelectorAll('.spotify-indicator').forEach(indicator => {
    if (indicator._spotifyHandler) {
      indicator.removeEventListener('click', indicator._spotifyHandler)
    }
    indicator._spotifyHandler = (e) => {
      e.stopPropagation()
      const card = indicator.closest('.track-card')
      const spotifyUrl = card.dataset.spotifyUrl

      if (spotifyUrl) {
        window.open(spotifyUrl, '_blank')
      }
    }
    indicator.addEventListener('click', indicator._spotifyHandler)
  })
}

function handlePlayTrack(track) {
  console.log('[HomePage] Playing track:', track.title)

  // Check if track has audio URL
  if (track.audioUrl && track.audioUrl.trim() !== '') {
    // Play using audio player
    if (window.audioPlayer) {
      window.audioPlayer.loadTrackByData(track.id)
    } else {
      console.error('[HomePage] Audio player not available')
    }
  } else {
    // Check for external links
    const externalUrl = track.spotifyUrl || track.platformLinks?.spotify || track.platformLinks?.soundcloud || track.platformLinks?.youtube

    if (externalUrl) {
      openExternalPlayer(externalUrl, track)
    } else {
      alert('No audio available for this track')
    }
  }
}

function handleLikeTrack(trackId, btn) {
  console.log('[HomePage] Liking track:', trackId)

  // Check if user is authenticated
  if (!isUserAuthenticated()) {
    // Store pending action for after login
    storePendingAction('like', { trackId })
    redirectToAuth()
    return
  }

  // User is authenticated, proceed with like action
  toggleLikeButton(btn)
  console.log('[HomePage] User authenticated, proceeding with like action')
}

function handleShareTrack(track) {
  console.log('[HomePage] Sharing track:', track.title)

  const shareData = {
    title: track.title,
    text: `Listen to ${track.title} by ${track.artistName}`,
    url: window.location.href
  }

  if (navigator.share) {
    navigator.share(shareData).catch(console.error)
  } else {
    // Fallback: copy to clipboard
    const shareText = `${shareData.text} - ${shareData.url}`
    navigator.clipboard.writeText(shareText).then(() => {
      alert('Link copied to clipboard!')
    }).catch(() => {
      prompt('Copy this link:', shareText)
    })
  }
}

function handleAddToPlaylist(track) {
  console.log('[HomePage] Adding to playlist:', track.title)

  // Check if user is authenticated
  if (!isUserAuthenticated()) {
    // Store pending action for after login
    storePendingAction('addToPlaylist', { trackId: track.id, trackData: track })
    redirectToAuth()
    return
  }

  // User is authenticated, proceed with add to playlist action
  console.log('[HomePage] User authenticated, proceeding with add to playlist action')
}

function openExternalPlayer(url, track = null) {
  // Show notification if persistent player available
  if (window.persistentPlayer) {
    window.persistentPlayer.showNotification(`Opening "${track?.title || 'track'}" in external player`, 'info')
  }
  // Open in new tab instead of popup
  window.open(url, '_blank')
}

function isUserAuthenticated() {
  if (typeof window.auth !== 'undefined' && window.auth.currentUser) {
    return true
  }
  const user = JSON.parse(sessionStorage.getItem('currentUser') || 'null')
  return user !== null
}

function storePendingAction(actionType, actionData) {
  const pendingAction = {
    type: actionType,
    data: actionData,
    timestamp: Date.now(),
    returnUrl: window.location.pathname
  }
  sessionStorage.setItem('pendingAction', JSON.stringify(pendingAction))
  console.log('[HomePage] Stored pending action:', pendingAction)
}

function redirectToAuth() {
  const currentUrl = window.location.href
  const authUrl = `auth.html?redirect=${encodeURIComponent(currentUrl)}`
  window.location.href = authUrl
}

function toggleLikeButton(btn) {
  const icon = btn.querySelector('i')
  if (icon.classList.contains('far')) {
    icon.classList.remove('far')
    icon.classList.add('fas')
    btn.classList.add('liked')
  } else {
    icon.classList.remove('fas')
    icon.classList.add('far')
    btn.classList.remove('liked')
  }
}

function initHomePage() {
  console.log('[HomePage] Initializing homepage...')
  loadFeaturedArtists()
  loadFeaturedTracks()
  setupTrackCardListeners()
  // Execute any pending action after login
  setTimeout(() => executePendingAction(), 500)
}

// Function to execute pending action after login
function executePendingAction() {
  checkLoginCancelled()

  const pendingActionStr = sessionStorage.getItem('pendingAction')
  if (!pendingActionStr) return

  try {
    const pendingAction = JSON.parse(pendingActionStr)

    switch (pendingAction.type) {
      case 'like':
        handleLikeAfterLogin(pendingAction.data.trackId)
        break
      case 'addToPlaylist':
        handleAddToPlaylistAfterLogin(pendingAction.data.trackData)
        break
      default:
        console.warn('[HomePage] Unknown pending action type:', pendingAction.type)
    }

    // Clear pending action after attempting to execute
    sessionStorage.removeItem('pendingAction')
  } catch (e) {
    console.error('[HomePage] Error executing pending action:', e)
    sessionStorage.removeItem('pendingAction')
  }
}

// Function to check if login was cancelled and notify user
function checkLoginCancelled() {
  const loginCancelled = sessionStorage.getItem('loginCancelled')
  if (loginCancelled === 'true') {
    sessionStorage.removeItem('loginCancelled')
    sessionStorage.removeItem('pendingAction')
    showNotification('Action cancelled. Please log in to like or add tracks to your playlist.', 'info')
  }
}

function handleLikeAfterLogin(trackId) {
  // Find the button for this track
  const btn = document.querySelector(`.like-btn-mini[data-like-track-id="${trackId}"]`)
  if (btn) {
    toggleLikeButton(btn)
  }
  // TODO: Call your backend API to like the track
  console.log('[HomePage] Liked track after login:', trackId)
}

function handleAddToPlaylistAfterLogin(trackData) {
  // TODO: Call your backend API to add track to playlist
  console.log('[HomePage] Added to playlist after login:', trackData.title)
}

// Helper function to show notifications
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div')
  notification.className = `notification notification-${type}`
  notification.textContent = message
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    font-weight: 500;
    max-width: 300px;
  `

  document.body.appendChild(notification)

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out'
    setTimeout(() => {
      document.body.removeChild(notification)
    }, 300)
  }, 3000)
}

async function boot() {
  try {
    await initHomePage()
  } catch (error) {
    console.error('[HomePage] Boot error:', error)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('[data-include]')) return
  boot()
})

document.addEventListener('includes:loaded', () => {
  boot()
})
