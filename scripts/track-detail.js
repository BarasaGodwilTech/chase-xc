import { fetchPublishedTracks, fetchArtistById, fetchTrackById } from './data/content-repo.js'
import { likedTracksManager } from './liked-tracks-manager.js'

// Track detail page functionality
let currentTrack = null
let artistData = null
let pagePlaylist = []

// Helper functions for collaboration tracks
function safeArray(val) {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)
  return []
}

// Load related tracks (More Like This)
async function loadRelatedTracks(collaborationNames = []) {
  const container = document.getElementById('relatedTracksGrid')
  const section = document.getElementById('relatedTracksSection')
  if (!container || !section || !currentTrack) return

  try {
    const allTracks = await fetchPublishedTracks()

    const artistIds = new Set()
    if (currentTrack.artist) artistIds.add(currentTrack.artist)
    if (currentTrack.collaborators && Array.isArray(currentTrack.collaborators)) {
      currentTrack.collaborators.forEach((id) => artistIds.add(id))
    }

    const related = pickRelatedTracks({
      allTracks,
      seedTrack: currentTrack,
      artistIds: Array.from(artistIds),
      limit: 8,
    })

    if (!related || related.length === 0) {
      section.style.display = 'none'
      return
    }

    // Extend the page playlist with related tracks (dedup)
    ensurePagePlaylist([...(pagePlaylist.length ? pagePlaylist : [currentTrack]), ...related])

    container.innerHTML = related
      .map((track) => {
        const idx = pagePlaylist.findIndex((t) => t.id === track.id)
        return renderTrackCardHtml(track, idx, track.artistName || 'Unknown Artist')
      })
      .join('')

    setupRelatedTracksListeners()
  } catch (error) {
    console.error('[TrackDetail] Error loading related tracks:', error)
    section.style.display = 'none'
  }
}

function setupRelatedTracksListeners() {
  const rootSel = '#relatedTracksGrid'

  document.querySelectorAll(`${rootSel} .track-play-btn`).forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const card = btn.closest('.track-card')
      const trackIndex = parseInt(card.dataset.track)
      const track = pagePlaylist[trackIndex]
      if (!track || !window.persistentPlayer) return

      const fullPlaylist = buildPlayerPlaylistFromPageTracks()
      const startIndex = Math.max(0, fullPlaylist.findIndex((t) => t.id === track.id))
      window.persistentPlayer.setPlaylist(fullPlaylist, startIndex)
      window.persistentPlayer.play()
    })
  })

  document.querySelectorAll(`${rootSel} .track-card`).forEach((card) => {
    card.addEventListener('click', (e) => {
      if (
        e.target.closest('.track-play-btn') ||
        e.target.closest('.like-btn-mini') ||
        e.target.closest('.spotify-indicator')
      ) {
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
    })
  })

  document.querySelectorAll(`${rootSel} .like-btn-mini`).forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const trackId = btn.dataset.likeTrackId
      const track = pagePlaylist.find((t) => t.id === trackId) || currentTrack
      if (!track) return

      if (!isUserAuthenticated()) {
        storePendingAction('like', { trackId })
        redirectToAuth()
        return
      }

      likedTracksManager.toggleLike(track, btn).then((result) => {
        if (result?.error) {
          if (window.notifications) window.notifications.show('Error saving favorite.', 'error')
        }
      })
    })
  })

  document.querySelectorAll(`${rootSel} .spotify-indicator`).forEach((indicator) => {
    indicator.addEventListener('click', (e) => {
      e.stopPropagation()
      const card = indicator.closest('.track-card')
      const trackIndex = parseInt(card.dataset.track)
      const track = pagePlaylist[trackIndex]
      if (!track) return
      const spotifyUrl = track.spotifyUrl || track.platformLinks?.spotify
      if (spotifyUrl) window.open(spotifyUrl, '_blank')
    })
  })
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

async function resolveCollabAvatarUrls(track, collaborationNames = []) {
  const ids = uniqueStrings(safeArray(track?.collaborators).map((x) => String(x)))
  const urls = []

  if (ids.length > 0) {
    const artists = await Promise.all(
      ids.map(async (id) => {
        try {
          return await fetchArtistById(id)
        } catch (_) {
          return null
        }
      })
    )
    for (const a of artists) {
      const img = a?.image
      if (img) urls.push(img)
    }
  }

  // Fallback: try to map collaborator names to artists by fetching all (only if needed)
  if (urls.length === 0 && collaborationNames.length > 0) {
    // Avoid adding additional imports; we only try to resolve if currentTrack has ids.
    // If no ids exist, we can't reliably map names to images without extra queries.
  }

  return uniqueStrings(urls).slice(0, 4)
}

// Resolve artist names for collaboration tracks
async function resolveArtistNames(track) {
  const names = []
  
  // Add collaborator names from stored data first (most reliable)
  if (track.collaboratorNames && Array.isArray(track.collaboratorNames)) {
    const validNames = track.collaboratorNames.filter(name => 
      name && name !== 'Unknown Artist' && name.trim() !== ''
    )
    names.push(...validNames)
  }
  
  // If we have collaborator IDs but no names, fetch them
  if (track.collaborators && Array.isArray(track.collaborators) && names.length === 0) {
    const collaboratorNames = await Promise.all(
      track.collaborators.map(async (id) => {
        try {
          const artist = await fetchArtistById(id)
          return artist?.name
        } catch (e) {
          console.warn('Failed to fetch collaborator:', id, e)
          return null
        }
      })
    )
    const validNames = collaboratorNames.filter(name => 
      name && name !== 'Unknown Artist' && name.trim() !== ''
    )
    names.push(...validNames)
  }
  
  // Add primary artist name only if it's valid and not already included
  if (track.artistName && track.artistName !== 'Unknown Artist' && track.artistName.trim() !== '') {
    if (!names.includes(track.artistName)) {
      names.push(track.artistName)
    }
  }
  
  return uniqueStrings(names)
}

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

function pickRelatedTracks({ allTracks, seedTrack, artistIds = [], limit = 8 }) {
  const seedId = String(seedTrack?.id || '')
  const seedGenre = String(seedTrack?.genre || '').toLowerCase().trim()
  const seedTitle = String(seedTrack?.title || '').toLowerCase()

  const tokenize = (s) =>
    String(s || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((w) => w && w.length >= 3)

  const seedWords = new Set([...tokenize(seedTitle), ...tokenize(seedTrack?.description)])
  const seedArtistSet = new Set((artistIds || []).map((x) => String(x)))

  const candidates = (allTracks || []).filter((t) => {
    if (!t) return false
    const id = String(t.id || '')
    if (!id || id === seedId) return false
    return true
  })

  const score = (t) => {
    let s = 0
    const g = String(t.genre || '').toLowerCase().trim()
    if (seedGenre && g && g === seedGenre) s += 6

    // small boost for same artist/collab artists (but not too much so it doesn't duplicate the section)
    if (seedArtistSet.size > 0 && seedArtistSet.has(String(t.artist || ''))) s += 2

    const words = tokenize(t.title)
    let overlap = 0
    for (const w of words) if (seedWords.has(w)) overlap += 1
    s += Math.min(3, overlap)

    const streams = Number(t.streams || 0)
    if (Number.isFinite(streams)) s += Math.min(3, Math.log10(streams + 1))

    const rd = new Date(t.releaseDate || 0).getTime()
    if (Number.isFinite(rd) && rd > 0) s += Math.min(2, (Date.now() - rd) < 1000 * 60 * 60 * 24 * 45 ? 2 : 0)
    return s
  }

  candidates.sort((a, b) => score(b) - score(a))
  return candidates.slice(0, Math.max(0, limit))
}

function ensurePagePlaylist(tracks) {
  const normalized = (tracks || []).filter(Boolean)
  const seen = new Set()
  pagePlaylist = []
  for (const t of normalized) {
    const id = String(t.id || '')
    if (!id || seen.has(id)) continue
    seen.add(id)
    pagePlaylist.push(t)
  }
  window.__tracks = pagePlaylist
}

function buildPlayerPlaylistFromPageTracks() {
  return (pagePlaylist || []).map((t) => {
    const collabLine = normalizeArtistParts([
      ...(safeArray(t.collaboratorNames)),
      t.artistName,
    ]).join(' & ')

    return {
      id: t.id,
      title: t.title,
      artistName: collabLine || t.artistName,
      artwork: t.artwork,
      platformLinks: t.platformLinks || {},
      originalData: t,
    }
  })
}

function renderTrackCardHtml(track, trackIndex, fallbackArtistName = 'Unknown Artist') {
  const badge = getTrackBadge(track)
  const spotifyUrl = track.spotifyUrl || track.platformLinks?.spotify || ''
  const isLiked = track?.id ? likedTracksManager.isTrackLiked(track.id) : false

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
            <p class="track-artist">${track.artistName || fallbackArtistName}</p>
          </div>
          <button class="like-btn-mini ${isLiked ? 'liked' : ''}" title="Like" data-like-track-id="${track.id}" type="button">
            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
          </button>
        </div>
      </div>
    </div>
  `
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
    
    // Resolve collaboration artist names
    const collaborationNamesRaw = await resolveArtistNames(currentTrack)
    const collaborationNames = normalizeArtistParts(collaborationNamesRaw)
    
    // Render track details
    renderTrackDetails(collaborationNames)
    
    // Setup event listeners
    setupEventListeners()
    
    // Load more from artist
    await loadMoreFromArtist(collaborationNames)

    // Load related tracks to keep user engaged
    await loadRelatedTracks(collaborationNames)
    
  } catch (error) {
    console.error('[TrackDetail] Error loading track:', error)
    showError('Error loading track details')
  }
}

// Render track details
function renderTrackDetails(collaborationNames = []) {
  const artwork = document.getElementById('trackArtwork')
  const title = document.getElementById('trackTitle')
  const artist = document.getElementById('trackArtist')
  const collabAvatars = document.getElementById('trackCollabAvatars')
  const genre = document.getElementById('trackGenre')
  const duration = document.getElementById('trackDuration')
  const release = document.getElementById('trackRelease')
  const streams = document.getElementById('trackStreams')
  const likes = document.getElementById('trackLikes')
  const badge = document.getElementById('trackBadge')
  const spotifyBtn = document.getElementById('spotifyBtn')
  const artistSocials = document.getElementById('artistSocials')
  const likeBtn = document.getElementById('likeBtn')
  
  // Set artwork
  if (artwork) {
    artwork.src = currentTrack.artwork || 'public/player-cover-1.jpg'
    artwork.alt = currentTrack.title || 'Track Artwork'
  }
  
  // Set title and artist
  if (title) title.textContent = currentTrack.title || 'Unknown Track'
  
  // Handle collaboration artist display
  let displayArtist = 'Unknown Artist'
  if (collaborationNames.length > 0) {
    displayArtist = normalizeArtistParts(collaborationNames).join(' & ')
  } else if (artistData?.name) {
    displayArtist = artistData.name
  } else if (currentTrack.artistName) {
    displayArtist = currentTrack.artistName
  }
  
  if (artist) artist.textContent = displayArtist

  // Collaboration avatar stack
  if (collabAvatars) {
    const isCollab = collaborationNames.length > 1 || (currentTrack.collaborators && currentTrack.collaborators.length > 0)
    if (!isCollab) {
      collabAvatars.innerHTML = ''
      collabAvatars.style.display = 'none'
    } else {
      collabAvatars.style.display = ''
      resolveCollabAvatarUrls(currentTrack, collaborationNames)
        .then((urls) => {
          if (!urls || urls.length === 0) {
            collabAvatars.innerHTML = ''
            return
          }
          collabAvatars.innerHTML = `
            <div class="collab-avatars">
              ${urls
                .map(
                  (src) =>
                    `<span class="collab-avatar"><img src="${src}" alt="" loading="lazy" decoding="async"></span>`
                )
                .join('')}
            </div>
          `
        })
        .catch(() => {
          collabAvatars.innerHTML = ''
        })
    }
  }
  
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
  
  // Set badge - add collaboration indicator
  const badgeData = getTrackBadge(currentTrack)
  const isCollaboration = collaborationNames.length > 1 || (currentTrack.collaborators && currentTrack.collaborators.length > 0)
  
  if (badge && badgeData) {
    badge.className = `track-detail-badge ${badgeData.type}`
    badge.textContent = badgeData.text
    badge.style.display = 'inline-block'
  } else if (badge && isCollaboration) {
    badge.className = 'track-detail-badge collaboration'
    badge.textContent = 'Collaboration'
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
        ${socials.x ? `<a href="${socials.x}" target="_blank" title="X"><i class="fab fa-x-twitter"></i></a>` : ''}
      </div>
    `
  }
  
  // Update like button state
  if (likeBtn && currentTrack.id) {
    const isLiked = likedTracksManager.isTrackLiked(currentTrack.id)
    const icon = likeBtn.querySelector('i')
    if (icon) {
      if (isLiked) {
        icon.classList.remove('far')
        icon.classList.add('fas')
        likeBtn.classList.add('liked')
      } else {
        icon.classList.remove('fas')
        icon.classList.add('far')
        likeBtn.classList.remove('liked')
      }
    }
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
    if (playBtn._playHandler) {
      playBtn.removeEventListener('click', playBtn._playHandler)
    }
    playBtn._playHandler = () => handlePlayTrack()
    playBtn.addEventListener('click', playBtn._playHandler)
  }
  
  // Like button
  if (likeBtn) {
    if (likeBtn._likeHandler) {
      likeBtn.removeEventListener('click', likeBtn._likeHandler)
    }
    likeBtn._likeHandler = () => handleLikeTrack(likeBtn)
    likeBtn.addEventListener('click', likeBtn._likeHandler)
  }
  
  // Add to playlist button
  if (playlistBtn) {
    if (playlistBtn._playlistHandler) {
      playlistBtn.removeEventListener('click', playlistBtn._playlistHandler)
    }
    playlistBtn._playlistHandler = () => handleAddToPlaylist()
    playlistBtn.addEventListener('click', playlistBtn._playlistHandler)
  }
  
  // Share button
  if (shareBtn) {
    if (shareBtn._shareHandler) {
      shareBtn.removeEventListener('click', shareBtn._shareHandler)
    }
    shareBtn._shareHandler = () => handleShareTrack()
    shareBtn.addEventListener('click', shareBtn._shareHandler)
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
    // Always prefer this page's playlist (current + more from artist + related)
    if (pagePlaylist.length > 0) {
      const fullPlaylist = buildPlayerPlaylistFromPageTracks()
      const startIndex = Math.max(0, fullPlaylist.findIndex((t) => t.id === currentTrack.id))
      window.persistentPlayer.setPlaylist(fullPlaylist, startIndex)
    } else if (window.persistentPlayer.playlist.length === 0 && window.__tracks?.length > 0) {
      // Fallback: previous behavior
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
    const existingIndex = window.persistentPlayer.playlist.findIndex(t => t.id === currentTrack.id);
    if (existingIndex !== -1) {
      window.persistentPlayer.currentIndex = existingIndex;
      window.persistentPlayer.loadTrack(window.persistentPlayer.playlist[existingIndex]);
    } else {
      // Track not in playlist, add it
      const collabLine = normalizeArtistParts([
        ...(safeArray(currentTrack.collaboratorNames)),
        currentTrack.artistName,
      ]).join(' & ')
      window.persistentPlayer.playlist.push({
        id: currentTrack.id,
        title: currentTrack.title,
        artistName: collabLine || currentTrack.artistName,
        artwork: currentTrack.artwork,
        platformLinks: currentTrack.platformLinks || {},
        originalData: currentTrack
      });
      window.persistentPlayer.currentIndex = window.persistentPlayer.playlist.length - 1;
      window.persistentPlayer.loadTrack(currentTrack);
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
  
  // Use centralized liked tracks manager
  likedTracksManager.toggleLike(currentTrack, btn).then(result => {
    if (result.error) {
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

  // Use playlist modal instead of browser prompt
  if (window.playlistModal) {
    window.playlistModal.open(currentTrack, (playlistId, playlistName) => {
      console.log('[TrackDetail] Added to playlist:', playlistName)
    })
  } else {
    // Fallback to old flow if modal not available
    const uid = window.userAuth?.getCurrentUser?.()?.uid
    if (!uid) return
    addToPlaylistFlow(uid, currentTrack).catch((e) => {
      console.error('[TrackDetail] Failed to add to playlist:', e)
      if (window.notifications) window.notifications.show('Error adding to playlist.', 'error')
    })
  }
}

async function addToPlaylistFlow(uid, track) {
  const { getPlaylists, createPlaylist, addTrackToPlaylist } = await import('./user-data.js')

  const playlists = await getPlaylists(uid, 50)
  let playlistId = null

  if (!playlists || playlists.length === 0) {
    const name = await promptForText('No playlists found. Enter a name to create one:')
    if (!name) return
    playlistId = await createPlaylist(uid, name)
    if (!playlistId) return
  } else {
    const listText = playlists
      .map((p, idx) => `${idx + 1}) ${p.name} (${p.trackCount || (p.tracks?.length || 0)} tracks)`)
      .join('\n')

    const choice = await promptForText(`Add to which playlist?\n\n${listText}\n\nType a number, or type NEW to create a playlist:`)
    if (!choice) return

    if (choice.trim().toLowerCase() === 'new') {
      const name = await promptForText('Enter new playlist name:')
      if (!name) return
      playlistId = await createPlaylist(uid, name)
      if (!playlistId) return
    } else {
      const n = Number.parseInt(choice, 10)
      if (!Number.isFinite(n) || n < 1 || n > playlists.length) {
        if (window.notifications) window.notifications.show('Invalid playlist selection.', 'error')
        return
      }
      playlistId = playlists[n - 1].id
    }
  }

  await addTrackToPlaylist(uid, playlistId, track)
  if (window.notifications) window.notifications.show('Added to playlist!', 'success')
}

async function promptForText(message) {
  if (window.notifications?.prompt) {
    return await window.notifications.prompt(message)
  }
  return prompt(message)
}

function executePendingAction() {
  const pendingActionStr = sessionStorage.getItem('pendingAction')
  if (!pendingActionStr) return

  try {
    const pendingAction = JSON.parse(pendingActionStr)

    if (pendingAction.type === 'addToPlaylist') {
      // Use stored trackData if present, otherwise use currentTrack
      const t = pendingAction.data?.trackData || currentTrack
      if (t) {
        const uid = window.userAuth?.getCurrentUser?.()?.uid
        if (uid) {
          addToPlaylistFlow(uid, t)
        }
      }
    }

    sessionStorage.removeItem('pendingAction')
  } catch (e) {
    console.error('[TrackDetail] Error executing pending action:', e)
    sessionStorage.removeItem('pendingAction')
  }
}

// Handle share track
function handleShareTrack() {
  if (!currentTrack) return
  
  console.log('[TrackDetail] Sharing track:', currentTrack.title)
  
  // Get current artist display from the page
  const artistElement = document.getElementById('trackArtist')
  const artistDisplay = artistElement ? artistElement.textContent : (currentTrack.artistName || 'Unknown Artist')
  
  const shareData = {
    title: currentTrack.title,
    text: `Listen to ${currentTrack.title} by ${artistDisplay}`,
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
async function loadMoreFromArtist(collaborationNames = []) {
  const container = document.getElementById('moreTracksGrid')
  const section = document.getElementById('moreFromArtist')
  
  // For collaboration tracks, we need to check if there are any artists to show more from
  const hasPrimaryArtist = currentTrack?.artist
  const hasCollaborators = currentTrack?.collaborators && currentTrack.collaborators.length > 0
  
  if (!container || (!hasPrimaryArtist && !hasCollaborators)) {
    if (section) section.style.display = 'none'
    return
  }
  
  try {
    const allTracks = await fetchPublishedTracks()
    
    // For collaboration tracks, find tracks by any of the collaborating artists
    let artistTracks = []
    const artistIds = new Set()
    
    if (currentTrack.artist) {
      artistIds.add(currentTrack.artist)
    }
    
    if (currentTrack.collaborators && Array.isArray(currentTrack.collaborators)) {
      currentTrack.collaborators.forEach(id => artistIds.add(id))
    }
    
    // Find tracks by any of these artists, excluding the current track
    artistTracks = allTracks.filter(t => 
      artistIds.has(t.artist) && t.id !== currentTrack.id
    ).slice(0, 4)
    
    if (artistTracks.length === 0) {
      if (section) section.style.display = 'none'
      return
    }
    
    const pageTracks = [currentTrack, ...artistTracks]
    ensurePagePlaylist(pageTracks)

    container.innerHTML = artistTracks
      .map((track) => {
        const idx = pagePlaylist.findIndex((t) => t.id === track.id)
        return renderTrackCardHtml(track, idx, track.artistName || artistData?.name || 'Unknown Artist')
      })
      .join('')
    
    // Update section title for collaboration tracks
    const sectionTitle = section.querySelector('.section-title')
    if (sectionTitle) {
      const isCollab = collaborationNames.length > 1 || (currentTrack.collaborators && currentTrack.collaborators.length > 0)
      if (isCollab) {
        sectionTitle.textContent = 'More from these Artists'
      }
    }
    
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
      const track = pagePlaylist[trackIndex]
      
      if (track && window.persistentPlayer) {
        const fullPlaylist = buildPlayerPlaylistFromPageTracks()
        const startIndex = Math.max(0, fullPlaylist.findIndex((t) => t.id === track.id))
        window.persistentPlayer.setPlaylist(fullPlaylist, startIndex)
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
        const href = `track-detail.html?id=${trackId}`
        if (typeof window.spaNavigate === 'function') {
          window.spaNavigate(href)
        } else {
          window.location.href = href
        }
      }
    })
  })
  
  // Like button listeners
  document.querySelectorAll('#moreTracksGrid .like-btn-mini').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const trackId = btn.dataset.likeTrackId
      const track = pagePlaylist.find((t) => t.id === trackId) || currentTrack
      if (!track) return

      if (!isUserAuthenticated()) {
        storePendingAction('like', { trackId })
        redirectToAuth()
        return
      }

      likedTracksManager.toggleLike(track, btn).then((result) => {
        if (result?.error) {
          if (window.notifications) window.notifications.show('Error saving favorite.', 'error')
        }
      })
    })
  })
  
  // Spotify indicator click
  document.querySelectorAll('#moreTracksGrid .spotify-indicator').forEach(indicator => {
    indicator.addEventListener('click', (e) => {
      e.stopPropagation()
      const card = indicator.closest('.track-card')
      const trackIndex = parseInt(card.dataset.track)
      const track = pagePlaylist[trackIndex]
      
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
  if (typeof window.spaNavigate === 'function') {
    window.spaNavigate(authUrl)
  } else {
    window.location.href = authUrl
  }
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
  
  // Listen for liked tracks updates to refresh UI
  const root = document.getElementById('trackHero')
  if (root && root.dataset.likedListenerBound !== '1') {
    root.dataset.likedListenerBound = '1'
    document.addEventListener('likedTracksUpdated', (e) => {
    const { trackId, isLiked } = e.detail
    if (currentTrack && (trackId === currentTrack.id || trackId === null)) {
      const likeBtn = document.getElementById('likeBtn')
      if (likeBtn) {
        const shouldUpdate = trackId === null || trackId === currentTrack.id
        if (shouldUpdate) {
          const newIsLiked = trackId === null ? likedTracksManager.isTrackLiked(currentTrack.id) : isLiked
          const icon = likeBtn.querySelector('i')
          if (icon) {
            if (newIsLiked) {
              icon.classList.remove('far')
              icon.classList.add('fas')
              likeBtn.classList.add('liked')
            } else {
              icon.classList.remove('fas')
              icon.classList.add('far')
              likeBtn.classList.remove('liked')
            }
          }
        }
      }
    }
    
    // Update heart icons in "More from Artist" section
    if (trackId && isLiked !== undefined) {
      likedTracksManager.updateTrackHeartIcons(trackId, isLiked)
    } else {
      likedTracksManager.updateAllHeartIcons()
    }
    })
  }
})

document.addEventListener('includes:loaded', loadTrackData)

document.addEventListener('spa:navigated', () => {
  const root = document.getElementById('trackHero')
  if (!root) return
  const trackId = getTrackIdFromUrl()
  if (!trackId) return
  if (root.dataset.loadedTrackId === trackId) return
  root.dataset.loadedTrackId = trackId
  loadTrackData()
})

document.addEventListener('DOMContentLoaded', () => {
  // If auth.js is on the page, it will hydrate window.userAuth
  // Execute pending actions after a small delay
  setTimeout(executePendingAction, 700)
})
