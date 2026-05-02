import { fetchArtistById, fetchPublishedTracks } from './data/content-repo.js'
import { likedTracksManager } from './liked-tracks-manager.js'

function escapeHtml(str) {
  if (!str) return ''
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;'
    if (m === '<') return '&lt;'
    if (m === '>') return '&gt;'
    return m
  })
}

function formatNumber(num) {
  const n = Number(num || 0)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString()
}

function getArtistIdFromQuery() {
  const params = new URLSearchParams(window.location.search)
  return params.get('id') || ''
}

function renderSocialLinks(socials) {
  const s = socials || {}
  const links = []

  if (s.instagram) links.push({ href: s.instagram, icon: 'fab fa-instagram', label: 'Instagram' })
  if (s.spotify) links.push({ href: s.spotify, icon: 'fab fa-spotify', label: 'Spotify' })
  if (s.youtube) links.push({ href: s.youtube, icon: 'fab fa-youtube', label: 'YouTube' })
  if (s.soundcloud) links.push({ href: s.soundcloud, icon: 'fab fa-soundcloud', label: 'SoundCloud' })
  if (s.tiktok) links.push({ href: s.tiktok, icon: 'fab fa-tiktok', label: 'TikTok' })
  if (s.appleMusic) links.push({ href: s.appleMusic, icon: 'fab fa-apple', label: 'Apple Music' })

  return links
    .map((l) => `
      <a href="${escapeHtml(l.href)}" target="_blank" rel="noopener" aria-label="${escapeHtml(l.label)}">
        <i class="${l.icon}"></i>
      </a>
    `)
    .join('')
}

function renderTrackCard(track, index, artistName) {
  const spotifyUrl = track.spotifyUrl || (track.platformLinks?.spotify) || ''
  const isLiked = likedTracksManager.isTrackLiked(track.id)

  return `
    <div class="track-card" data-track="${index}" data-spotify-url="${escapeHtml(spotifyUrl)}" data-track-id="${escapeHtml(track.id || '')}">
      <div class="track-artwork">
        <img src="${escapeHtml(track.artwork || '')}" alt="${escapeHtml(track.title || '')}">
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
          <button class="like-btn-mini ${isLiked ? 'liked' : ''}" title="Like" data-like-track-id="${escapeHtml(track.id || '')}" type="button">
            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
          </button>
        </div>
      </div>
    </div>
  `
}

function setupTrackInteractions(tracks) {
  const getTrackFromCard = (card) => {
    const idx = Number.parseInt(card?.dataset?.track || '0', 10)
    if (!Number.isFinite(idx)) return null
    return tracks[idx] || null
  }

  document.querySelectorAll('.track-play-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const card = btn.closest('.track-card')
      const track = getTrackFromCard(card)
      if (!track) return
      playTrackList(tracks, track.id)
    })
  })

  document.querySelectorAll('.track-card').forEach((card) => {
    if (card._clickHandler) card.removeEventListener('click', card._clickHandler)

    card._clickHandler = (e) => {
      if (e.target.closest('.track-play-btn') || e.target.closest('.like-btn-mini') || e.target.closest('.spotify-indicator')) {
        return
      }
      const trackId = card.dataset.trackId
      if (trackId) {
        const href = `track-detail.html?id=${encodeURIComponent(trackId)}`
        if (typeof window.spaNavigate === 'function') {
          window.spaNavigate(href)
        } else {
          window.location.href = href
        }
      }
    }

    card.addEventListener('click', card._clickHandler)
  })

  document.querySelectorAll('.like-btn-mini[data-like-track-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const trackId = btn.dataset.likeTrackId
      if (!trackId) return
      if (!window.userAuth || !window.userAuth.isLoggedIn()) {
        const currentUrl = window.location.href
        const href = `auth.html?redirect=${encodeURIComponent(currentUrl)}`
        if (typeof window.spaNavigate === 'function') {
          window.spaNavigate(href)
        } else {
          window.location.href = href
        }
        return
      }
      const track = tracks.find((t) => t.id === trackId) || { id: trackId }
      likedTracksManager.toggleLike(track, btn).then((result) => {
        if (result?.error) {
          if (window.notifications) window.notifications.show('Error saving favorite.', 'error')
        }
      })
    })
  })

  document.querySelectorAll('.spotify-indicator').forEach((indicator) => {
    indicator.addEventListener('click', (e) => {
      e.stopPropagation()
      const card = indicator.closest('.track-card')
      const spotifyUrl = card?.dataset?.spotifyUrl
      if (spotifyUrl) window.open(spotifyUrl, '_blank')
    })
  })
}

function playTrackList(tracks, trackId) {
  if (!window.persistentPlayer) {
    console.error('[ArtistDetail] Persistent player not available')
    return
  }

  const playlist = tracks.map((t) => ({
    id: t.id,
    title: t.title,
    artistName: t.artistName,
    artwork: t.artwork,
    platformLinks: t.platformLinks || {},
    originalData: t,
  }))

  const startIndex = Math.max(0, playlist.findIndex((t) => t.id === trackId))
  window.persistentPlayer.setPlaylist(playlist, startIndex)
  window.persistentPlayer.play()
}

function pickRecommendedTracks({ allTracks, artistId, artistGenre, artistTracks, limit = 12 }) {
  const seen = new Set((artistTracks || []).map((t) => String(t.id || '')))
  const artistTrackGenres = new Set((artistTracks || []).map((t) => String(t.genre || '').toLowerCase()).filter(Boolean))
  const aGenre = String(artistGenre || '').toLowerCase().trim()

  const candidates = (allTracks || []).filter((t) => {
    if (!t) return false
    const id = String(t.id || '')
    if (!id || seen.has(id)) return false
    // Avoid showing the same artist again.
    if (String(t.artist || '') === String(artistId || '')) return false
    return true
  })

  const score = (t) => {
    let s = 0
    const g = String(t.genre || '').toLowerCase()
    if (aGenre && g && g === aGenre) s += 6
    if (g && artistTrackGenres.has(g)) s += 4
    const streams = Number(t.streams || 0)
    if (Number.isFinite(streams)) s += Math.min(3, Math.log10(streams + 1))
    const rd = new Date(t.releaseDate || 0).getTime()
    if (Number.isFinite(rd) && rd > 0) s += Math.min(2, (Date.now() - rd) < 1000 * 60 * 60 * 24 * 45 ? 2 : 0)
    return s
  }

  candidates.sort((a, b) => score(b) - score(a))
  return candidates.slice(0, Math.max(0, limit))
}

async function load() {
  const artistId = getArtistIdFromQuery()

  const nameEl = document.getElementById('artistName')
  const genreEl = document.getElementById('artistGenre')
  const bioEl = document.getElementById('artistBio')
  const imageEl = document.getElementById('artistImage')
  const socialsEl = document.getElementById('artistSocials')
  const trackCountEl = document.getElementById('artistTrackCount')
  const streamCountEl = document.getElementById('artistStreamCount')
  const tracksGrid = document.getElementById('artistTracksGrid')
  const recommendedGrid = document.getElementById('artistRecommendedGrid')

  if (!artistId) {
    if (nameEl) nameEl.textContent = 'Artist not found'
    if (tracksGrid) tracksGrid.innerHTML = '<p class="text-center">Missing artist id.</p>'
    return
  }

  try {
    const [artist, tracks] = await Promise.all([
      fetchArtistById(artistId),
      fetchPublishedTracks(),
    ])

    if (!artist) {
      if (nameEl) nameEl.textContent = 'Artist not found'
      if (tracksGrid) tracksGrid.innerHTML = '<p class="text-center">This artist does not exist.</p>'
      return
    }

    const artistName = artist.name || 'Unknown Artist'

    if (nameEl) nameEl.textContent = artistName
    if (genreEl) genreEl.textContent = artist.genre || ''
    if (bioEl) bioEl.textContent = artist.bio || artist.description || ''
    if (imageEl) {
      imageEl.src = artist.image || artist.artwork || 'images/headphones.png'
      imageEl.alt = artistName
    }
    if (socialsEl) socialsEl.innerHTML = renderSocialLinks(artist.socials)

    const artistTracks = (tracks || []).filter((t) => String(t.artist || '') === String(artistId))

    const normalizedArtistTracks = artistTracks.map((t) => ({
      ...t,
      artistName,
    }))

    const recommended = pickRecommendedTracks({
      allTracks: tracks || [],
      artistId,
      artistGenre: artist.genre,
      artistTracks: normalizedArtistTracks,
      limit: 12,
    }).map((t) => ({
      ...t,
      artistName: t.artistName || t.artistDisplayName || 'Unknown Artist',
    }))

    // Combined playlist so the player keeps going beyond the artist.
    const normalizedTracks = [...normalizedArtistTracks, ...recommended]
    window.__tracks = normalizedTracks

    if (trackCountEl) trackCountEl.textContent = formatNumber(normalizedArtistTracks.length)
    if (streamCountEl) {
      const totalStreams = normalizedArtistTracks.reduce((sum, t) => sum + Number(t.streams || 0), 0)
      streamCountEl.textContent = formatNumber(totalStreams)
    }

    if (!tracksGrid) return

    if (normalizedArtistTracks.length === 0) {
      tracksGrid.innerHTML = '<p class="text-center">No tracks published for this artist yet.</p>'
    } else {
      tracksGrid.innerHTML = normalizedArtistTracks
        .map((t, idx) => renderTrackCard(t, idx, artistName))
        .join('')
    }

    if (recommendedGrid) {
      if (recommended.length === 0) {
        recommendedGrid.innerHTML = '<p class="text-center">No recommendations yet.</p>'
      } else {
        const offset = normalizedArtistTracks.length
        recommendedGrid.innerHTML = recommended
          .map((t, idx) => renderTrackCard(t, offset + idx, t.artistName))
          .join('')
      }
    }

    setupTrackInteractions(normalizedTracks)
  } catch (e) {
    console.error('[ArtistDetail] Failed to load artist details:', e)
    if (tracksGrid) tracksGrid.innerHTML = '<p class="text-center">Error loading artist details.</p>'
    if (recommendedGrid) recommendedGrid.innerHTML = ''
  }
}

function boot() {
  load().catch(console.error)
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('[data-include]')) return
  boot()
})

document.addEventListener('includes:loaded', () => {
  boot()
})

document.addEventListener('spa:navigated', () => {
  const root = document.getElementById('artistHero')
  if (!root) return
  const artistId = getArtistIdFromQuery()
  if (!artistId) return
  if (root.dataset.loadedArtistId === artistId) return
  root.dataset.loadedArtistId = artistId
  boot()
})
