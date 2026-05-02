import { fetchPublishedTracks, fetchPublishedTracksPage, fetchArtistById, fetchArtists } from './data/content-repo.js'
import { likedTracksManager } from './liked-tracks-manager.js'

let artistsByIdCache = new Map()
let artistsByNameCache = new Map()

const paginationState = {
  pageSize: 24,
  cursor: null,
  hasMore: true,
  isLoading: false,
  mode: 'page',
}

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

function renderTrackCard(track, index, artistName, artistSocials = {}, avatarHtml = '') {
  const categories = getTrackCategories(track)
  const badge = getTrackBadge(track)
  const spotifyUrl = track.spotifyUrl || (track.platformLinks?.spotify) || ''
  const isLiked = likedTracksManager.isTrackLiked(track.id)

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
            ${avatarHtml || ''}
          </div>
          <button class="like-btn-mini ${isLiked ? 'liked' : ''}" title="Like" data-like-track-id="${track.id}" type="button">
            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
          </button>
        </div>
      </div>
    </div>
  `
}

function renderShelfCard(track) {
  const artistLine = getDisplayArtistLine(track)
  return `
    <div class="shelf-card" data-shelf-track-id="${escapeHtml(track.id || '')}">
      <div class="shelf-card-art">
        <img src="${escapeHtml(track.artwork || '')}" alt="${escapeHtml(track.title || '')}" loading="lazy" decoding="async">
        <button class="shelf-card-play" type="button" aria-label="Play ${escapeHtml(track.title || '')}" data-shelf-play-track-id="${escapeHtml(track.id || '')}">
          <i class="fas fa-play"></i>
        </button>
      </div>
      <div class="shelf-card-body">
        <p class="shelf-card-title">${escapeHtml(track.title || '')}</p>
        <p class="shelf-card-subtitle">${escapeHtml(artistLine)}</p>
      </div>
    </div>
  `
}

function renderMadeForYou(tracks) {
  const row = document.getElementById('madeForYouRow')
  if (!row) return

  const likedIds = new Set(likedTracksManager?.likedTrackIds ? Array.from(likedTracksManager.likedTrackIds) : [])
  const likedTracks = (tracks || []).filter((t) => t?.id && likedIds.has(t.id))

  let picks = []
  if (likedTracks.length > 0) {
    picks = likedTracks.slice().sort((a, b) => (Number(b.streams || 0) - Number(a.streams || 0))).slice(0, 6)
  } else {
    picks = (tracks || [])
      .slice()
      .sort((a, b) => (Number(b.streams || 0) - Number(a.streams || 0)))
      .slice(0, 6)
  }

  if (picks.length === 0) {
    row.innerHTML = '<p class="shelf-empty">No picks yet</p>'
    return
  }

  row.innerHTML = picks.map(renderShelfCard).join('')
}

function getTopLikedGenres(tracks, limit = 2) {
  const likedIds = new Set(likedTracksManager?.likedTrackIds ? Array.from(likedTracksManager.likedTrackIds) : [])
  const counts = new Map()
  for (const t of tracks || []) {
    if (!t?.id || !likedIds.has(t.id)) continue
    const g = String(t.genre || '').trim()
    if (!g) continue
    const key = g.toLowerCase()
    counts.set(key, { genre: g, count: (counts.get(key)?.count || 0) + 1 })
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((x) => x.genre)
}

function renderBecauseYouLikedShelves(tracks) {
  const container = document.getElementById('becauseYouLikedShelves')
  if (!container) return

  const topGenres = getTopLikedGenres(tracks, 2)
  if (topGenres.length === 0) {
    container.innerHTML = ''
    return
  }

  const shelvesHtml = topGenres
    .map((genre) => {
      const genreKey = String(genre).toLowerCase()
      const picks = (tracks || [])
        .filter((t) => String(t.genre || '').toLowerCase().includes(genreKey))
        .slice()
        .sort((a, b) => (Number(b.streams || 0) - Number(a.streams || 0)))
        .slice(0, 8)

      if (picks.length === 0) return ''

      return `
        <div class="music-shelf">
          <div class="music-shelf-header">
            <div>
              <h3 class="section-title">Because you liked ${escapeHtml(genre)}</h3>
              <p class="section-subtitle">More ${escapeHtml(genre)} tracks you might enjoy</p>
            </div>
            <a class="music-shelf-link" href="#musicSection">See all</a>
          </div>
          <div class="music-shelf-row">
            ${picks.map(renderShelfCard).join('')}
          </div>
        </div>
      `
    })
    .join('')

  container.innerHTML = shelvesHtml
}

function renderTopPicks(tracks) {
  const row = document.getElementById('topPicksRow')
  if (!row) return

  const picks = (tracks || [])
    .slice()
    .sort((a, b) => (Number(b.streams || 0) - Number(a.streams || 0)))
    .slice(0, 10)

  if (picks.length === 0) {
    row.innerHTML = '<p class="shelf-empty">No top picks yet</p>'
    return
  }

  row.innerHTML = picks.map(renderShelfCard).join('')
}

function setupShelfListeners() {
  const shelves = document.getElementById('musicShelves')
  if (!shelves) return

  if (shelves._shelfHandlersAttached) return
  shelves._shelfHandlersAttached = true

  shelves.addEventListener('click', (e) => {
    const playBtn = e.target.closest('[data-shelf-play-track-id]')
    if (playBtn) {
      e.preventDefault()
      e.stopPropagation()
      const trackId = playBtn.dataset.shelfPlayTrackId
      const track = (window.__tracks || []).find((t) => String(t.id) === String(trackId))
      if (track) handlePlayTrack(track)
      return
    }

    const card = e.target.closest('[data-shelf-track-id]')
    if (card) {
      const trackId = card.dataset.shelfTrackId
      if (!trackId) return
      const href = `track-detail.html?id=${encodeURIComponent(trackId)}`
      if (typeof window.spaNavigate === 'function') {
        window.spaNavigate(href)
      } else {
        window.location.href = href
      }
    }
  })
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

  // Render with creative layout - featured card + smaller cards
  const featuredTrack = latestTracks[0]
  const sideTracks = latestTracks.slice(1)

  const featuredHtml = renderFeaturedReleaseCard(featuredTrack, 0, featuredTrack.artistName)
  const sideHtml = sideTracks.map((track, index) => renderSideReleaseCard(track, index + 1, track.artistName)).join('')

  container.innerHTML = `
    <div class="latest-releases-grid">
      <div class="featured-release">${featuredHtml}</div>
      <div class="side-releases">${sideHtml}</div>
    </div>
  `
}

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

function getTrackArtistAvatarHtml(track) {
  const primaryId = String(track?.artist || '').trim()
  const collabIds = safeArray(track?.collaborators).map((x) => String(x))

  const idsFromNames = normalizeArtistParts([
    track?.artistName,
    ...(safeArray(track?.collaboratorNames)),
  ])
    .map((n) => artistsByNameCache.get(String(n).toLowerCase())?.id)
    .filter(Boolean)
    .map((id) => String(id))

  const ids = uniqueStrings([primaryId, ...collabIds, ...idsFromNames].filter(Boolean))
  const items = ids
    .map((id) => ({ id, src: artistsByIdCache.get(String(id))?.image || '' }))
    .filter((x) => x.id && x.src)
    .slice(0, 4)

  if (items.length === 0) return ''

  return `
    <div class="collab-avatars track-artist-avatars">
      ${items
        .map(
          ({ id, src }) =>
            `<a class="collab-avatar artist-avatar-link" href="artist-detail.html?id=${encodeURIComponent(id)}" data-artist-id="${escapeHtml(id)}" aria-label="View artist" tabindex="0"><img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async"></a>`
        )
        .join('')}
    </div>
  `
}

function getDisplayArtistLine(track) {
  const isCollab = safeArray(track?.collaborators).length > 0 || safeArray(track?.collaboratorNames).length > 0

  if (!isCollab) {
    return track?.artistName || 'Unknown Artist'
  }

  const parts = normalizeArtistParts([
    ...(safeArray(track?.collaboratorNames)),
    track?.artistName,
    ...safeArray(track?.collaborators).map((id) => artistsByIdCache.get(String(id))?.name || ''),
  ])

  return parts.length > 0 ? parts.join(' & ') : 'Various Artists'
}

async function renderCollaborations(tracks, artistsById = new Map()) {
  const container = document.getElementById('collaborationsGrid')
  if (!container) return

  const collabTracks = (tracks || []).filter((t) => {
    const collabIds = safeArray(t.collaborators)
    return collabIds.length > 0
  })

  if (collabTracks.length === 0) {
    container.innerHTML = '<p class="text-center">No collaborations available yet</p>'
    return
  }

  const top = collabTracks
    .slice()
    .sort((a, b) => (Number(b.streams || 0) - Number(a.streams || 0)))
    .slice(0, 8)

  container.innerHTML = top.map((track) => {
    const collabIds = safeArray(track.collaborators)

    const primaryId = String(track.artist || '').trim()
    const allIds = uniqueStrings([primaryId, ...collabIds].filter(Boolean))

    const namesFromDoc = safeArray(track.collaboratorNames)
    const resolvedNames = normalizeArtistParts([
      track.artistName || '',
      ...namesFromDoc,
      ...collabIds.map((id) => artistsById.get(String(id))?.name || ''),
    ].filter(name => name && name !== 'Unknown Artist' && name.trim() !== ''))

    const artistsLine = resolvedNames.length > 0 ? resolvedNames.join(' & ') : 'Various Artists'

    const avatars = allIds
      .map((id) => artistsById.get(String(id))?.image || '')
      .filter(Boolean)
      .slice(0, 4)

    const avatarHtml = avatars.length
      ? avatars.map((src) => `
          <span class="collab-avatar"><img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async"></span>
        `).join('')
      : ''

    return `
      <div class="collab-card" data-track-id="${track.id || ''}" data-collab-track-id="${track.id || ''}">
        <div class="collab-artwork">
          <img src="${escapeHtml(track.artwork || '')}" alt="${escapeHtml(track.title || '')}" loading="lazy" decoding="async">
          <button class="collab-play-btn" aria-label="Play ${escapeHtml(track.title || '')}" type="button" data-collab-play-track-id="${track.id || ''}">
            <i class="fas fa-play"></i>
          </button>
        </div>
        <div class="collab-info">
          <p class="collab-title">${escapeHtml(track.title || '')}</p>
          <p class="collab-artists">${escapeHtml(artistsLine)}</p>
          <div class="collab-avatars">${avatarHtml}</div>
        </div>
      </div>
    `
  }).join('')
}

function renderFeaturedReleaseCard(track, index, artistName) {
  const categories = getTrackCategories(track)
  const badge = getTrackBadge(track)
  const spotifyUrl = track.spotifyUrl || (track.platformLinks?.spotify) || ''
  const isLiked = likedTracksManager.isTrackLiked(track.id)

  return `
    <div class="featured-release-card" data-track="${index}" data-category="${categories.join(' ')}" data-spotify-url="${spotifyUrl}" data-track-id="${track.id || ''}">
      <div class="featured-artwork">
        <img src="${escapeHtml(track.artwork || '')}" alt="${escapeHtml(track.title || '')}">
        <div class="featured-overlay">
          <div class="featured-gradient"></div>
          ${badge ? `<div class="featured-badge ${badge.type}">${badge.text}</div>` : ''}
          <button class="featured-play-btn" aria-label="Play ${escapeHtml(track.title || '')}" type="button">
            <i class="fas fa-play"></i>
          </button>
        </div>
      </div>
      <div class="featured-content">
        <div class="featured-number">01</div>
        <div class="featured-info">
          <h4 class="featured-title">${escapeHtml(track.title || '')}</h4>
          <p class="featured-artist">${escapeHtml(artistName || track.artistName || 'Unknown Artist')}</p>
          <div class="featured-meta">
            <span class="featured-genre">${escapeHtml(track.genre || '')}</span>
            <span class="featured-duration">${escapeHtml(track.duration || '')}</span>
          </div>
        </div>
        <div class="featured-actions">
          <button class="featured-like-btn ${isLiked ? 'liked' : ''}" title="Like" data-like-track-id="${track.id}" type="button">
            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
          </button>
          ${spotifyUrl ? `<a href="${spotifyUrl}" target="_blank" class="featured-spotify-btn" title="Listen on Spotify"><i class="fab fa-spotify"></i></a>` : ''}
        </div>
      </div>
    </div>
  `
}

function renderSideReleaseCard(track, index, artistName) {
  const categories = getTrackCategories(track)
  const badge = getTrackBadge(track)
  const spotifyUrl = track.spotifyUrl || (track.platformLinks?.spotify) || ''
  const isLiked = likedTracksManager.isTrackLiked(track.id)

  return `
    <div class="side-release-card" data-track="${index}" data-category="${categories.join(' ')}" data-spotify-url="${spotifyUrl}" data-track-id="${track.id || ''}">
      <div class="side-artwork">
        <img src="${escapeHtml(track.artwork || '')}" alt="${escapeHtml(track.title || '')}">
        <div class="side-overlay">
          <button class="side-play-btn" aria-label="Play ${escapeHtml(track.title || '')}" type="button">
            <i class="fas fa-play"></i>
          </button>
        </div>
        ${badge ? `<div class="side-badge ${badge.type}">${badge.text}</div>` : ''}
      </div>
      <div class="side-content">
        <div class="side-number">0${index + 1}</div>
        <div class="side-info">
          <h4 class="side-title">${escapeHtml(track.title || '')}</h4>
          <p class="side-artist">${escapeHtml(artistName || track.artistName || 'Unknown Artist')}</p>
        </div>
        <div class="side-actions">
          <button class="side-like-btn ${isLiked ? 'liked' : ''}" title="Like" data-like-track-id="${track.id}" type="button">
            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
          </button>
        </div>
      </div>
    </div>
  `
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
    'R&B': 'fa-piano',
    'Electronic': 'fa-music',
    'Afrobeat': 'fa-drum',
    'Afro-House': 'fa-compact-disc',
    'Dance': 'fa-guitar',
    'House': 'fa-record-vinyl',
    'Soul': 'fa-heart',
    'Pop': 'fa-star',
    'Hip-Hop': 'fa-microphone',
    'Reggae': 'fa-guitar',
    'Jazz': 'fa-saxophone',
    'Blues': 'fa-guitar',
    'Rock': 'fa-guitar',
    'Alternative': 'fa-headphones',
    'Indie': 'fa-music',
    'Folk': 'fa-guitar',
    'Country': 'fa-guitar',
    'Classical': 'fa-violin',
    'Gospel': 'fa-church',
    'World Music': 'fa-globe',
    'Latin': 'fa-music',
    'Funk': 'fa-music',
    'Disco': 'fa-record-vinyl'
  }

  // Genre descriptions
  const genreDescriptions = {
    'Afro-Pop': 'Vibrant African rhythms with modern pop influences',
    'Dancehall': 'Energetic Jamaican dance music',
    'R&B': 'Smooth rhythm and blues melodies',
    'Electronic': 'Electronic beats and synthesized sounds',
    'Afrobeat': 'West African funk and jazz fusion',
    'Afro-House': 'Deep house with African percussion',
    'Dance': 'Upbeat tracks for the dance floor',
    'House': 'Electronic dance music with soulful vocals',
    'Soul': 'Deep, emotional music with gospel roots',
    'Pop': 'Catchy mainstream hits and radio favorites',
    'Hip-Hop': 'Rhythmic beats and lyrical flow',
    'Reggae': 'Jamaican music with offbeat rhythms',
    'Jazz': 'Improvisational and sophisticated melodies',
    'Blues': 'Deep, soulful music with African roots',
    'Rock': 'Electric guitars and powerful vocals',
    'Alternative': 'Non-mainstream rock and experimental sounds',
    'Indie': 'Independent music with unique character',
    'Folk': 'Traditional acoustic music and storytelling',
    'Country': 'American roots music with storytelling',
    'Classical': 'Orchestral and instrumental masterpieces',
    'Gospel': 'Religious music with soulful vocals',
    'World Music': 'Global sounds and cultural fusion',
    'Latin': 'Rhythmic music from Latin America',
    'Funk': 'Groovy basslines and syncopated rhythms',
    'Disco': 'Dance music from the 70s and 80s'
  }

  container.innerHTML = Array.from(genreStats.entries()).map(([genre, stats]) => {
    // Case-insensitive icon lookup
    const icon = genreIcons[genre] || genreIcons[Object.keys(genreIcons).find(key => key.toLowerCase() === genre.toLowerCase())] || 'fa-music'
    const description = genreDescriptions[genre] || genreDescriptions[Object.keys(genreDescriptions).find(key => key.toLowerCase() === genre.toLowerCase())] || `Explore ${genre} music`
    return `
      <div class="service-card genre-card" data-genre="${genre.toLowerCase()}">
        <div class="service-icon"><i class="fas ${icon}"></i></div>
        <h4>${genre}</h4>
        <p>${description}</p>
        <span class="track-count">${stats.tracks} tracks</span>
        <div class="genre-stats">
          <span>${formatNumber(stats.streams)} Streams</span>
        </div>
        <button class="btn btn-sm btn-outline" onclick="filterByGenre('${genre}')">Explore</button>
      </div>
    `
  }).join('')
}

// Function to filter tracks by genre
function filterByGenre(genre) {
  const genreFilter = document.getElementById('genreFilter')
  if (genreFilter) {
    genreFilter.value = genre.toLowerCase()
    genreFilter.dispatchEvent(new Event('change'))
    
    // Scroll to music section
    const musicSection = document.getElementById('musicSection')
    if (musicSection) {
      musicSection.scrollIntoView({ behavior: 'smooth' })
    }
  }
}

async function initMusicPage() {
  const grid = document.getElementById('musicGrid')
  const resultsCount = document.getElementById('resultsCount')
  const loadMoreBtn = document.getElementById('loadMoreBtn')

  console.log('[MusicPage] Initializing music page...')
  let tracks = []

  if (loadMoreBtn && !loadMoreBtn._musicPageLoadMoreHandler) {
    loadMoreBtn._musicPageLoadMoreHandler = async () => {}
    loadMoreBtn.addEventListener('click', async () => {
      await loadNextTracksPage(resolveArtistName)
    })
  }

  let artistsById = new Map()
  try {
    const artists = await fetchArtists()
    artistsById = new Map((artists || []).map((a) => [String(a.id), a]))

    artistsByIdCache = artistsById
    artistsByNameCache = new Map(
      (artists || [])
        .filter((a) => a && a.name)
        .map((a) => [String(a.name).trim().toLowerCase(), a])
    )
  } catch (e) {
    console.warn('[MusicPage] Failed to fetch artists for collaborations section', e)
  }

  const artistCache = new Map()
  async function resolveArtistName(track) {
    // Handle collaboration tracks
    if (track.collaboratorNames && Array.isArray(track.collaboratorNames) && track.collaboratorNames.length > 0) {
      const names = uniqueStrings(track.collaboratorNames.filter(Boolean))
      return { name: names.join(' & '), socials: {} }
    }
    
    // Handle collaboration by IDs
    if (track.collaborators && Array.isArray(track.collaborators) && track.collaborators.length > 0) {
      const collaboratorNames = await Promise.all(
        track.collaborators.map(async (id) => {
          try {
            const key = String(id)
            // Only fetch from Firestore if this looks like a real artist doc id we already know.
            // Some older tracks stored collaborator values as names, not IDs.
            if (!artistsById.has(key)) return null
            const artist = artistsById.get(key) || await fetchArtistById(key)
            return artist?.name
          } catch (e) {
            console.warn('Failed to fetch collaborator:', id, e)
            return null
          }
        })
      )
      const names = uniqueStrings(collaboratorNames.filter(Boolean))
      if (names.length > 0) {
        return { name: names.join(' & '), socials: {} }
      }
    }
    
    // Handle single artist (original logic)
    const id = track.artist
    if (!id) return { name: track.artistName || 'Unknown Artist', socials: {} }
    if (artistCache.has(id)) return artistCache.get(id)
    const artist = artistsById.get(String(id)) || await fetchArtistById(id)
    const artistData = {
      name: artist?.name || track.artistName || 'Unknown Artist',
      socials: artist?.socials || {}
    }
    artistCache.set(id, artistData)
    return artistData
  }

  try {
    console.log('[MusicPage] Fetching first page of published tracks from Firestore...')
    const page = await fetchPublishedTracksPage({ pageSize: paginationState.pageSize, cursor: null })
    tracks = page.tracks || []
    paginationState.cursor = page.lastDoc
    if (!page.lastDoc || tracks.length < paginationState.pageSize) {
      paginationState.hasMore = false
    }
  } catch (e) {
    console.warn('[MusicPage] Page fetch failed, falling back to full fetch', e)
    paginationState.mode = 'all'
    paginationState.hasMore = false
    try {
      tracks = await fetchPublishedTracks()
    } catch (err) {
      console.error('[MusicPage] Error fetching tracks:', err)
      if (grid) grid.innerHTML = '<p class="text-center">Error loading tracks. Please check console for details.</p>'
      if (resultsCount) resultsCount.textContent = '0 tracks'
      paginationState.isLoading = false
      updateLoadMoreVisibility()
      return
    }
  }

  if (!Array.isArray(tracks) || tracks.length === 0) {
    console.log('[MusicPage] No tracks found')
    if (grid) {
      grid.innerHTML = `
        <div class="no-results-message">
          <div class="no-results-content">
            <i class="fas fa-music"></i>
            <h4>No Tracks Yet</h4>
            <p>Please check back soon.</p>
          </div>
        </div>
      `
    }
    if (resultsCount) resultsCount.textContent = '0 tracks'
    paginationState.hasMore = false
    updateLoadMoreVisibility()
    document.dispatchEvent(new CustomEvent('music:loaded'))

    // Ensure dependent sections also show empty states.
    const latestReleases = document.getElementById('latestReleases')
    if (latestReleases) latestReleases.innerHTML = '<p class="text-center">No latest releases yet</p>'

    const collaborationsGrid = document.getElementById('collaborationsGrid')
    if (collaborationsGrid) collaborationsGrid.innerHTML = '<p class="text-center">No collaborations available yet</p>'
    return
  }

  const normalizedTracks = await normalizeTracksBatch(tracks || [], resolveArtistName)

  // Used by audio-player.js (which prefers window.__tracks when present)
  window.__tracks = normalizedTracks

  // Render all loaded tracks initially using the filtered rendering system
  renderFilteredTracks(normalizedTracks)
  if (resultsCount) resultsCount.textContent = `${normalizedTracks.length} track${normalizedTracks.length !== 1 ? 's' : ''}`
  updateLoadMoreVisibility()

  // Dispatch event for loading skeleton to hide
  document.dispatchEvent(new CustomEvent('music:loaded'))

  // Render Latest Releases section
  await renderLatestReleases(normalizedTracks)

  // Render Collaborations section
  await renderCollaborations(normalizedTracks, artistsById)

  renderMadeForYou(normalizedTracks)
  renderTopPicks(normalizedTracks)
  renderBecauseYouLikedShelves(normalizedTracks)
  setupShelfListeners()

  if (!document._madeForYouLikedListenerAttached) {
    document._madeForYouLikedListenerAttached = true
    document.addEventListener('likedTracksUpdated', () => {
      renderMadeForYou(window.__tracks || [])
      renderBecauseYouLikedShelves(window.__tracks || [])
    })
  }

  // Setup button event listeners
  setupTrackCardListeners()
  
  // Setup hero play button
  setupHeroPlayButton()
}

function setupTrackCardListeners() {
  if (document._musicPageTrackListenersAttached) return
  document._musicPageTrackListenersAttached = true

  document.addEventListener('click', (e) => {
    // Play buttons
    const collabPlayBtn = e.target.closest('.collab-play-btn')
    if (collabPlayBtn) {
      e.preventDefault()
      e.stopPropagation()
      const trackId = collabPlayBtn.dataset.collabPlayTrackId
      const track = (window.__tracks || []).find((t) => String(t.id) === String(trackId))
      if (track) handlePlayTrack(track)
      return
    }

    const playBtn = e.target.closest('.track-play-btn, .featured-play-btn, .side-play-btn')
    if (playBtn) {
      e.preventDefault()
      e.stopPropagation()
      const card = playBtn.closest('.track-card, .featured-release-card, .side-release-card')
      const trackId = card?.dataset?.trackId
      const trackById = trackId ? (window.__tracks || []).find((t) => String(t.id) === String(trackId)) : null
      if (trackById) {
        handlePlayTrack(trackById)
        return
      }

      const trackIndex = parseInt(card?.dataset?.track)
      const trackByIndex = Number.isFinite(trackIndex) ? window.__tracks?.[trackIndex] : null
      if (trackByIndex) handlePlayTrack(trackByIndex)
      return
    }

    // Artist avatar navigation
    const artistLink = e.target.closest('.artist-avatar-link[data-artist-id]')
    if (artistLink) {
      e.preventDefault()
      e.stopPropagation()
      const artistId = artistLink.dataset.artistId
      if (!artistId) return
      const href = `artist-detail.html?id=${encodeURIComponent(artistId)}`
      if (typeof window.spaNavigate === 'function') {
        window.spaNavigate(href)
      } else {
        window.location.href = href
      }
      return
    }

    // Like buttons
    const likeBtn = e.target.closest('.like-btn-mini[data-like-track-id], .featured-like-btn[data-like-track-id], .side-like-btn[data-like-track-id]')
    if (likeBtn) {
      e.preventDefault()
      e.stopPropagation()
      const trackId = likeBtn.dataset.likeTrackId
      handleLikeTrack(trackId, likeBtn)
      return
    }

    // Spotify indicator
    const spotifyIndicator = e.target.closest('.spotify-indicator, .featured-spotify-btn')
    if (spotifyIndicator) {
      e.preventDefault()
      e.stopPropagation()
      const card = spotifyIndicator.closest('.track-card, .featured-release-card')
      const spotifyUrl = card?.dataset?.spotifyUrl
      if (spotifyUrl) window.open(spotifyUrl, '_blank')
      return
    }

    // Card navigation
    const card = e.target.closest('.track-card, .featured-release-card, .side-release-card, .collab-card')
    if (card) {
      const trackId = card.dataset.trackId || card.dataset.collabTrackId
      if (!trackId) return
      const href = `track-detail.html?id=${trackId}`
      if (typeof window.spaNavigate === 'function') {
        window.spaNavigate(href)
      } else {
        window.location.href = href
      }
    }
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
      searchFilters.classList.toggle('show')
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
  const cards = tracks.map((track, index) => {
    const displayArtistLine = getDisplayArtistLine(track)
    const avatars = getTrackArtistAvatarHtml(track)
    return renderTrackCard(track, index, displayArtistLine, {}, avatars)
  })
  grid.innerHTML = cards.join('')

  // Re-setup event listeners for new cards
  setupTrackCardListeners()
}

function updateLoadMoreVisibility() {
  const btn = document.getElementById('loadMoreBtn')
  if (!btn) return
  btn.style.display = paginationState.hasMore ? 'inline-flex' : 'none'
  btn.disabled = paginationState.isLoading
}

async function normalizeTracksBatch(tracks, resolveArtistName) {
  const artistDatas = await Promise.all((tracks || []).map((t) => resolveArtistName(t)))
  return (tracks || []).map((t, i) => {
    const artistData = artistDatas[i] || { name: t?.artistName || 'Unknown Artist' }
    const displayArtistLine = getDisplayArtistLine({ ...t, artistName: artistData.name })
    return {
      ...t,
      artistName: displayArtistLine,
    }
  })
}

async function loadNextTracksPage(resolveArtistName) {
  if (paginationState.isLoading || !paginationState.hasMore) return
  paginationState.isLoading = true
  updateLoadMoreVisibility()

  try {
    const { tracks, lastDoc } = await fetchPublishedTracksPage({
      pageSize: paginationState.pageSize,
      cursor: paginationState.cursor,
    })

    paginationState.cursor = lastDoc
    if (!lastDoc || (tracks || []).length < paginationState.pageSize) {
      paginationState.hasMore = false
    }

    const normalized = await normalizeTracksBatch(tracks || [], resolveArtistName)
    window.__tracks = Array.isArray(window.__tracks) ? window.__tracks.concat(normalized) : normalized
    applyAllFilters()
  } catch (e) {
    console.warn('[MusicPage] Pagination failed, falling back to full fetch', e)
    paginationState.mode = 'all'
    paginationState.hasMore = false

    const tracks = await fetchPublishedTracks()
    const normalized = await normalizeTracksBatch(tracks || [], resolveArtistName)
    window.__tracks = normalized
    applyAllFilters()
  } finally {
    paginationState.isLoading = false
    updateLoadMoreVisibility()
  }
}

function handleSearch(query) {
  filterState.searchTerm = query
  applyAllFilters()
}

function setupHeroPlayButton() {
  const heroPlayBtn = document.getElementById('musicHeroPlayBtn')
  if (!heroPlayBtn) return
  
  heroPlayBtn.addEventListener('click', () => {
    // Check if currently playing, if so pause/resume
    if (heroPlayBtn.classList.contains('playing')) {
      // Toggle play/pause
      if (window.persistentPlayer) {
        if (window.persistentPlayer.isPlaying) {
          window.persistentPlayer.pause()
        } else {
          window.persistentPlayer.play()
        }
      } else if (window.audioPlayer) {
        if (window.audioPlayer.isPlaying) {
          window.audioPlayer.pause()
        } else {
          window.audioPlayer.play()
        }
      }
    } else {
      // Start playing all tracks
      playAllTracks()
    }
  })
  
  // Listen for player state changes to update button
  setupPlayerStateSync()
}

function setupPlayerStateSync() {
  // Listen for floating player state changes
  document.addEventListener('floatingPlayerStateChanged', (e) => {
    const { isPlaying, track } = e.detail
    updateHeroPlayButtonState(isPlaying)
  })
  
  // Listen for persistent player close event
  document.addEventListener('persistentPlayer:closed', (e) => {
    const { isPlaying, currentTrack } = e.detail
    updateHeroPlayButtonState(false)
  })
  
  // Listen for persistent player state changes (fallback)
  document.addEventListener('persistentPlayer:stateChanged', (e) => {
    const { isPlaying, currentTrack } = e.detail
    updateHeroPlayButtonState(isPlaying)
  })
  
  // Listen for audio player state changes
  if (window.audioPlayer) {
    const originalTogglePlay = window.audioPlayer.togglePlay
    window.audioPlayer.togglePlay = function() {
      const result = originalTogglePlay.call(this)
      updateHeroPlayButtonState(this.isPlaying)
      return result
    }
    
    const originalPlay = window.audioPlayer.play
    window.audioPlayer.play = function() {
      const result = originalPlay.call(this)
      updateHeroPlayButtonState(true)
      return result
    }
    
    const originalPause = window.audioPlayer.pause
    window.audioPlayer.pause = function() {
      const result = originalPause.call(this)
      updateHeroPlayButtonState(false)
      return result
    }
  }
  
  // Listen for track end to update button
  document.addEventListener('audioPlayer:trackEnded', () => {
    // Check if player should continue playing or stop
    setTimeout(() => {
      checkAndUpdateHeroButtonState()
    }, 100)
  })
  
  // Listen for page visibility changes to sync button state
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkAndUpdateHeroButtonState()
    }
  })
  
  // Periodic sync every 2 seconds to ensure consistency
  setInterval(() => {
    checkAndUpdateHeroButtonState()
  }, 2000)
}

function playAllTracks() {
  console.log('[MusicPage] Playing all tracks from hero button')
  
  if (!window.__tracks || window.__tracks.length === 0) {
    console.warn('[MusicPage] No tracks available to play')
    if (window.notifications) {
      window.notifications.show('No tracks available to play', 'warning')
    }
    return
  }
  
  // Use persistent floating player if available
  if (window.persistentPlayer) {
    // Set up full playlist of all tracks
    const playlistData = window.__tracks.map(t => ({
      id: t.id,
      title: t.title,
      artistName: t.artistName,
      artwork: t.artwork,
      platformLinks: t.platformLinks || {},
      originalData: t
    }))
    
    window.persistentPlayer.setPlaylist(playlistData, 0)
    window.persistentPlayer.play()
    
    // Show notification
    if (window.notifications) {
      window.notifications.show(`Playing ${window.__tracks.length} tracks`, 'success')
    }
    
    // Update hero button to show playing state
    updateHeroPlayButtonState(true)
    
    // Scroll to music section to show the player
    const musicSection = document.getElementById('musicSection')
    if (musicSection) {
      setTimeout(() => {
        musicSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 500)
    }
  } else {
    // Fallback to regular audio player
    const audioPlayer = window.audioPlayer
    if (audioPlayer && window.__tracks.length > 0) {
      audioPlayer.currentTrackIndex = 0
      audioPlayer.loadTrack(0)
      audioPlayer.play()
      
      if (window.notifications) {
        window.notifications.show(`Playing ${window.__tracks.length} tracks`, 'success')
      }
      
      updateHeroPlayButtonState(true)
    } else {
      console.error('[MusicPage] No player available')
      if (window.notifications) {
        window.notifications.show('Player not available', 'error')
      }
    }
  }
}

function updateHeroPlayButtonState(isPlaying) {
  const heroPlayBtn = document.getElementById('musicHeroPlayBtn')
  const heroPlayIcon = heroPlayBtn?.querySelector('.hero-play-icon i')
  
  if (heroPlayIcon) {
    if (isPlaying) {
      heroPlayIcon.classList.remove('fa-play')
      heroPlayIcon.classList.add('fa-pause')
      heroPlayBtn?.classList.add('playing')
    } else {
      heroPlayIcon.classList.remove('fa-pause')
      heroPlayIcon.classList.add('fa-play')
      heroPlayBtn?.classList.remove('playing')
    }
  }
}

// Enhanced function to check actual player state
function checkAndUpdateHeroButtonState() {
  let isPlaying = false
  
  // Check persistent floating player first
  if (window.persistentPlayer) {
    isPlaying = window.persistentPlayer.isPlaying
  }
  // Fallback to regular audio player
  else if (window.audioPlayer) {
    isPlaying = window.audioPlayer.isPlaying
  }
  
  updateHeroPlayButtonState(isPlaying)
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
  
  // Use centralized liked tracks manager
  const track = (window.__tracks || []).find(t => t.id === trackId) || { id: trackId }
  likedTracksManager.toggleLike(track, btn).then(result => {
    if (result.error) {
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

  const uid = window.userAuth?.getCurrentUser?.()?.uid
  if (!uid) return

  addToPlaylistFlow(uid, track).catch((e) => {
    console.error('[MusicPage] Failed to add to playlist:', e)
    showNotification('Error adding to playlist.', 'error')
  })
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
        showNotification('Invalid playlist selection.', 'error')
        return
      }
      playlistId = playlists[n - 1].id
    }
  }

  await addTrackToPlaylist(uid, playlistId, track)
  showNotification('Added to playlist!', 'success')
}

async function promptForText(message) {
  if (window.notifications?.prompt) {
    return await window.notifications.prompt(message)
  }
  return prompt(message)
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
  if (typeof window.spaNavigate === 'function') {
    window.spaNavigate(authUrl)
  } else {
    window.location.href = authUrl
  }
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
  console.log('[MusicPage] Added to playlist after login:', trackData.title)
  handleAddToPlaylist(trackData)
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

function initMobileCustomSelects() {
  const shouldUseCustom = window.matchMedia('(max-width: 480px)').matches
  if (!shouldUseCustom) return

  const selects = Array.from(document.querySelectorAll('.search-filters .filter-select'))
  if (!selects.length) return

  document.body.classList.add('has-custom-select')

  const closeAll = () => {
    document.querySelectorAll('.filter-select-custom.is-open').forEach(el => {
      el.classList.remove('is-open')
    })
  }

  if (!window.__customSelectOutsideHandlerAttached) {
    window.__customSelectOutsideHandlerAttached = true
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.filter-select-custom')) closeAll()
    })
  }

  selects.forEach((select) => {
    if (!select || select.dataset.customized === '1') return
    select.dataset.customized = '1'

    const wrapper = document.createElement('div')
    wrapper.className = 'filter-select-custom'

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'filter-select-custom-btn'

    const menu = document.createElement('div')
    menu.className = 'filter-select-custom-menu'

    const setLabel = () => {
      const opt = select.options[select.selectedIndex]
      btn.textContent = opt ? opt.textContent : ''
    }

    const buildMenu = () => {
      menu.innerHTML = ''
      Array.from(select.options).forEach((opt) => {
        const item = document.createElement('button')
        item.type = 'button'
        item.className = 'filter-select-custom-item'
        item.dataset.value = opt.value
        item.textContent = opt.textContent
        item.addEventListener('click', () => {
          select.value = opt.value
          setLabel()
          select.dispatchEvent(new Event('change', { bubbles: true }))
          wrapper.classList.remove('is-open')
        })
        menu.appendChild(item)
      })
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault()
      const isOpen = wrapper.classList.contains('is-open')
      closeAll()
      wrapper.classList.toggle('is-open', !isOpen)
    })

    select.addEventListener('change', () => {
      setLabel()
    })

    setLabel()
    buildMenu()

    select.parentNode.insertBefore(wrapper, select)
    wrapper.appendChild(select)
    wrapper.appendChild(btn)
    wrapper.appendChild(menu)
  })
}

function boot() {
  initMobileCustomSelects()
  initMusicPage().catch(console.error)
  // Execute any pending action after login
  setTimeout(() => executePendingAction(), 500)
  
  // Listen for liked tracks updates to refresh UI
  if (!window.__musicLikedTracksListenerBound) {
    window.__musicLikedTracksListenerBound = true
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
  const root = document.getElementById('musicGrid')
  if (!root) return
  const page = (window.location.pathname.split('/').pop() || 'index.html')
  if (page !== 'music.html') return
  boot()
})
