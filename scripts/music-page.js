import { fetchPublishedTracks, fetchArtistById, fetchArtists } from './data/content-repo.js'

function formatNumber(num) {
  if (typeof num !== 'number') return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return String(num)
}

function getTrackCategories(track) {
  const categories = ['all']
  if (track.featured) categories.push('featured')

  if (Array.isArray(track.categories)) categories.push(...track.categories)

  if ((track.streams || 0) > 50000) categories.push('popular')
  if ((track.streams || 0) > 100000) categories.push('trending')

  const releaseDate = track.releaseDate ? new Date(track.releaseDate) : null
  if (releaseDate) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    if (releaseDate > thirtyDaysAgo) categories.push('new')
  }

  return categories
}

function getTrackBadge(track) {
  if ((track.streams || 0) > 100000) return { type: 'trending', text: 'Trending' }
  if ((track.streams || 0) > 50000) return { type: 'popular', text: 'Popular' }

  const releaseDate = track.releaseDate ? new Date(track.releaseDate) : null
  if (releaseDate) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    if (releaseDate > thirtyDaysAgo) return { type: 'new-release', text: 'New' }
  }

  return null
}

function getSampleTracks() {
  return [
    {
      id: 'sample-1',
      title: 'Blessed',
      artistName: 'Chase XC',
      genre: 'Afro-Pop',
      duration: '3:45',
      artwork: 'public/player-cover-1.jpg',
      audioUrl: '',
      streams: 125000,
      likes: 8500,
      downloads: 3200,
      status: 'published',
      releaseDate: '2024-01-15',
      featured: true,
      categories: ['afro-pop', 'dance']
    },
    {
      id: 'sample-2',
      title: 'Midnight Groove',
      artistName: 'Chase XC',
      genre: 'Electronic',
      duration: '4:12',
      artwork: 'public/player-cover-2.jpg',
      audioUrl: '',
      streams: 89000,
      likes: 6200,
      downloads: 2100,
      status: 'published',
      releaseDate: '2024-02-20',
      featured: false,
      categories: ['electronic', 'house']
    },
    {
      id: 'sample-3',
      title: 'Summer Vibes',
      artistName: 'Chase XC',
      genre: 'Dancehall',
      duration: '3:28',
      artwork: 'public/player-cover-3.jpg',
      audioUrl: '',
      streams: 67000,
      likes: 4100,
      downloads: 1800,
      status: 'published',
      releaseDate: '2024-03-10',
      featured: true,
      categories: ['dancehall', 'afrobeat']
    },
    {
      id: 'sample-4',
      title: 'City Lights',
      artistName: 'Chase XC',
      genre: 'R&B',
      duration: '3:55',
      artwork: 'public/player-cover-4.jpg',
      audioUrl: '',
      streams: 45000,
      likes: 3200,
      downloads: 1200,
      status: 'published',
      releaseDate: '2024-04-05',
      featured: false,
      categories: ['r&b', 'soul']
    }
  ]
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

function renderTrackCard(track, index, artistName, artistSocials = {}) {
  const categories = getTrackCategories(track)
  const badge = getTrackBadge(track)
  const spotifyUrl = track.spotifyUrl || (track.platformLinks?.spotify) || ''

  return `
    <div class="track-card" data-track="${index}" data-category="${categories.join(' ')}" data-spotify-url="${spotifyUrl}" data-track-id="${track.id || ''}">
      <div class="track-artwork">
        <img src="${escapeHtml(track.artwork || '')}" alt="${escapeHtml(track.title || '')}">
        ${badge ? `<div class="track-badge ${badge.type}">${badge.text}</div>` : ''}
        ${spotifyUrl ? '<div class="spotify-indicator" title="Listen on Spotify"><i class="fab fa-spotify"></i></div>' : ''}
        <button class="track-play-btn" aria-label="Play ${escapeHtml(track.title || '')}" type="button">
          <i class="fas fa-play"></i>
        </button>
      </div>
      <div class="track-content">
        <div class="track-header">
          <div class="track-info">
            <h4 class="track-title">${escapeHtml(track.title || '')}</h4>
            <p class="track-artist">${escapeHtml(artistName || track.artistName || 'Unknown Artist')}</p>
          </div>
          <button class="like-btn-mini" title="Like" data-like-track-id="${track.id}" type="button">
            <i class="far fa-heart"></i>
          </button>
        </div>
      </div>
    </div>
  `
}

async function renderLatestReleases(tracks) {
  const container = document.getElementById('latestReleases')
  if (!container) return

  // Get the 3 most recent published tracks
  const latestTracks = tracks
    .filter(track => track.status === 'published')
    .sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0))
    .slice(0, 3)

  if (latestTracks.length === 0) {
    container.innerHTML = '<p class="text-center">No latest releases yet</p>'
    return
  }

  // Render using full track card functionality
  const cards = latestTracks.map((track, index) => renderTrackCard(track, index, track.artistName))
  container.innerHTML = cards.join('')
}

async function renderGenreCards(tracks) {
  const container = document.getElementById('genreGrid')
  if (!container) return

  // Extract unique genres and count tracks
  const genreStats = new Map()
  tracks.forEach(track => {
    if (track.genre) {
      const stats = genreStats.get(track.genre) || { tracks: 0, streams: 0 }
      stats.tracks += 1
      stats.streams += track.streams || 0
      genreStats.set(track.genre, stats)
    }
  })

  if (genreStats.size === 0) {
    container.innerHTML = '<p class="text-center">No genres available yet</p>'
    return
  }

  // Genre icons mapping
  const genreIcons = {
    'Afro-Pop': 'fa-headphones-alt',
    'Dancehall': 'fa-microphone-alt',
    'R&B': 'fa-solid fa-piano',
    'Electronic': 'fa-music',
    'Afrobeat': 'fa-drum',
    'Afro-House': 'fa-compact-disc'
  }

  container.innerHTML = Array.from(genreStats.entries()).map(([genre, stats]) => {
    const icon = genreIcons[genre] || 'fa-music'
    return `
      <div class="service-card genre-card">
        <div class="service-icon"><i class="fas ${icon}"></i></div>
        <h4>${genre}</h4>
        <p>Music in the ${genre} genre</p>
        <span class="track-count">${stats.tracks} tracks</span>
        <div class="genre-stats">
          <span>${formatNumber(stats.streams)} Streams</span>
        </div>
        <button class="btn btn-sm btn-outline">Explore</button>
      </div>
    `
  }).join('')
}

async function initMusicPage() {
  const grid = document.getElementById('musicGrid')
  const resultsCount = document.getElementById('resultsCount')

  console.log('[MusicPage] Initializing music page...')
  let tracks
  try {
    console.log('[MusicPage] Fetching published tracks from Firestore...')
    tracks = await fetchPublishedTracks()
    console.log('[MusicPage] Fetched tracks:', tracks)
  } catch (e) {
    console.error('[MusicPage] Error fetching tracks:', e)
    if (grid) grid.innerHTML = '<p class="text-center">Error loading tracks. Please check console for details.</p>'
    if (resultsCount) resultsCount.textContent = '0 tracks'
    return
  }

  if (!Array.isArray(tracks) || tracks.length === 0) {
    console.log('[MusicPage] No tracks found or invalid data format, using sample tracks')
    // Use sample tracks as fallback
    tracks = getSampleTracks()
  }

  const artistCache = new Map()
  async function resolveArtistName(track) {
    const id = track.artist
    if (!id) return { name: track.artistName || 'Unknown Artist', socials: {} }
    if (artistCache.has(id)) return artistCache.get(id)
    const artist = await fetchArtistById(id)
    const artistData = {
      name: artist?.name || track.artistName || 'Unknown Artist',
      socials: artist?.socials || {}
    }
    artistCache.set(id, artistData)
    return artistData
  }

  const normalizedTracks = []
  for (let i = 0; i < tracks.length; i++) {
    const artistData = await resolveArtistName(tracks[i])
    const normalized = {
      ...tracks[i],
      artistName: artistData.name,
    }
    normalizedTracks.push(normalized)
  }

  // Used by audio-player.js (which prefers window.__tracks when present)
  window.__tracks = normalizedTracks

  // Render all tracks initially using the filtered rendering system
  renderFilteredTracks(normalizedTracks)
  if (resultsCount) resultsCount.textContent = `${normalizedTracks.length} track${normalizedTracks.length !== 1 ? 's' : ''}`

  // Dispatch event for loading skeleton to hide
  document.dispatchEvent(new CustomEvent('music:loaded'))

  // Render Latest Releases section
  await renderLatestReleases(normalizedTracks)

  // Render Genre cards section
  await renderGenreCards(normalizedTracks)

  // Setup button event listeners
  setupTrackCardListeners()
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
  
  // Search functionality
  const searchInput = document.getElementById('musicSearch')
  const searchClear = document.getElementById('searchClear')
  const resultsCount = document.getElementById('resultsCount')

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim()
      handleSearch(query)

      // Show/hide clear button
      if (searchClear) {
        searchClear.style.display = query ? 'flex' : 'none'
      }
    })
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = ''
        handleSearch('')
        searchClear.style.display = 'none'
      }
    })
  }

  // Filter buttons (All, New, Popular, Trending)
  const filterButtons = document.querySelectorAll('.filter-btn')
  filterButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const filter = button.dataset.filter
      filterState.currentFilter = filter

      // Update active state
      filterButtons.forEach(btn => btn.classList.remove('active'))
      button.classList.add('active')

      applyAllFilters()
    })
  })

  // Advanced filters
  const sortBy = document.getElementById('sortBy')
  const genreFilter = document.getElementById('genreFilter')
  const durationFilter = document.getElementById('durationFilter')
  const searchFilterToggle = document.getElementById('searchFilterToggle')
  const searchFilters = document.getElementById('searchFilters')

  if (sortBy) {
    sortBy.addEventListener('change', (e) => {
      filterState.sortBy = e.target.value
      applyAllFilters()
    })
  }

  if (genreFilter) {
    genreFilter.addEventListener('change', (e) => {
      filterState.genreFilter = e.target.value
      applyAllFilters()
    })
  }

  if (durationFilter) {
    durationFilter.addEventListener('change', (e) => {
      filterState.durationFilter = e.target.value
      applyAllFilters()
    })
  }

  // Filter toggle
  if (searchFilterToggle && searchFilters) {
    searchFilterToggle.addEventListener('click', () => {
      searchFilters.classList.toggle('active')
      searchFilterToggle.classList.toggle('active')
    })
  }
}

// Unified filtering state
const filterState = {
  currentFilter: 'all',
  searchTerm: '',
  genreFilter: 'all',
  durationFilter: 'all',
  sortBy: 'relevance'
}

function parseDuration(durationStr) {
  if (!durationStr) return 0
  const parts = durationStr.split(':').map(Number)
  if (parts.length >= 2) {
    return parts[0] * 60 + parts[1]
  }
  return parts[0] || 0
}

function applyAllFilters() {
  const grid = document.getElementById('musicGrid')
  const resultsCount = document.getElementById('resultsCount')
  
  if (!window.__tracks || !Array.isArray(window.__tracks)) {
    console.warn('[MusicPage] No tracks available for filtering')
    return
  }

  let filteredTracks = [...window.__tracks]

  // Apply category filter (All, New, Popular, Trending)
  if (filterState.currentFilter !== 'all') {
    filteredTracks = filteredTracks.filter(track => {
      const categories = getTrackCategories(track)
      return categories.includes(filterState.currentFilter)
    })
  }

  // Apply search term
  if (filterState.searchTerm) {
    const query = filterState.searchTerm.toLowerCase()
    filteredTracks = filteredTracks.filter(track => {
      const title = (track.title || '').toLowerCase()
      const artist = (track.artistName || '').toLowerCase()
      const genre = (track.genre || '').toLowerCase()
      return title.includes(query) || artist.includes(query) || genre.includes(query)
    })
  }

  // Apply genre filter
  if (filterState.genreFilter !== 'all') {
    filteredTracks = filteredTracks.filter(track => {
      const genre = (track.genre || '').toLowerCase()
      return genre.includes(filterState.genreFilter.toLowerCase())
    })
  }

  // Apply duration filter
  if (filterState.durationFilter !== 'all') {
    filteredTracks = filteredTracks.filter(track => {
      const duration = parseDuration(track.duration)
      switch (filterState.durationFilter) {
        case 'short': return duration > 0 && duration < 180
        case 'medium': return duration >= 180 && duration <= 300
        case 'long': return duration > 300
        default: return true
      }
    })
  }

  // Apply sorting
  switch (filterState.sortBy) {
    case 'newest':
      filteredTracks.sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0))
      break
    case 'oldest':
      filteredTracks.sort((a, b) => new Date(a.releaseDate || 0) - new Date(b.releaseDate || 0))
      break
    case 'popular':
      filteredTracks.sort((a, b) => (b.streams || 0) - (a.streams || 0))
      break
    case 'duration':
      filteredTracks.sort((a, b) => parseDuration(b.duration) - parseDuration(a.duration))
      break
    default: // relevance - keep original order
      break
  }

  // Re-render the grid with filtered tracks
  renderFilteredTracks(filteredTracks)

  // Update results count
  if (resultsCount) {
    resultsCount.textContent = `${filteredTracks.length} track${filteredTracks.length !== 1 ? 's' : ''}`
  }
}

function renderFilteredTracks(tracks) {
  const grid = document.getElementById('musicGrid')
  if (!grid) return

  // Remove existing no results message
  const existingMessage = grid.querySelector('.no-results-message')
  if (existingMessage) {
    existingMessage.remove()
  }

  if (tracks.length === 0) {
    // Show no results message
    grid.innerHTML = `
      <div class="no-results-message">
        <div class="no-results-content">
          <i class="fas fa-music"></i>
          <h4>No Results Found</h4>
          <p>Try adjusting your filters or search terms</p>
        </div>
      </div>
    `
    return
  }

  // Render filtered tracks
  const cards = tracks.map((track, index) => renderTrackCard(track, index, track.artistName))
  grid.innerHTML = cards.join('')

  // Re-setup event listeners for new cards
  setupTrackCardListeners()
}

function handleSearch(query) {
  filterState.searchTerm = query
  applyAllFilters()
}

function handlePlayTrack(track) {
  console.log('[MusicPage] Playing track:', track.title)
  
  // Use persistent floating player for all tracks
  if (window.persistentPlayer) {
    // Build full playlist from all tracks if not set
    if (window.persistentPlayer.playlist.length === 0 && window.__tracks?.length > 0) {
      const fullPlaylist = window.__tracks.map(t => ({
        id: t.id,
        title: t.title,
        artistName: t.artistName,
        artwork: t.artwork,
        audioUrl: t.audioUrl,
        platformLinks: t.platformLinks || {},
        originalData: t
      }));
      window.persistentPlayer.setPlaylist(fullPlaylist, 0);
    }
    
    // Find track index in playlist
    const existingIndex = window.persistentPlayer.playlist.findIndex(t => t.id === track.id);
    if (existingIndex !== -1) {
      window.persistentPlayer.currentIndex = existingIndex;
      window.persistentPlayer.loadTrack(window.persistentPlayer.playlist[existingIndex]);
    } else {
      // Track not in playlist, add it
      window.persistentPlayer.playlist.push({
        id: track.id,
        title: track.title,
        artistName: track.artistName,
        artwork: track.artwork,
        audioUrl: track.audioUrl,
        platformLinks: track.platformLinks || {},
        originalData: track
      });
      window.persistentPlayer.currentIndex = window.persistentPlayer.playlist.length - 1;
      window.persistentPlayer.loadTrack(track);
    }
    
    // For audio files, also sync with main audio player if available
    if (track.audioUrl && track.audioUrl.trim() !== '' && window.audioPlayer) {
      let trackIndex = window.__tracks.findIndex(t => t.id === track.id)
      if (trackIndex === -1) {
        window.__tracks.push(track)
        trackIndex = window.__tracks.length - 1
      }
      window.audioPlayer.currentTrackIndex = trackIndex
      window.audioPlayer.loadTrack(trackIndex)
    }
    
    window.persistentPlayer.play()
  } else {
    console.error('[MusicPage] Persistent player not available')
  }
}

function openExternalPlayer(url, track = null) {
  // Show notification if persistent player available
  if (window.persistentPlayer) {
    window.persistentPlayer.showNotification(`Opening "${track?.title || 'track'}" in external player`, 'info')
  }
  // Open in new tab instead of popup
  window.open(url, '_blank')
}

function handleLikeTrack(trackId, btn) {
  console.log('[MusicPage] Liking track:', trackId)
  
  // Check if user is authenticated
  if (!isUserAuthenticated()) {
    // Store pending action for after login
    storePendingAction('like', { trackId })
    redirectToAuth()
    return
  }
  
  // User is authenticated, proceed with like action
  const uid = window.userAuth?.getCurrentUser?.()?.uid
  if (!uid) return

  // Optimistic UI
  toggleLikeButton(btn)

  import('./user-data.js').then(async ({ toggleFavorite }) => {
    try {
      const track = (window.__tracks || []).find(t => t.id === trackId) || { id: trackId }
      const result = await toggleFavorite(uid, track)

      // Ensure UI matches final state
      const icon = btn.querySelector('i')
      if (result.liked) {
        icon?.classList.remove('far')
        icon?.classList.add('fas')
        btn.classList.add('liked')
      } else {
        icon?.classList.remove('fas')
        icon?.classList.add('far')
        btn.classList.remove('liked')
      }
    } catch (e) {
      console.error('[MusicPage] Failed to toggle favorite:', e)
      // Rollback on error
      toggleLikeButton(btn)
      if (window.notifications) window.notifications.show('Error saving favorite.', 'error')
    }
  })
}

function handleShareTrack(track) {
  console.log('[MusicPage] Sharing track:', track.title)
  
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
  console.log('[MusicPage] Adding to playlist:', track.title)

  // Check if user is authenticated
  if (!isUserAuthenticated()) {
    // Store pending action for after login
    storePendingAction('addToPlaylist', { trackId: track.id, trackData: track })
    redirectToAuth()
    return
  }

  // User is authenticated, proceed with add to playlist action
  // This would typically make an API call to your backend
  // TODO: Call your backend API to add track to playlist
  // Only show success message after API call succeeds
  console.log('[MusicPage] User authenticated, proceeding with add to playlist action')
  // showNotification('Successfully added to playlist!', 'success') // Uncomment after implementing backend API
}

// Helper function to check if user is authenticated
function isUserAuthenticated() {
  // Use centralized userAuth from auth.js
  if (typeof window.userAuth !== 'undefined' && window.userAuth.isLoggedIn()) {
    return true
  }
  return false
}

// Helper function to store pending action
function storePendingAction(actionType, actionData) {
  const pendingAction = {
    type: actionType,
    data: actionData,
    timestamp: Date.now(),
    returnUrl: window.location.pathname
  }
  sessionStorage.setItem('pendingAction', JSON.stringify(pendingAction))
  console.log('[MusicPage] Stored pending action:', pendingAction)
}

// Helper function to redirect to auth page
function redirectToAuth() {
  const currentUrl = window.location.href
  const authUrl = `auth.html?redirect=${encodeURIComponent(currentUrl)}`
  window.location.href = authUrl
}

// Helper function to toggle like button visual state
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
        console.warn('[MusicPage] Unknown pending action type:', pendingAction.type)
    }

    // Clear pending action after attempting to execute
    sessionStorage.removeItem('pendingAction')
  } catch (e) {
    console.error('[MusicPage] Error executing pending action:', e)
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
  // Only show success message after API call succeeds
  console.log('[MusicPage] Liked track after login:', trackId)
  // showNotification('Added to liked tracks!', 'success') // Uncomment after implementing backend API
}

function handleAddToPlaylistAfterLogin(trackData) {
  // TODO: Call your backend API to add track to playlist
  // Only show success message after API call succeeds
  console.log('[MusicPage] Added to playlist after login:', trackData.title)
  // showNotification('Successfully added to playlist!', 'success') // Uncomment after implementing backend API
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

function boot() {
  initMusicPage().catch(console.error)
  // Execute any pending action after login
  setTimeout(() => executePendingAction(), 500)
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('[data-include]')) return
  boot()
})

document.addEventListener('includes:loaded', () => {
  boot()
})
