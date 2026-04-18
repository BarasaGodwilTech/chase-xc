import { fetchArtists } from './data/content-repo.js'

function formatNumber(num) {
  if (typeof num !== 'number') return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return String(num)
}

function renderArtistCard(artist, index) {
  const imageUrl = artist.image || artist.artwork || '/placeholder.svg?height=300&width=300'
  const genre = artist.genre || 'Music'
  const bio = artist.bio || artist.description || 'Talented artist at Chase x Records'
  const socials = artist.socials || {}
  
  return `
    <div class="artist-card" data-artist="${index}">
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
    const { fetchPublishedTracks } = await import('./data/content-repo.js')
    const tracks = await fetchPublishedTracks()
    console.log('[HomePage] Fetched tracks:', tracks.length)

    if (!Array.isArray(tracks) || tracks.length === 0) {
      container.innerHTML = '<p class="text-center">No tracks available yet. Check back soon!</p>'
      return
    }

    // Limit to 4 featured tracks for the homepage
    const featuredTracks = tracks.slice(0, 4)

    container.innerHTML = featuredTracks.map((track, index) => {
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

      return `
        <div class="track-card" data-track="${index}" data-category="${categories.join(' ')}" data-spotify-url="${spotifyUrl}" data-track-id="${track.id || ''}">
          <div class="track-artwork">
            <img src="${track.artwork || ''}" alt="${track.title || ''}">
            <button class="play-btn-card" type="button">
              <i class="fas fa-play"></i>
            </button>
            ${badge ? `<div class="track-badge ${badge === 'Trending' ? 'trending' : badge === 'Popular' ? 'popular' : 'new-release'}">${badge}</div>` : ''}
            ${spotifyUrl ? '<div class="spotify-indicator" title="Listen on Spotify"><i class="fab fa-spotify"></i></div>' : ''}
            <div class="track-overlay">
              <div class="overlay-actions">
                <button class="overlay-btn" title="Add to playlist" type="button">
                  <i class="fas fa-plus"></i>
                </button>
                <button class="overlay-btn" title="Like" type="button">
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
            <p class="track-artist">${track.artistName || 'Unknown Artist'}</p>
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
    }).join('')

    console.log('[HomePage] Rendered', featuredTracks.length, 'tracks')
  } catch (error) {
    console.error('[HomePage] Error loading tracks:', error)
    if (container) {
      container.innerHTML = '<p class="text-center">Error loading tracks. Please check console for details.</p>'
    }
  }
}

function initHomePage() {
  console.log('[HomePage] Initializing homepage...')
  loadFeaturedArtists()
  loadFeaturedTracks()
}

function boot() {
  initHomePage().catch(console.error)
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('[data-include]')) return
  boot()
})

document.addEventListener('includes:loaded', () => {
  boot()
})
