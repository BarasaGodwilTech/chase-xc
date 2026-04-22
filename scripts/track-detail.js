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
  
  // Back button - let anchor href work naturally
  // No JavaScript needed - the <a href="music.html"> handles navigation
  
  // Setup track card listeners for "More from Artist" section
  setupTrackCardListeners()
}

// Handle play track
function handlePlayTrack() {
  if (!currentTrack) return
  
  console.log('[TrackDetail] Playing track:', currentTrack.title)
  
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
    const existingIndex = window.persistentPlayer.playlist.findIndex(t => t.id === currentTrack.id);
    if (existingIndex !== -1) {
      window.persistentPlayer.currentIndex = existingIndex;
      window.persistentPlayer.loadTrack(window.persistentPlayer.playlist[existingIndex]);
    } else {
      // Track not in playlist, add it
      window.persistentPlayer.playlist.push({
        id: currentTrack.id,
        title: currentTrack.title,
        artistName: currentTrack.artistName,
        artwork: currentTrack.artwork,
        audioUrl: currentTrack.audioUrl,
        platformLinks: currentTrack.platformLinks || {},
        originalData: currentTrack
      });
      window.persistentPlayer.currentIndex = window.persistentPlayer.playlist.length - 1;
      window.persistentPlayer.loadTrack(currentTrack);
    }
    
    // For audio files, also sync with main audio player if available
    if (currentTrack.audioUrl && currentTrack.audioUrl.trim() !== '' && window.audioPlayer) {
      // Add track to window.__tracks if not already there
      if (!window.__tracks) {
        window.__tracks = []
      }
      
      let trackIndex = window.__tracks.findIndex(t => t.id === currentTrack.id)
      if (trackIndex === -1) {
        window.__tracks.push(currentTrack)
        trackIndex = window.__tracks.length - 1
      }
      
      window.audioPlayer.currentTrackIndex = trackIndex
      window.audioPlayer.loadTrack(trackIndex)
    }
    
    window.persistentPlayer.play()
  } else {
    console.error('[TrackDetail] Persistent player not available')
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
  
  const uid = window.userAuth?.getCurrentUser?.()?.uid
  if (!uid) return

  // Optimistic UI
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

  import('./user-data.js').then(async ({ toggleFavorite }) => {
    try {
      const result = await toggleFavorite(uid, currentTrack)
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
      console.error('[TrackDetail] Failed to toggle favorite:', e)
      // rollback
      if (icon.classList.contains('far')) {
        icon.classList.remove('far')
        icon.classList.add('fas')
        btn.classList.add('liked')
      } else {
        icon.classList.remove('fas')
        icon.classList.add('far')
        btn.classList.remove('liked')
      }
      if (window.notifications) window.notifications.show('Error saving favorite.', 'error')
    }
  })
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

// Open external player - just open in new tab
function openExternalPlayer(url) {
  if (window.persistentPlayer) {
    window.persistentPlayer.showNotification(`Opening "${currentTrack.title}" in external player`, 'info')
  }
  window.open(url, '_blank')
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
            <button class="track-play-btn" aria-label="Play ${track.title || ''}" type="button">
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
      
      if (track && window.persistentPlayer) {
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
        
        // Also sync with audio player for audio files
        if (track.audioUrl && track.audioUrl.trim() !== '' && window.audioPlayer) {
          window.audioPlayer.currentTrackIndex = trackIndex
          window.audioPlayer.loadTrack(trackIndex)
        }
        
        window.persistentPlayer.play()
      }
    })
  })
  
  // Card click listeners - navigate to detail page
  document.querySelectorAll('#moreTracksGrid .track-card').forEach(card => {
    card.addEventListener('click', (e) => {
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

// Setup track card listeners (called from setupEventListeners)
function setupTrackCardListeners() {
  // This is called after loadMoreFromArtist, so we set up listeners there
  // This function exists for compatibility
}

// Helper functions for auth
function isUserAuthenticated() {
  // Use centralized userAuth from auth.js
  if (typeof window.userAuth !== 'undefined' && window.userAuth.isLoggedIn()) {
    return true
  }
  return false
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
