import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js'

import { db, storage } from './firebase-init.js'

function normalizeGenre(genre) {
  return (genre || '').trim()
}

async function fetchArtists() {
  const artistsRef = collection(db, 'artists')
  const q = query(artistsRef, orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function fetchTracks() {
  const tracksRef = collection(db, 'tracks')
  const snap = await getDocs(tracksRef)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function fetchPayments() {
  const paymentsRef = collection(db, 'payments')
  const snap = await getDocs(paymentsRef)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

function formatNumber(num) {
  const n = Number(num || 0)
  return n.toLocaleString()
}

async function renderArtistsTable() {
  const tbody = document.getElementById('artistsTable')
  if (!tbody) return

  try {
    const [artists, tracks] = await Promise.all([fetchArtists(), fetchTracks()])
    if (!artists || artists.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No artists found</td></tr>'
      return
    }

    const statsByArtist = new Map()
    for (const t of tracks || []) {
      const artistId = String(t.artist || '')
      if (!artistId) continue
      if (!statsByArtist.has(artistId)) statsByArtist.set(artistId, { tracks: 0, streams: 0 })
      const s = statsByArtist.get(artistId)
      s.tracks += 1
      s.streams += Number(t.streams || 0)
    }

    tbody.innerHTML = artists
      .map((a) => {
        const name = a.name || 'Unnamed'
        const genre = a.genre || ''
        const status = a.status || 'active'
        const since = a.createdAt && a.createdAt.toDate ? String(a.createdAt.toDate().getFullYear()) : ''
        const image = a.image || ''

        const stats = statsByArtist.get(a.id) || { tracks: 0, streams: 0 }

        return `
          <tr>
            <td>
              <div class="artist-cell">
                ${image ? `<img src="${image}" alt="${name}" class="artist-avatar">` : ''}
                <span>${name}</span>
              </div>
            </td>
            <td>${genre}</td>
            <td>${formatNumber(stats.tracks)}</td>
            <td>${formatNumber(stats.streams)}</td>
            <td>${since}</td>
            <td><span class="status-badge status-${status}">${status}</span></td>
            <td>
              <div class="action-buttons">
                <button class="btn btn-secondary btn-sm" type="button" disabled>
                  <i class="fas fa-eye"></i>
                </button>
              </div>
            </td>
          </tr>
        `
      })
      .join('')
  } catch (e) {
    console.error(e)
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Failed to load artists</td></tr>'
  }
}

let artistCache = null
async function resolveArtistName(artistId) {
  if (!artistId) return ''
  if (!artistCache) {
    artistCache = new Map()
    const artists = await fetchArtists()
    artists.forEach((a) => artistCache.set(a.id, a.name || ''))
  }
  return artistCache.get(artistId) || ''
}

async function populateArtistSelect(selectedId = '') {
  const select = document.getElementById('trackArtist')
  if (!select) return

  const addNewOptionValue = '__add_new__'
  const ensureBaseOptions = () => {
    if (!Array.from(select.options).some((o) => o.value === '')) {
      const opt = document.createElement('option')
      opt.value = ''
      opt.textContent = 'Select Artist'
      select.appendChild(opt)
    }
    if (!Array.from(select.options).some((o) => o.value === addNewOptionValue)) {
      const opt = document.createElement('option')
      opt.value = addNewOptionValue
      opt.textContent = '+ Add new artist...'
      select.appendChild(opt)
    }
  }

  const keepOptions = []
  for (const opt of Array.from(select.options)) {
    if (opt.value === '' || opt.value === addNewOptionValue) keepOptions.push(opt)
  }

  select.innerHTML = ''
  keepOptions.forEach((o) => select.appendChild(o))
  ensureBaseOptions()

  try {
    const artists = await fetchArtists()
    if (!artistCache) artistCache = new Map()
    artists.forEach((a) => {
      artistCache.set(a.id, a.name || '')
      const opt = document.createElement('option')
      opt.value = a.id
      opt.textContent = a.name || a.id
      select.appendChild(opt)
    })
  } catch (e) {
    console.error(e)
  }

  if (selectedId) select.value = selectedId
}

function openAddArtistModal() {
  const modal = document.getElementById('addArtistModal')
  if (!modal) return
  modal.style.display = 'flex'
  modal.setAttribute('aria-hidden', 'false')
}

function closeAddArtistModal() {
  const modal = document.getElementById('addArtistModal')
  if (!modal) return
  modal.style.display = 'none'
  modal.setAttribute('aria-hidden', 'true')
}

function schedulePopulateArtistSelect(selectedId = '') {
  // Other scripts may overwrite the select when switching sections.
  // Schedule a repopulate after the UI finishes switching.
  setTimeout(() => {
    populateArtistSelect(selectedId).catch(console.error)
  }, 350)
}

function setArtistImagePreview(file) {
  const preview = document.getElementById('artistImagePreview')
  if (!preview) return

  if (!file || !(file instanceof File) || file.size === 0) {
    preview.classList.remove('is-visible')
    preview.style.backgroundImage = ''
    preview.setAttribute('aria-hidden', 'true')
    return
  }

  const url = URL.createObjectURL(file)
  preview.style.backgroundImage = `url('${url}')`
  preview.classList.add('is-visible')
  preview.setAttribute('aria-hidden', 'false')
}

function captureAudioUploadDraft() {
  const form = document.getElementById('audioUploadForm')
  if (!form) return null
  const fd = new FormData(form)

  const audioFile = /** @type {File|null} */ (fd.get('audioFile'))
  const artworkFile = /** @type {File|null} */ (fd.get('trackArtwork'))

  return {
    trackTitle: String(fd.get('trackTitle') || ''),
    trackGenre: String(fd.get('trackGenre') || ''),
    releaseDate: String(fd.get('releaseDate') || ''),
    trackDuration: String(fd.get('trackDuration') || ''),
    trackDescription: String(fd.get('trackDescription') || ''),
    audioFile: audioFile instanceof File && audioFile.size > 0 ? audioFile : null,
    artworkFile: artworkFile instanceof File && artworkFile.size > 0 ? artworkFile : null,
  }
}

function restoreAudioUploadDraft(draft) {
  if (!draft) return
  const form = document.getElementById('audioUploadForm')
  if (!form) return

  const setValue = (id, val) => {
    const el = document.getElementById(id)
    if (el && typeof val === 'string') el.value = val
  }

  setValue('trackTitle', draft.trackTitle)
  setValue('trackGenre', draft.trackGenre)
  setValue('releaseDate', draft.releaseDate)
  setValue('trackDuration', draft.trackDuration)
  setValue('trackDescription', draft.trackDescription)

  // File inputs cannot be programmatically set for security reasons.
  // We keep draft.audioFile/artworkFile only as a hint for future enhancement.
}

async function handleAddArtistSubmit(e) {
  e.preventDefault()
  console.log('[admin-firebase] Add artist submit')
  const form = e.currentTarget
  const fd = new FormData(form)

  const name = String(fd.get('artistName') || '').trim()
  const genre = String(fd.get('artistGenre') || '').trim()
  const bio = String(fd.get('artistBio') || '').trim()
  const imageFile = /** @type {File|null} */ (fd.get('artistImage'))

  if (!name) {
    alert('Artist name is required')
    return
  }

  let imageUrl = ''
  try {
    if (imageFile && imageFile instanceof File && imageFile.size > 0) {
      try {
        const now = Date.now()
        const ext = safeFileExt(imageFile.name) || 'jpg'
        const path = `artists/${now}.${ext}`
        imageUrl = await uploadFileToStorage(path, imageFile)
      } catch (uploadErr) {
        console.error(uploadErr)

        const msg =
          'Artist image upload failed. This usually means Firebase Storage is not enabled or Storage rules block uploads.\n\n' +
          'I can still save the artist WITHOUT an image. Continue?'

        const ok = confirm(msg)
        if (!ok) return
        imageUrl = ''
      }
    }

    const ref = await addDoc(collection(db, 'artists'), {
      name,
      genre,
      bio,
      image: imageUrl,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Refresh caches + selects
    artistCache = null
    await populateArtistSelect(ref.id)

    // Refresh artists table (if visible)
    await renderArtistsTable()

    // If user was in the middle of uploading a track, restore their draft inputs
    if (window.__audioUploadDraft) {
      restoreAudioUploadDraft(window.__audioUploadDraft)
      window.__audioUploadDraft = null
    }

    closeAddArtistModal()
    form.reset()
    setArtistImagePreview(null)
  } catch (err) {
    console.error(err)
    alert('Failed to save artist. Check console for details.')
  }
}

function safeFileExt(filename) {
  const parts = String(filename || '').split('.')
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
  return ext.replace(/[^a-z0-9]/g, '')
}

async function uploadFileToStorage(path, file) {
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

async function handleAudioUploadSubmit(e) {
  e.preventDefault()

  const form = e.currentTarget
  const fd = new FormData(form)

  const title = String(fd.get('trackTitle') || '').trim()
  const artistId = String(fd.get('trackArtist') || '').trim()
  const genre = normalizeGenre(fd.get('trackGenre'))
  const releaseDate = String(fd.get('releaseDate') || '').trim()
  const duration = String(fd.get('trackDuration') || '').trim()
  const description = String(fd.get('trackDescription') || '').trim()

  const audioFile = /** @type {File|null} */ (fd.get('audioFile'))
  const artworkFile = /** @type {File|null} */ (fd.get('trackArtwork'))

  const spotifyArtworkUrl = document.getElementById('spotifyArtworkUrl')?.value || ''

  if (!title || !artistId || artistId === '__add_new__' || !genre) {
    alert('Please fill in Track Title, Artist and Genre.')
    return
  }

  if (!audioFile || !(audioFile instanceof File) || audioFile.size === 0) {
    alert('Please choose an audio file.')
    return
  }

  const now = Date.now()
  const audioExt = safeFileExt(audioFile.name) || 'mp3'
  const artworkExt = artworkFile && artworkFile instanceof File ? safeFileExt(artworkFile.name) : ''

  try {
    const artistName = await resolveArtistName(artistId)

    // Upload audio
    const audioPath = `audio/${artistId}/${now}.${audioExt}`
    const audioUrl = await uploadFileToStorage(audioPath, audioFile)

    // Handle artwork - either upload file or use Spotify URL
    let artworkUrl = ''
    if (spotifyArtworkUrl && spotifyArtworkUrl.startsWith('http')) {
      // Use the Spotify artwork URL
      artworkUrl = spotifyArtworkUrl
    } else if (artworkFile && artworkFile instanceof File && artworkFile.size > 0) {
      // Upload the artwork file
      const artPath = `artwork/${artistId}/${now}.${artworkExt || 'jpg'}`
      artworkUrl = await uploadFileToStorage(artPath, artworkFile)
    }

    // Create Firestore doc (this automatically creates the collection if missing)
    await addDoc(collection(db, 'tracks'), {
      title,
      artist: artistId,
      artistName,
      genre,
      duration,
      streams: 0,
      likes: 0,
      downloads: 0,
      status: 'published',
      artwork: artworkUrl,
      audioUrl,
      releaseDate: releaseDate || '',
      description,
      platformLinks: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    alert('Track uploaded to Firebase successfully!')
    form.reset()

    // Clear Spotify artwork URL
    const spotifyArtworkInput = document.getElementById('spotifyArtworkUrl')
    if (spotifyArtworkInput) spotifyArtworkInput.value = ''

    // Clear artwork preview
    const artworkPreview = document.getElementById('artworkPreview')
    if (artworkPreview) {
      artworkPreview.classList.remove('has-image')
      artworkPreview.style.backgroundImage = ''
    }
  } catch (err) {
    console.error(err)
    alert('Upload failed. Check console for details.')
  }
}

// Helper function to save track data to Firestore (used by Spotify import)
async function saveTrackToFirestore(trackData) {
  try {
    await addDoc(collection(db, 'tracks'), {
      ...trackData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('[admin-firebase] Track saved to Firestore:', trackData.title);
    return true;
  } catch (error) {
    console.error('[admin-firebase] Error saving track to Firestore:', error);
    throw error;
  }
}

// Make the function available globally for admin.js
window.saveTrackToFirestore = saveTrackToFirestore;
window.fetchArtists = fetchArtists;
window.fetchTracks = fetchTracks;
window.fetchPayments = fetchPayments;

function initAdminFirebase() {
  console.log('[admin-firebase] init')
  try {
    const bucket = (storage && storage.app && storage.app.options && storage.app.options.storageBucket) || ''
    if (bucket) console.log('[admin-firebase] storageBucket:', bucket)
  } catch (_) {
    // ignore
  }
  const audioUploadForm = document.getElementById('audioUploadForm')
  if (audioUploadForm) {
    audioUploadForm.addEventListener('submit', handleAudioUploadSubmit)
  }

  // Populate dropdown from Firestore
  populateArtistSelect().catch(console.error)

  // Re-populate when navigating to Music Management (prevents other scripts from removing __add_new__)
  document.querySelector('[data-target="music-management"]')?.addEventListener('click', () => {
    schedulePopulateArtistSelect()
  })
  document.getElementById('addTrackBtn')?.addEventListener('click', () => {
    schedulePopulateArtistSelect()
  })

  // Observe the select; if any script overwrites it, restore base options.
  const trackArtistSelect = document.getElementById('trackArtist')
  if (trackArtistSelect && 'MutationObserver' in window) {
    const mo = new MutationObserver(() => {
      // This is cheap (only checks presence); if missing, repopulate from Firestore.
      const hasAddNew = Array.from(trackArtistSelect.options).some((o) => o.value === '__add_new__')
      if (!hasAddNew) schedulePopulateArtistSelect()
    })
    mo.observe(trackArtistSelect, { childList: true })
  }

  // Populate artists table from Firestore
  renderArtistsTable().catch(console.error)

  // Add-artist modal wiring
  document.getElementById('addArtistBtn')?.addEventListener('click', openAddArtistModal)

  // Image preview
  const artistImageInput = document.getElementById('artistImage')
  if (artistImageInput) {
    artistImageInput.addEventListener('change', () => {
      const f = artistImageInput.files && artistImageInput.files[0]
      setArtistImagePreview(f || null)
    })
  }

  const select = document.getElementById('trackArtist')
  if (select) {
    select.addEventListener('change', () => {
      if (select.value === '__add_new__') {
        // Save current form draft so user can continue after adding the artist
        window.__audioUploadDraft = captureAudioUploadDraft()

        const audioInput = document.getElementById('audioFile')
        const artworkInput = document.getElementById('trackArtwork')
        const hasAudio = audioInput && audioInput.files && audioInput.files.length > 0
        const hasArtwork = artworkInput && artworkInput.files && artworkInput.files.length > 0

        if (hasAudio || hasArtwork) {
          const ok = confirm('You have selected audio/artwork files. If you add a new artist now, you may need to re-select those files afterwards. Continue?')
          if (!ok) {
            select.value = ''
            return
          }
        }

        openAddArtistModal()
      }
    })
  }

  document.getElementById('closeAddArtistModal')?.addEventListener('click', closeAddArtistModal)
  document.getElementById('cancelAddArtist')?.addEventListener('click', closeAddArtistModal)

  const modal = document.getElementById('addArtistModal')
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAddArtistModal()
    })
  }

  const addArtistForm = document.getElementById('addArtistForm')
  if (addArtistForm) {
    addArtistForm.addEventListener('submit', handleAddArtistSubmit)
  } else {
    console.error('[admin-firebase] addArtistForm not found; Save Artist will not work')
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAdminFirebase()
})
