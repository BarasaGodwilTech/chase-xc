import { fetchPublishedTracks, fetchArtistById, fetchTrackById } from './data/content-repo.js'

// Track detail page functionality
let currentTrack = null
let artistData = null

// Format number helper
function formatNumber(num) {
  if (typeof num !== 'number') return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return String(num)
}

// Get track badge
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

// Get track ID from URL
function getTrackIdFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return params.get('id')
}

// Load track data
async function loadTrackData() {
  const trackId = getTrackIdFromUrl()
  
  if (!trackId) {
    showError('No track ID provided')
    return
  }
  
  try {
    // Fetch track data
    currentTrack = await fetchTrackById(trackId)
    
    if (!currentTrack) {
      showError('Track not found')
      return
    }
    
    // Update page title
    document.title = `${currentTrack.title} - Chase x Records`
    
    // Fetch artist data if available
    if (currentTrack.artist) {
      artistData = await fetchArtistById(currentTrack.artist)
    }
    
    // Render track details
    renderTrackDetails()
    
    // Setup event listeners
    setupEventListeners()
    
    // Load more from artist
    await loadMoreFromArtist()
    
  } catch (error) {
    console.error('[TrackDetail] Error loading track:', error)
    showError('Error loading track details')
  }
}

// Render track details
function renderTrackDetails() {
  const artwork = document.getElementById('trackArtwork')
  const title = document.getElementById('trackTitle')
  const artist = document.getElementById('trackArtist')
  const genre = document.getElementById('trackGenre')
  const duration = document.getElementById('trackDuration')
  const release = document.getElementById('trackRelease')
  const streams = document.getElementById('trackStreams')
  const likes = document.getElementById('trackLikes')
  const badge = document.getElementById('trackBadge')
  const spotifyBtn = document.getElementById('spotifyBtn')
  const artistSocials = document.getElementById('artistSocials')
  
  // Set artwork
  if (artwork) {
    artwork.src = currentTrack.artwork || 'public/player-cover-1.jpg'
    artwork.alt = currentTrack.title || 'Track Artwork'
  }
  
  // Set title and artist
  if (title) title.textContent = currentTrack.title || 'Unknown Track'
  if (artist) artist.textContent = artistData?.name || currentTrack.artistName || 'Unknown Artist'
  
  // Set meta info
  if (genre) genre.textContent = currentTrack.genre || ''
  if (duration) duration.textContent = currentTrack.duration || ''
  if (release) {
    const releaseDate = currentTrack.releaseDate ? new Date(currentTrack.releaseDate) : null
    release.textContent = releaseDate ? releaseDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''
  }
  
  // Set stats
  if (streams) streams.textContent = formatNumber(currentTrack.streams || 0)
  if (likes) likes.textContent = formatNumber(currentTrack.likes || 0)
  
  // Set badge
  const badgeData = getTrackBadge(currentTrack)
  if (badge && badgeData) {
    badge.className = `track-detail-badge ${badgeData.type}`
    badge.textContent = badgeData.text
    badge.style.display = 'inline-block'
  } else if (badge) {
    badge.style.display = 'none'
  }
  
  // Spotify link
  const spotifyUrl = currentTrack.spotifyUrl || currentTrack.platformLinks?.spotify
  if (spotifyBtn && spotifyUrl) {
    spotifyBtn.href = spotifyUrl
    spotifyBtn.style.display = 'inline-flex'
  } else if (spotifyBtn) {
    spotifyBtn.style.display = 'none'
  }
  
  // Artist socials
  if (artistSocials && artistData?.socials) {
    const socials = artistData.socials
    artistSocials.innerHTML = `
      <h3 class="socials-title">Follow the Artist</h3>
      <div class="social-links">
        ${socials.instagram ? `<a href="${socials.instagram}" target="_blank" title="Instagram"><i class="fab fa-instagram"></i></a>` : ''}
        ${socials.youtube ? `<a href="${socials.youtube}" target="_blank" title="YouTube"><i class="fab fa-youtube"></i></a>` : ''}
        ${socials.tiktok ? `<a href="${socials.tiktok}" target="_blank" title="TikTok"><i class="fab fa-tiktok"></i></a>` : ''}
        ${socials.spotify ? `<a href="${socials.spotify}" target="_blank" title="Spotify"><i class="fab fa-spotify"></i></a>` : ''}
        ${socials.soundcloud ? `<a href="${socials.soundcloud}" target="_blank" title="SoundCloud"><i class="fab fa-soundcloud"></i></a>` : ''}
        ${socials.twitter ? `<a href="${socials.twitter}" target="_blank" title="Twitter"><i class="fab fa-twitter"></i></a>` : ''}
      </div>
    `
  }
}

// Setup event listeners
function setupEventListeners() {
  const playBtn = document.getElementById('playBtn')
  const likeBtn = document.getElementById('likeBtn')
  const playlistBtn = document.getElementById('playlistBtn')
  const shareBtn = document.getElementById('shareBtn')
  
  // Play button
  if (playBtn) {
    playBtn.addEventListener('click', () => handlePlayTrack())
  }
  
  // Like button
  if (likeBtn) {
    likeBtn.addEventListener('click', () => handleLikeTrack(likeBtn))
  }
  
  // Add to playlist button
  if (playlistBtn) {
    playlistBtn.addEventListener('click', () => handleAddToPlaylist())
  }
  
  // Share button
  if (shareBtn) {
    shareBtn.addEventListener('click', () => handleShareTrack())
  }
}

// Handle play track
function handlePlayTrack() {
  if (!currentTrack) return
  
  console.log('[TrackDetail] Playing track:', currentTrack.title)
  
  // Check if track has audio URL
  if (currentTrack.audioUrl && currentTrack.audioUrl.trim() !== '') {
    // Play using audio player
    if (window.audioPlayer) {
      // Add track to window.__tracks if not already there
      if (!window.__tracks) {
        window.__tracks = []
      }
      
      // Find or add track in window.__tracks
      let trackIndex = window.__tracks.findIndex(t => t.id === currentTrack.id)
      if (trackIndex === -1) {
        window.__tracks.push(currentTrack)
        trackIndex = window.__tracks.length - 1
      }
      
      window.audioPlayer.currentTrackIndex = trackIndex
      window.audioPlayer.loadTrack(trackIndex)
      window.audioPlayer.play()
    } else {
      console.error('[TrackDetail] Audio player not available')
    }
  } else {
    // Check for external links
    const externalUrl = currentTrack.spotifyUrl || currentTrack.platformLinks?.spotify || currentTrack.platformLinks?.soundcloud || currentTrack.platformLinks?.youtube
    
    if (externalUrl) {
      openExternalPlayer(externalUrl)
    } else {
      alert('No audio available for this track')
    }
  }
}

// Handle like track
function handleLikeTrack(btn) {
  if (!currentTrack) return
  
  console.log('[TrackDetail] Liking track:', currentTrack.id)
  
  // Check if user is authenticated
  if (!isUserAuthenticated()) {
    storePendingAction('like', { trackId: currentTrack.id })
    redirectToAuth()
    return
  }
  
  // Toggle like state
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
  
  console.log('[TrackDetail] User authenticated, proceeding with like action')
}

// Handle add to playlist
function handleAddToPlaylist() {
  if (!currentTrack) return
  
  console.log('[TrackDetail] Adding to playlist:', currentTrack.title)
  
  // Check if user is authenticated
  if (!isUserAuthenticated()) {
    storePendingAction('addToPlaylist', { trackId: currentTrack.id, trackData: currentTrack })
    redirectToAuth()
    return
  }
  
  console.log('[TrackDetail] User authenticated, proceeding with add to playlist action')
}

// Handle share track
function handleShareTrack() {
  if (!currentTrack) return
  
  console.log('[TrackDetail] Sharing track:', currentTrack.title)
  
  const shareData = {
    title: currentTrack.title,
    text: `Listen to ${currentTrack.title} by ${currentTrack.artistName || 'Unknown Artist'}`,
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

// Open external player
function openExternalPlayer(url) {
  const params = new URLSearchParams()
  params.set('title', currentTrack.title)
  params.set('artist', currentTrack.artistName || 'Unknown Artist')
  params.set('artwork', currentTrack.artwork || '')
  params.set('url', url)
  
  const redirectUrl = `listen-external.html?${params.toString()}`
  window.open(redirectUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes')
}

// Load more from artist
async function loadMoreFromArtist() {
  const container = document.getElementById('moreTracksGrid')
  const section = document.getElementById('moreFromArtist')
  
  if (!container || !currentTrack?.artist) {
    if (section) section.style.display = 'none'
    return
  }
  
  try {
    const allTracks = await fetchPublishedTracks()
    const artistTracks = allTracks.filter(t => 
      t.artist === currentTrack.artist && t.id !== currentTrack.id
    ).slice(0, 4)
    
    if (artistTracks.length === 0) {
      if (section) section.style.display = 'none'
      return
    }
    
    // Populate window.__tracks for audio player
    if (!window.__tracks) {
      window.__tracks = []
    }
    
    container.innerHTML = artistTracks.map((track, index) => {
      const existingIndex = window.__tracks.findIndex(t => t.id === track.id)
      const trackIndex = existingIndex === -1 ? (window.__tracks.push(track) - 1) : existingIndex
      
      const badge = getTrackBadge(track)
      const spotifyUrl = track.spotifyUrl || track.platformLinks?.spotify || ''
      
      return `
        <div class="track-card" data-track="${trackIndex}" data-track-id="${track.id}">
          <div class="track-artwork">
            <img src="${track.artwork || ''}" alt="${track.title || ''}">
            ${badge ? `<div class="track-badge ${badge.type}">${badge.text}</div>` : ''}
            ${spotifyUrl ? '<div class="spotify-indicator" title="Listen on Spotify"><i class="fab fa-spotify"></i></div>' : ''}
            <button class="track-play-btn" title="Play" type="button">
              <i class="fas fa-play"></i>
            </button>
          </div>
          <div class="track-content">
            <div class="track-header">
              <div class="track-info">
                <h4 class="track-title">${track.title || ''}</h4>
                <p class="track-artist">${track.artistName || artistData?.name || 'Unknown Artist'}</p>
              </div>
              <button class="like-btn-mini" title="Like" data-like-track-id="${track.id}" type="button">
                <i class="far fa-heart"></i>
              </button>
            </div>
            <div class="track-meta">
              <span class="track-genre">${track.genre || ''}</span>
              <span class="track-duration">${track.duration || ''}</span>
            </div>
          </div>
        </div>
      `
    }).join('')
    
    // Setup event listeners for more tracks
    setupMoreTracksListeners()
    
  } catch (error) {
    console.error('[TrackDetail] Error loading more tracks:', error)
    if (section) section.style.display = 'none'
  }
}

// Setup event listeners for more tracks section
function setupMoreTracksListeners() {
  // Play button listeners
  document.querySelectorAll('#moreTracksGrid .track-play-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const card = btn.closest('.track-card')
      const trackIndex = parseInt(card.dataset.track)
      const track = window.__tracks[trackIndex]
      
      if (track && window.audioPlayer) {
        window.audioPlayer.currentTrackIndex = trackIndex
        window.audioPlayer.loadTrack(trackIndex)
        window.audioPlayer.play()
      }
    })
  })
  
  // Like button listeners
  document.querySelectorAll('#moreTracksGrid .like-btn-mini').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const trackId = btn.dataset.likeTrackId
      handleLikeTrack(btn)
    })
  })
  
  // Spotify indicator click
  document.querySelectorAll('#moreTracksGrid .spotify-indicator').forEach(indicator => {
    indicator.addEventListener('click', (e) => {
      e.stopPropagation()
      const card = indicator.closest('.track-card')
      const trackIndex = parseInt(card.dataset.track)
      const track = window.__tracks[trackIndex]
      
      if (track) {
        const spotifyUrl = track.spotifyUrl || track.platformLinks?.spotify
        if (spotifyUrl) {
          window.open(spotifyUrl, '_blank')
        }
      }
    })
  })
}

// Helper functions for auth
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
    returnUrl: window.location.href
  }
  sessionStorage.setItem('pendingAction', JSON.stringify(pendingAction))
  console.log('[TrackDetail] Stored pending action:', pendingAction)
}

function redirectToAuth() {
  const currentUrl = window.location.href
  const authUrl = `auth.html?redirect=${encodeURIComponent(currentUrl)}`
  window.location.href = authUrl
}

// Show error message
function showError(message) {
  const container = document.querySelector('.track-detail-container')
  if (container) {
    container.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-circle"></i>
        <h2>${message}</h2>
        <a href="music.html" class="btn btn-primary">Back to Music</a>
      </div>
    `
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('[data-include]')) return
  loadTrackData()
})

document.addEventListener('includes:loaded', loadTrackData)
