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

function renderTrackCard(track, index, artistName) {
  const categories = getTrackCategories(track)
  const badge = getTrackBadge(track)
  const spotifyUrl = track.spotifyUrl || (track.platformLinks?.spotify) || ''

  return `
    <div class="track-card" data-track="${index}" data-category="${categories.join(' ')}" data-spotify-url="${spotifyUrl}" data-track-id="${track.id || ''}">
      <div class="track-artwork">
        <img src="${track.artwork || ''}" alt="${track.title || ''}">
        <button class="play-btn-card" type="button">
          <i class="fas fa-play"></i>
        </button>
        ${badge ? `<div class="track-badge ${badge.type}">${badge.text}</div>` : ''}
        ${spotifyUrl ? '<div class="spotify-indicator" title="Listen on Spotify"><i class="fab fa-spotify"></i></div>' : ''}
        <div class="track-overlay">
          <div class="overlay-actions overlay-left">
            <button class="overlay-btn" title="Add to playlist" type="button">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          <div class="overlay-actions overlay-right">
            <button class="overlay-btn" title="Share" type="button">
              <i class="fas fa-share"></i>
            </button>
          </div>
        </div>
      </div>
      <div class="track-content">
        <div class="track-header">
          <div class="track-info">
            <h4 class="track-title">${track.title || ''}</h4>
            <p class="track-artist">${artistName || track.artistName || 'Unknown Artist'}</p>
          </div>
          <button class="like-btn-mini" title="Like" data-like-track-id="${track.id}" type="button">
            <i class="far fa-heart"></i>
          </button>
        </div>
        <div class="track-meta">
          <span class="track-genre">${track.genre || ''}</span>
          <span class="track-duration">${track.duration || ''}</span>
        </div>
        <div class="track-stats">
          <div class="stat">
            <i class="fas fa-play"></i>
            <span>${formatNumber(track.streams || 0)}</span>
          </div>
          <div class="stat">
            <i class="fas fa-heart"></i>
            <span>${formatNumber(track.likes || 0)}</span>
          </div>
          <div class="stat">
            <i class="fas fa-download"></i>
            <span>${formatNumber(track.downloads || 0)}</span>
          </div>
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

  container.innerHTML = latestTracks.map(track => {
    const releaseDate = track.releaseDate ? new Date(track.releaseDate) : new Date()
    const month = releaseDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    const day = releaseDate.getDate()

    return `
      <div class="release-item">
        <div class="release-date-circle">
          <span>${month}</span>
          <strong>${day}</strong>
        </div>
        <div class="release-content">
          <div class="release-artwork">
            <img src="${track.artwork || ''}" alt="${track.title || ''}">
          </div>
          <div class="release-info">
            <h4>${track.title || ''} - Single</h4>
            <p>${track.artistName || 'Unknown Artist'} • ${track.genre || ''} • ${track.duration || ''}</p>
            <div class="release-stats">
              <span>${formatNumber(track.streams || 0)} plays</span>
              <span>${formatNumber(track.likes || 0)} likes</span>
            </div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="window.audioPlayer?.loadTrackByData('${track.id}')">Listen</button>
        </div>
      </div>
    `
  }).join('')
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
    if (!id) return track.artistName || 'Unknown Artist'
    if (artistCache.has(id)) return artistCache.get(id)
    const artist = await fetchArtistById(id)
    const name = artist?.name || track.artistName || 'Unknown Artist'
    artistCache.set(id, name)
    return name
  }

  const cards = []
  const normalizedTracks = []
  for (let i = 0; i < tracks.length; i++) {
    const name = await resolveArtistName(tracks[i])
    const normalized = {
      ...tracks[i],
      artistName: name,
    }
    normalizedTracks.push(normalized)
    cards.push(renderTrackCard(normalized, i, name))
  }

  // Used by audio-player.js (which prefers window.__tracks when present)
  window.__tracks = normalizedTracks

  if (grid) grid.innerHTML = cards.join('')
  if (resultsCount) resultsCount.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`

  // Render Latest Releases section
  await renderLatestReleases(normalizedTracks)

  // Render Genre cards section
  await renderGenreCards(normalizedTracks)

  // Setup button event listeners
  setupTrackCardListeners()
}

function setupTrackCardListeners() {
  // Play button listeners
  document.querySelectorAll('.play-btn-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const card = btn.closest('.track-card')
      const trackIndex = card.dataset.track
      const track = window.__tracks[trackIndex]
      
      if (track) {
        handlePlayTrack(track)
      }
    })
  })

  // Like button listeners
  document.querySelectorAll('.like-btn-mini[data-like-track-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const trackId = btn.dataset.likeTrackId
      handleLikeTrack(trackId, btn)
    })
  })

  // Share button listeners
  document.querySelectorAll('.overlay-btn[title="Share"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const card = btn.closest('.track-card')
      const trackIndex = card.dataset.track
      const track = window.__tracks[trackIndex]
      
      if (track) {
        handleShareTrack(track)
      }
    })
  })

  // Add to playlist listeners
  document.querySelectorAll('.overlay-btn[title="Add to playlist"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const card = btn.closest('.track-card')
      const trackIndex = card.dataset.track
      const track = window.__tracks[trackIndex]
      
      if (track) {
        handleAddToPlaylist(track)
      }
    })
  })

  // Spotify indicator click
  document.querySelectorAll('.spotify-indicator').forEach(indicator => {
    indicator.addEventListener('click', (e) => {
      e.stopPropagation()
      const card = indicator.closest('.track-card')
      const spotifyUrl = card.dataset.spotifyUrl
      
      if (spotifyUrl) {
        openExternalPlayer(spotifyUrl)
      }
    })
  })
}

function handlePlayTrack(track) {
  console.log('[MusicPage] Playing track:', track.title)
  
  // Check if track has audio URL
  if (track.audioUrl && track.audioUrl.trim() !== '') {
    // Play using audio player
    if (window.audioPlayer) {
      window.audioPlayer.loadTrackByData(track.id)
    } else {
      console.error('[MusicPage] Audio player not available')
    }
  } else {
    // Check for external links (Spotify, SoundCloud, etc.)
    const externalUrl = track.spotifyUrl || track.platformLinks?.spotify || track.platformLinks?.soundcloud || track.platformLinks?.youtube
    
    if (externalUrl) {
      openExternalPlayer(externalUrl, track)
    } else {
      if (window.notifications) {
        window.notifications.show('No audio available for this track', 'warning')
      } else {
        console.warn('No audio available for this track')
      }
    }
  }
}

function openExternalPlayer(url, track = null) {
  // Create a URL with track info for the redirect page
  const params = new URLSearchParams()
  if (track) {
    params.set('title', track.title)
    params.set('artist', track.artistName)
    params.set('artwork', track.artwork)
  }
  params.set('url', url)
  
  // Open in a new tab/window with the redirect page
  const redirectUrl = `listen-external.html?${params.toString()}`
  window.open(redirectUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes')
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
  // This would typically make an API call to your backend
  toggleLikeButton(btn)
  // TODO: Call your backend API to like/unlike the track
  console.log('[MusicPage] User authenticated, proceeding with like action')
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
      if (window.notifications) {
        window.notifications.show('Link copied to clipboard!', 'success')
      } else {
        console.log('Link copied to clipboard!')
      }
    }).catch(() => {
      if (window.notifications && window.notifications.prompt) {
        window.notifications.prompt('Copy this link:', shareText)
      } else {
        console.log('Copy this link:', shareText)
      }
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
  console.log('[MusicPage] User authenticated, proceeding with add to playlist action')
  if (window.notifications) {
    window.notifications.show('Added to playlist!', 'success')
  } else {
    console.log('Added to playlist!')
  }
}

// Helper function to check if user is authenticated
function isUserAuthenticated() {
  // Check Firebase Auth
  if (typeof window.auth !== 'undefined' && window.auth.currentUser) {
    return true
  }
  
  // Check for custom auth implementation
  const user = JSON.parse(sessionStorage.getItem('currentUser') || 'null')
  return user !== null
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
  const pendingActionStr = sessionStorage.getItem('pendingAction')
  if (!pendingActionStr) return
  
  try {
    const pendingAction = JSON.parse(pendingActionStr)
    console.log('[MusicPage] Executing pending action:', pendingAction)
    
    // Clear pending action
    sessionStorage.removeItem('pendingAction')
    
    // Execute based on action type
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
  } catch (e) {
    console.error('[MusicPage] Error executing pending action:', e)
  }
}

function handleLikeAfterLogin(trackId) {
  // Find the button for this track
  const btn = document.querySelector(`.like-btn-mini[data-like-track-id="${trackId}"]`)
  if (btn) {
    toggleLikeButton(btn)
  }
  // TODO: Call your backend API to like the track
  console.log('[MusicPage] Liked track after login:', trackId)
}

function handleAddToPlaylistAfterLogin(trackData) {
  // TODO: Call your backend API to add track to playlist
  console.log('[MusicPage] Added to playlist after login:', trackData.title)
  if (window.notifications) {
    window.notifications.show('Added to playlist!', 'success')
  } else {
    console.log('Added to playlist!')
  }
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
