import { fetchArtists, fetchPublishedTracks } from './data/content-repo.js'
import { likedTracksManager } from './liked-tracks-manager.js'
import { getSocialLinks, onSettingsUpdate } from './config-loader.js'

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

function renderTalentCard(artist) {
  const imageUrl = artist.image || artist.artwork || 'images/headphones.png'
  const name = artist.name || 'Unknown Artist'
  const artistId = artist.id || ''

  const href = artistId ? `artist-detail.html?id=${encodeURIComponent(artistId)}` : 'artists.html'

  return `
    <a class="talent-card" href="${href}" ${artistId ? `data-artist-id="${escapeHtml(artistId)}"` : ''}>
      <div class="talent-card-media">
        <img class="talent-card-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}">
      </div>
      <div class="talent-card-name">${escapeHtml(name)}</div>
    </a>
  `
}

async function loadTalentMarquee() {
  const trackEl = document.querySelector('#talentMarqueeTrack')
  if (!trackEl) return

  try {
    const artists = await fetchArtists()

    const activeArtists = (Array.isArray(artists) ? artists : [])
      .filter((a) => a && (a.status === 'active' || !a.status))
      .filter((a) => a.name || a.id)

    if (activeArtists.length === 0) {
      trackEl.innerHTML = ''
      return
    }

    const baseCards = activeArtists.map((a) => renderTalentCard(a)).join('')
    
    // Only enable scrolling if there are at least 4 artists
    if (activeArtists.length >= 4) {
      trackEl.innerHTML = baseCards + baseCards
      const duration = Math.min(55, Math.max(22, activeArtists.length * 4.5))
      trackEl.style.setProperty('--marquee-duration', `${duration}s`)
    } else {
      // Show artists once without scrolling
      trackEl.innerHTML = baseCards
      trackEl.style.setProperty('--marquee-duration', '0s')
    }
  } catch (e) {
    console.error('[HomePage] Error loading talent marquee:', e)
    if (trackEl) trackEl.innerHTML = ''
  }
}

function renderArtistCard(artist, index) {
  const imageUrl = artist.image || artist.artwork || 'images/headphones.png'
  const genre = artist.genre || 'Music'
  const bio = artist.bio || artist.description || 'Talented artist at Chase x Records'
  const socials = artist.socials || {}
  
  return `
    <div class="artist-card" data-artist="${index}" data-artist-id="${escapeHtml(artist.id || '')}" role="button" tabindex="0">
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

function setupArtistCardListeners() {
  document.querySelectorAll('#artists .artist-card[data-artist-id]').forEach((card) => {
    if (card._artistNavBound) return
    card._artistNavBound = true

    const go = () => {
      const artistId = card.dataset.artistId
      if (!artistId) return
      const href = `artist-detail.html?id=${encodeURIComponent(artistId)}`
      if (typeof window.spaNavigate === 'function') {
        window.spaNavigate(href)
      } else {
        window.location.href = href
      }
    }

    card.addEventListener('click', (e) => {
      if (e.target.closest('.artist-socials a')) return
      go()
    })

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        go()
      }
    })
  })
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
    setupArtistCardListeners()
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

    const artistsById = new Map()
    for (const t of tracksWithArtists) {
      if (t?.artist) {
        try {
          const a = await fetchArtistById(t.artist)
          if (a?.id) artistsById.set(String(a.id), a)
        } catch (_) {}
      }
      for (const id of (Array.isArray(t?.collaborators) ? t.collaborators : [])) {
        try {
          const a = await fetchArtistById(id)
          if (a?.id) artistsById.set(String(a.id), a)
        } catch (_) {}
      }
    }

    const getDisplayArtistLine = (track) => {
      const collabIds = safeArray(track?.collaborators)
      const isCollab = collabIds.length > 0 || safeArray(track?.collaboratorNames).length > 0
      if (!isCollab) return track?.artistName || 'Unknown Artist'

      const resolvedNames = normalizeArtistParts([
        ...(safeArray(track?.collaboratorNames)),
        track?.artistName,
        ...collabIds.map((id) => artistsById.get(String(id))?.name || ''),
      ].filter(name => name && name !== 'Unknown Artist' && String(name).trim() !== ''))

      return resolvedNames.length > 0 ? resolvedNames.join(' & ') : 'Various Artists'
    }

    // Populate window.__tracks for audio player compatibility (same as music-page.js)
    window.__tracks = tracksWithArtists.map((track) => ({
      ...track,
      artistName: getDisplayArtistLine(track)
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
      const isLiked = likedTracksManager.isTrackLiked(track.id)

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
                <p class="track-artist">${escapeHtml(getDisplayArtistLine(track))}</p>
              </div>
              <button class="like-btn-mini ${isLiked ? 'liked' : ''}" title="Like" data-like-track-id="${track.id}" type="button">
                <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
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
        const href = `track-detail.html?id=${trackId}`
        if (typeof window.spaNavigate === 'function') {
          window.spaNavigate(href)
        } else {
          window.location.href = href
        }
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

  // Use persistent floating player for all tracks
  if (window.persistentPlayer) {
    // Build full playlist from all tracks if not set
    if (window.persistentPlayer.playlist.length === 0 && window.__tracks?.length > 0) {
      const fullPlaylist = window.__tracks.map(t => ({
        id: t.id,
        title: t.title,
        artistName: t.artistName,
        artwork: t.artwork,
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
        platformLinks: track.platformLinks || {},
        originalData: track
      });
      window.persistentPlayer.currentIndex = window.persistentPlayer.playlist.length - 1;
      window.persistentPlayer.loadTrack(track);
    }
    
    window.persistentPlayer.play()
  } else {
    console.error('[HomePage] Persistent player not available')
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

  // Use centralized liked tracks manager
  const track = (window.__tracks || []).find(t => t.id === trackId) || { id: trackId }
  likedTracksManager.toggleLike(track, btn).then(result => {
    if (result.error) {
      if (window.notifications) window.notifications.show('Error saving favorite.', 'error')
    }
  })
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
    returnUrl: window.location.pathname
  }
  sessionStorage.setItem('pendingAction', JSON.stringify(pendingAction))
  console.log('[HomePage] Stored pending action:', pendingAction)
}

function redirectToAuth() {
  const currentUrl = window.location.href
  const authUrl = `auth.html?redirect=${encodeURIComponent(currentUrl)}`
  if (typeof window.spaNavigate === 'function') {
    window.spaNavigate(authUrl)
  } else {
    window.location.href = authUrl
  }
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

// Helper functions for collaboration processing
function safeArray(val) {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)
  return []
}

function uniqueStrings(values) {
  const out = []
  const seen = new Set()
  for (const v of values || []) {
    const s = String(v || '').trim()
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

function splitArtistParts(name) {
  const raw = String(name || '').trim()
  if (!raw) return []

  return raw
    .split(/\s*(?:&|•|\+|,|\/|\bfeat\.?\b|\bft\.?\b|\bx\b)\s*/i)
    .map((p) => String(p || '').trim())
    .filter((p) => p && p.toLowerCase() !== 'unknown artist')
}

function normalizeArtistParts(values) {
  const parts = []
  for (const v of values || []) {
    parts.push(...splitArtistParts(v))
  }
  return uniqueStrings(parts)
}

function renderHomeCollaborationCard(track, index, artistsById = new Map()) {
  const collabIds = safeArray(track.collaborators)
  const isCollab = collabIds.length > 0 || safeArray(track.collaboratorNames).length > 0
  
  if (!isCollab) return ''

  const namesFromDoc = safeArray(track.collaboratorNames)
  const resolvedNames = normalizeArtistParts([
    track.artistName || '',
    ...namesFromDoc,
    ...collabIds.map((id) => artistsById.get(String(id))?.name || ''),
  ].filter(name => name && name !== 'Unknown Artist' && name.trim() !== ''))

  const artistsLine = resolvedNames.length > 0 ? resolvedNames.join(' & ') : 'Various Artists'
  const allIds = uniqueStrings([String(track.artist || '').trim(), ...collabIds].filter(Boolean))
  
  const avatars = allIds
    .map((id) => artistsById.get(String(id))?.image || '')
    .filter(Boolean)
    .slice(0, 3)

  const avatarHtml = avatars.length
    ? avatars.map((src) => `
        <span class="home-collab-avatar"><img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async"></span>
      `).join('')
    : ''

  const spotifyUrl = track.spotifyUrl || (track.platformLinks?.spotify) || ''
  const isLiked = likedTracksManager.isTrackLiked(track.id)

  return `
    <div class="home-collab-card" data-track-id="${track.id || ''}" data-collab-track-id="${track.id || ''}">
      <div class="home-collab-artwork">
        <img src="${escapeHtml(track.artwork || '')}" alt="${escapeHtml(track.title || '')}" loading="lazy" decoding="async">
        <button class="home-collab-play-btn" aria-label="Play ${escapeHtml(track.title || '')}" type="button" data-collab-play-track-id="${track.id || ''}">
          <i class="fas fa-play"></i>
        </button>
        ${spotifyUrl ? '<div class="home-collab-spotify" title="Listen on Spotify"><i class="fab fa-spotify"></i></div>' : ''}
      </div>
      <div class="home-collab-content">
        <div class="home-collab-main">
          <h4 class="home-collab-title">${escapeHtml(track.title || '')}</h4>
          <p class="home-collab-artists">${escapeHtml(artistsLine)}</p>
        </div>
        <div class="home-collab-meta">
          <div class="home-collab-avatars">${avatarHtml}</div>
          <button class="home-collab-like-btn ${isLiked ? 'liked' : ''}" title="Like" data-like-track-id="${track.id}" type="button">
            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
          </button>
        </div>
      </div>
    </div>
  `
}

async function loadHomeCollaborations() {
  console.log('[HomePage] Loading home collaborations...')
  const container = document.getElementById('homeCollaborationsGrid')
  
  if (!container) {
    console.log('[HomePage] Home collaborations grid container not found')
    return
  }

  try {
    // Fetch tracks and artists
    const [tracks, artists] = await Promise.all([
      fetchPublishedTracks(),
      fetchArtists()
    ])

    const artistsById = new Map((artists || []).map((a) => [String(a.id), a]))

    if (!Array.isArray(tracks) || tracks.length === 0) {
      container.innerHTML = '<p class="text-center">No collaborations available yet. Check back soon!</p>'
      return
    }

    // Filter for collaboration tracks and limit to 6 for homepage
    const collabTracks = tracks
      .filter(track => {
        const collabIds = safeArray(track.collaborators)
        return collabIds.length > 0 || safeArray(track.collaboratorNames).length > 0
      })
      .slice(0, 6)

    if (collabTracks.length === 0) {
      container.innerHTML = '<p class="text-center">No collaborations available yet. Check back soon!</p>'
      return
    }

    // Sort by streams (most popular first)
    const sortedTracks = collabTracks
      .slice()
      .sort((a, b) => (Number(b.streams || 0) - Number(a.streams || 0)))

    container.innerHTML = sortedTracks.map((track, index) => 
      renderHomeCollaborationCard(track, index, artistsById)
    ).join('')

    // Setup event listeners for collaboration cards
    setupCollaborationCardListeners()
    console.log('[HomePage] Rendered', sortedTracks.length, 'collaborations')
  } catch (error) {
    console.error('[HomePage] Error loading collaborations:', error)
    container.innerHTML = '<p class="text-center">Error loading collaborations. Please check console for details.</p>'
  }
}

function setupCollaborationCardListeners() {
  // Play button listeners
  document.querySelectorAll('.home-collab-play-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const trackId = btn.dataset.collabPlayTrackId
      const track = (window.__tracks || []).find((t) => t.id === trackId)
      if (track) handlePlayTrack(track)
    })
  })

  // Card click listeners - navigate to detail page
  document.querySelectorAll('.home-collab-card').forEach(card => {
    if (card._clickHandler) {
      card.removeEventListener('click', card._clickHandler)
    }
    
    card._clickHandler = (e) => {
      // Don't navigate if clicking on play button, like button, or spotify indicator
      if (e.target.closest('.home-collab-play-btn') || 
          e.target.closest('.home-collab-like-btn') || 
          e.target.closest('.home-collab-spotify')) {
        return
      }

      const trackId = card.dataset.trackId || card.dataset.collabTrackId
      if (trackId) {
        const href = `track-detail.html?id=${trackId}`
        if (typeof window.spaNavigate === 'function') {
          window.spaNavigate(href)
        } else {
          window.location.href = href
        }
      }
    }
    card.addEventListener('click', card._clickHandler)
  })

  // Like button listeners
  document.querySelectorAll('.home-collab-like-btn[data-like-track-id]').forEach(btn => {
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
  document.querySelectorAll('.home-collab-spotify').forEach(indicator => {
    if (indicator._spotifyHandler) {
      indicator.removeEventListener('click', indicator._spotifyHandler)
    }
    indicator._spotifyHandler = (e) => {
      e.stopPropagation()
      const card = indicator.closest('.home-collab-card')
      const trackId = card.dataset.trackId
      const track = (window.__tracks || []).find((t) => t.id === trackId)
      const spotifyUrl = track?.spotifyUrl || (track?.platformLinks?.spotify) || ''
      if (spotifyUrl) {
        window.open(spotifyUrl, '_blank')
      }
    }
    indicator.addEventListener('click', indicator._spotifyHandler)
  })
}

function renderSocialMediaItem(platform, url) {
  const platformConfig = getPlatformConfig(platform)
  const username = extractUsernameFromUrl(url, platform)
  
  return `
    <a href="${escapeHtml(url)}" target="_blank" class="social-item" data-platform="${escapeHtml(platform)}" rel="noopener noreferrer">
      <div class="social-item-icon ${platform.toLowerCase()}">
        <i class="fab fa-${platformConfig.icon}"></i>
      </div>
      <div class="social-item-content">
        <div class="social-item-header">
          <div>
            <div class="social-item-name">Chase X Records</div>
            <div class="social-item-platform">@${escapeHtml(username)}</div>
          </div>
          <button class="social-item-action" onclick="event.stopPropagation(); window.open('${escapeHtml(url)}', '_blank')">
            ${platformConfig.actionText}
          </button>
        </div>
      </div>
    </a>
  `
}

function getPlatformConfig(platform) {
  const configs = {
    instagram: {
      icon: 'instagram',
      followerLabel: 'Followers',
      contentLabel: 'Posts',
      actionText: 'Follow',
      defaultDescription: 'Follow us on Instagram for behind-the-scenes content, studio updates, and artist spotlights.'
    },
    youtube: {
      icon: 'youtube',
      followerLabel: 'Subscribers',
      contentLabel: 'Videos',
      actionText: 'Subscribe',
      defaultDescription: 'Subscribe to our YouTube channel for music videos, tutorials, and exclusive performances.'
    },
    tiktok: {
      icon: 'tiktok',
      followerLabel: 'Followers',
      contentLabel: 'Videos',
      actionText: 'Follow',
      defaultDescription: 'Join us on TikTok for short-form content, trending challenges, and studio vibes.'
    },
    spotify: {
      icon: 'spotify',
      followerLabel: 'Followers',
      contentLabel: 'Playlists',
      actionText: 'Follow',
      defaultDescription: 'Listen to our latest releases and curated playlists on Spotify.'
    },
    twitter: {
      icon: 'twitter',
      followerLabel: 'Followers',
      contentLabel: 'Tweets',
      actionText: 'Follow',
      defaultDescription: 'Follow us on Twitter for real-time updates and music industry insights.'
    },
    facebook: {
      icon: 'facebook',
      followerLabel: 'Followers',
      contentLabel: 'Posts',
      actionText: 'Like',
      defaultDescription: 'Like our Facebook page for community updates and exclusive content.'
    },
    soundcloud: {
      icon: 'soundcloud',
      followerLabel: 'Followers',
      contentLabel: 'Tracks',
      actionText: 'Follow',
      defaultDescription: 'Follow us on SoundCloud for exclusive tracks and remixes.'
    }
  }
  
  return configs[platform] || configs.instagram
}

function extractUsernameFromUrl(url, platform) {
  try {
    const urlObj = new URL(url)
    
    switch (platform) {
      case 'instagram':
        return urlObj.pathname.replace('/', '').replace('/', '') || 'chasexrecords'
      case 'youtube':
        if (urlObj.pathname.includes('/@')) {
          return urlObj.pathname.split('/@')[1].split('/')[0] || '@chasexrecords'
        }
        return urlObj.pathname.split('/').filter(p => p)[0] || '@chasexrecords'
      case 'tiktok':
        return urlObj.pathname.replace('/', '').replace('/', '').replace('@', '') || 'chasexrecords'
      case 'spotify':
        return urlObj.pathname.split('/').pop() || 'chasexrecords'
      case 'twitter':
        return urlObj.pathname.replace('/', '').replace('/', '') || 'chasexrecords'
      case 'facebook':
        return urlObj.pathname.split('/').filter(p => p)[0] || 'chasexrecords'
      case 'soundcloud':
        return urlObj.pathname.replace('/', '').replace('/', '') || 'chasexrecords'
      default:
        return 'chasexrecords'
    }
  } catch (error) {
    console.warn(`Could not extract username from ${platform} URL:`, url)
    return 'chasexrecords'
  }
}

function loadSocialMediaShowcase() {
  console.log('[HomePage] Loading social media showcase from config...')
  const trackEl = document.getElementById('socialMarqueeTrack')
  
  if (!trackEl) {
    console.log('[HomePage] Social marquee track not found')
    return
  }

  try {
    // Get social links from the existing config system
    const socialLinks = getSocialLinks()
    console.log('[HomePage] Social links from config:', socialLinks)

    // Filter platforms with valid URLs
    const validPlatforms = Object.entries(socialLinks)
      .filter(([platform, url]) => {
        // Check if URL exists, is not empty, and is a valid URL
        if (!url || typeof url !== 'string') return false
        const trimmedUrl = url.trim()
        if (trimmedUrl === '') return false
        // Basic URL validation
        try {
          new URL(trimmedUrl)
          return true
        } catch {
          return false
        }
      })

    if (validPlatforms.length === 0) {
      trackEl.innerHTML = `
        <div class="social-loading-placeholder">
          <p>No social media links configured. Please update your studio settings.</p>
        </div>
      `
      return
    }

    // Create social items
    const socialItems = validPlatforms.map(([platform, url]) => 
      renderSocialMediaItem(platform, url)
    )

    // Create marquee content (duplicate multiple times for truly endless scrolling)
    const marqueeContent = Array(4).fill(socialItems.join('')).join('')
    trackEl.innerHTML = marqueeContent

    // Set marquee animation duration based on number of items
    const duration = Math.max(20, Math.min(60, validPlatforms.length * 8))
    trackEl.style.setProperty('--marquee-duration', `${duration}s`)
    
    console.log('[HomePage] Rendered', validPlatforms.length, 'social media items')
  } catch (error) {
    console.error('[HomePage] Error loading social media showcase:', error)
    trackEl.innerHTML = `
      <div class="social-loading-placeholder">
        <p>Error loading social media. Please refresh the page.</p>
      </div>
    `
  }
}

function updateSocialStats(totalFollowers, activePlatforms) {
  const totalFollowersEl = document.getElementById('totalFollowers')
  
  if (totalFollowersEl) {
    totalFollowersEl.textContent = formatNumber(totalFollowers)
  }
}

// Make function globally available for config-loader integration
window.loadSocialMediaShowcase = loadSocialMediaShowcase


function shareSocialProfile(platform, url) {
  const shareData = {
    title: `Follow Chase X Records on ${platform}`,
    text: `Check out Chase X Records on ${platform} for amazing music content!`,
    url: url
  }

  if (navigator.share) {
    navigator.share(shareData).catch(console.error)
  } else {
    // Fallback: copy to clipboard
    const shareText = `${shareData.text} - ${shareData.url}`
    navigator.clipboard.writeText(shareText).then(() => {
      showNotification('Profile link copied to clipboard!', 'success')
    }).catch(() => {
      prompt('Copy this link:', shareText)
    })
  }
}

function initHomePage() {
  console.log('[HomePage] Initializing homepage...')
  loadTalentMarquee()
  loadFeaturedArtists()
  loadFeaturedTracks()
  loadHomeCollaborations()
  loadSocialMediaShowcase()
  setupTrackCardListeners()
  
  // Set up real-time listener for social media updates
  setupSocialMediaRealtimeListener()
  
  // Execute any pending action after login
  setTimeout(() => executePendingAction(), 500)
}

function setupSocialMediaRealtimeListener() {
  console.log('[HomePage] Setting up real-time social media listener...')
  
  // Listen for settings updates (which includes social links)
  onSettingsUpdate((newConfig) => {
    console.log('[HomePage] Settings updated, refreshing social media showcase...')
    loadSocialMediaShowcase()
  })
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
  
  // Listen for liked tracks updates to refresh UI
  if (!window.__homeLikedTracksListenerBound) {
    window.__homeLikedTracksListenerBound = true
    document.addEventListener('likedTracksUpdated', (e) => {
      const { trackId, isLiked } = e.detail
      if (trackId && isLiked !== undefined) {
        likedTracksManager.updateTrackHeartIcons(trackId, isLiked)
      } else {
        likedTracksManager.updateAllHeartIcons()
      }
    })
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('[data-include]')) return
  boot()
})

document.addEventListener('includes:loaded', () => {
  boot()
})

document.addEventListener('spa:navigated', () => {
  const root = document.getElementById('homeHero') || document.querySelector('main')
  if (!root) return
  // Only boot when actually on home page.
  const page = (window.location.pathname.split('/').pop() || 'index.html')
  if (page !== 'index.html') return
  boot()
})
