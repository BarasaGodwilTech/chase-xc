import { fetchArtists, fetchPublishedTracks } from './data/content-repo.js'

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

function renderArtistCard(artist, stats) {
  const imageUrl = artist.image || artist.artwork || 'images/headphones.png'
  const genre = artist.genre || 'Music'
  const bio = artist.bio || artist.description || ''
  const socials = artist.socials || {}
  const artistId = artist.id

  return `
    <div class="artist-card" data-artist-id="${escapeHtml(artistId)}" role="button" tabindex="0">
      <div class="artist-image">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(artist.name || 'Artist')}">
      </div>
      <h4>${escapeHtml(artist.name || 'Unknown Artist')}</h4>
      <p class="artist-genre">${escapeHtml(genre)}</p>
      ${bio ? `<p class="artist-bio">${escapeHtml(bio)}</p>` : ''}
      <div class="artist-stats">
        <span>${formatNumber(stats.trackCount)} Releases</span>
        <span>${formatNumber(stats.totalStreams)} Streams</span>
      </div>
      <div class="artist-socials">
        ${socials.instagram ? `<a href="${escapeHtml(socials.instagram)}" target="_blank" rel="noopener" title="Instagram"><i class="fab fa-instagram"></i></a>` : ''}
        ${socials.spotify ? `<a href="${escapeHtml(socials.spotify)}" target="_blank" rel="noopener" title="Spotify"><i class="fab fa-spotify"></i></a>` : ''}
        ${socials.youtube ? `<a href="${escapeHtml(socials.youtube)}" target="_blank" rel="noopener" title="YouTube"><i class="fab fa-youtube"></i></a>` : ''}
        ${socials.soundcloud ? `<a href="${escapeHtml(socials.soundcloud)}" target="_blank" rel="noopener" title="SoundCloud"><i class="fab fa-soundcloud"></i></a>` : ''}
        ${socials.tiktok ? `<a href="${escapeHtml(socials.tiktok)}" target="_blank" rel="noopener" title="TikTok"><i class="fab fa-tiktok"></i></a>` : ''}
        ${socials.appleMusic ? `<a href="${escapeHtml(socials.appleMusic)}" target="_blank" rel="noopener" title="Apple Music"><i class="fab fa-apple"></i></a>` : ''}
      </div>
    </div>
  `
}

function setupArtistCardNavigation() {
  const go = (artistId) => {
    if (!artistId) return
    const href = `artist-detail.html?id=${encodeURIComponent(artistId)}`
    if (typeof window.spaNavigate === 'function') {
      window.spaNavigate(href)
    } else {
      window.location.href = href
    }
  }

  document.querySelectorAll('.artist-card[data-artist-id]').forEach((card) => {
    if (card._navBound) return
    card._navBound = true

    card.addEventListener('click', (e) => {
      if (e.target.closest('.artist-socials a')) return
      go(card.dataset.artistId)
    })

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        go(card.dataset.artistId)
      }
    })
  })
}

async function load() {
  const grid = document.getElementById('artistsGrid')

  if (!grid) return

  grid.innerHTML = '<p class="text-center">Loading artists...</p>'

  try {
    const [artists, tracks] = await Promise.all([
      fetchArtists(),
      fetchPublishedTracks(),
    ])

    const activeArtists = (artists || []).filter((a) => a && a.id && (a.status === 'active' || !a.status))

    const statsByArtist = new Map()
    for (const t of tracks || []) {
      const artistId = String(t.artist || '')
      if (!artistId) continue
      if (!statsByArtist.has(artistId)) statsByArtist.set(artistId, { trackCount: 0, totalStreams: 0 })
      const s = statsByArtist.get(artistId)
      s.trackCount += 1
      s.totalStreams += Number(t.streams || 0)
    }

    // Hero stats
    const artistsCountEl = document.getElementById('artistsCount')
    const releasesCountEl = document.getElementById('releasesCount')
    const streamsCountEl = document.getElementById('streamsCount')

    if (artistsCountEl) artistsCountEl.textContent = formatNumber(activeArtists.length)
    if (releasesCountEl) releasesCountEl.textContent = formatNumber((tracks || []).length)
    if (streamsCountEl) {
      const totalStreams = (tracks || []).reduce((sum, t) => sum + Number(t.streams || 0), 0)
      streamsCountEl.textContent = formatNumber(totalStreams)
    }

    if (activeArtists.length === 0) {
      grid.innerHTML = '<p class="text-center">No artists available yet. Check back soon!</p>'
      return
    }

    activeArtists.sort((a, b) => {
      const sa = statsByArtist.get(String(a.id))?.totalStreams || 0
      const sb = statsByArtist.get(String(b.id))?.totalStreams || 0
      return sb - sa
    })

    grid.innerHTML = activeArtists
      .map((a) => renderArtistCard(a, statsByArtist.get(String(a.id)) || { trackCount: 0, totalStreams: 0 }))
      .join('')

    setupArtistCardNavigation()
  } catch (e) {
    console.error('[ArtistsPage] Failed to load artists:', e)
    grid.innerHTML = '<p class="text-center">Error loading artists.</p>'
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
  const grid = document.getElementById('artistsGrid')
  if (!grid) return
  const page = (window.location.pathname.split('/').pop() || 'index.html')
  if (page !== 'artists.html') return
  // Prevent duplicate reloads for same URL.
  const url = window.location.href
  if (grid.dataset.loadedUrl === url) return
  grid.dataset.loadedUrl = url
  boot()
})
