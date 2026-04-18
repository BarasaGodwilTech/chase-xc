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
          <div class="overlay-actions">
            <button class="overlay-btn" title="Add to playlist" type="button">
              <i class="fas fa-plus"></i>
            </button>
            <button class="overlay-btn" title="Like" data-like-track-id="${track.id}" type="button">
              <i class="far fa-heart"></i>
            </button>
            <button class="overlay-btn" title="Share" type="button">
              <i class="fas fa-share"></i>
            </button>
          </div>
        </div>
      </div>
      <div class="track-content">
        <h4 class="track-title">${track.title || ''}</h4>
        <p class="track-artist">${artistName || track.artistName || 'Unknown Artist'}</p>
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

async function initMusicPage() {
  const grid = document.getElementById('musicGrid')
  if (!grid) return

  const resultsCount = document.getElementById('resultsCount')

  let tracks
  try {
    tracks = await fetchPublishedTracks()
  } catch (e) {
    console.error(e)
    grid.innerHTML = ''
    if (resultsCount) resultsCount.textContent = '0 tracks'
    return
  }

  if (!Array.isArray(tracks) || tracks.length === 0) {
    grid.innerHTML = ''
    if (resultsCount) resultsCount.textContent = '0 tracks'
    window.__tracks = []
    return
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

  grid.innerHTML = cards.join('')
  if (resultsCount) resultsCount.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`
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
    console.log('[MusicPage] No tracks found or invalid data format')
    if (grid) grid.innerHTML = '<p class="text-center">No tracks available yet. Check back soon!</p>'
    if (resultsCount) resultsCount.textContent = '0 tracks'
    window.__tracks = []

    // Still render empty states for other sections
    await renderLatestReleases([])
    await renderGenreCards([])
    return
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
}

function boot() {
  initMusicPage().catch(console.error)
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('[data-include]')) return
  boot()
})

document.addEventListener('includes:loaded', () => {
  boot()
})
