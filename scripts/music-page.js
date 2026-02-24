import { fetchPublishedTracks, fetchArtistById } from './data/content-repo.js'

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

  return `
    <div class="track-card" data-track="${index}" data-category="${categories.join(' ')}">
      <div class="track-artwork">
        <img src="${track.artwork || ''}" alt="${track.title || ''}">
        <button class="play-btn-card" type="button">
          <i class="fas fa-play"></i>
        </button>
        ${badge ? `<div class="track-badge ${badge.type}">${badge.text}</div>` : ''}
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
