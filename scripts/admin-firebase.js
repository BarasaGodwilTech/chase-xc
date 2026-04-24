import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  updateDoc,
  doc,
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

async function getTrackById(trackId) {
  if (!trackId) return null
  const trackRef = doc(db, 'tracks', trackId)
  const trackSnap = await getDoc(trackRef)
  if (!trackSnap.exists()) return null
  return { id: trackSnap.id, ...trackSnap.data() }
}

async function updateTrackInFirestore(trackId, trackData) {
  if (!trackId) throw new Error('Missing trackId')
  const trackRef = doc(db, 'tracks', trackId)
  await updateDoc(trackRef, {
    ...trackData,
    updatedAt: serverTimestamp(),
  })
  return true
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
          <tr data-artist-id="${a.id}" data-artist-name="${name.replace(/'/g, "\\'")}">
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
                <button class="btn btn-secondary btn-sm edit-artist-btn" type="button" title="Edit">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-sm delete-artist-btn" type="button" title="Delete">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `
      })
      .join('')

    // Add event delegation for edit and delete buttons (bind once)
    if (!tbody.dataset.clickBound) {
      tbody.dataset.clickBound = 'true'
      tbody.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-artist-btn')
        const deleteBtn = e.target.closest('.delete-artist-btn')

        if (editBtn) {
          const row = editBtn.closest('tr')
          const artistId = row?.dataset?.artistId
          if (artistId) {
            console.log('[admin-firebase] Edit button clicked for artist ID:', artistId)
            if (window.adminPanel && typeof window.adminPanel.editArtist === 'function') {
              await window.adminPanel.editArtist(artistId)
            } else {
              await window.editArtist(artistId)
            }
          }
        }

        if (deleteBtn) {
          const row = deleteBtn.closest('tr')
          const artistId = row?.dataset?.artistId
          const artistName = row?.dataset?.artistName || 'Unknown'
          if (artistId) {
            console.log('[admin-firebase] Delete button clicked for artist ID:', artistId, 'name:', artistName)
            await window.deleteArtist(artistId, artistName)
          }
        }
      })
    }
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

let editingArtistId = null

function openAddArtistModal() {
  const formContainer = document.getElementById('artistManagementForm')
  if (!formContainer) return
  editingArtistId = null
  
  // Reset form for add mode
  const form = document.getElementById('artistForm')
  if (form) {
    form.reset()
    setArtistImagePreview(null)
  }
  
  // Update form title
  const formTitle = document.getElementById('artistFormTitle')
  if (formTitle) {
    formTitle.textContent = 'Add New Artist'
  }
  
  formContainer.style.display = ''
  formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function closeAddArtistForm() {
  const formContainer = document.getElementById('artistManagementForm')
  if (formContainer) formContainer.style.display = 'none'
  const form = document.getElementById('artistForm')
  if (form) form.reset()
  setArtistImagePreview(null)
  editingArtistId = null
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
    preview.classList.remove('has-image')
    preview.style.backgroundImage = ''
    return
  }

  const url = URL.createObjectURL(file)
  preview.style.backgroundImage = `url('${url}')`
  preview.classList.add('has-image')
}

function captureAudioUploadDraft() {
  const form = document.getElementById('audioUploadForm')
  if (!form) return null
  const fd = new FormData(form)

  const artworkFile = /** @type {File|null} */ (fd.get('trackArtwork'))

  return {
    trackTitle: String(fd.get('trackTitle') || ''),
    trackGenre: String(fd.get('trackGenre') || ''),
    releaseDate: String(fd.get('releaseDate') || ''),
    trackDuration: String(fd.get('trackDuration') || ''),
    trackDescription: String(fd.get('trackDescription') || ''),
    audioUrl: String(fd.get('audioUrl') || ''),
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
  setValue('audioUrl', draft.audioUrl)

  // File inputs cannot be programmatically set for security reasons.
  // We keep draft.audioFile/artworkFile only as a hint for future enhancement.
}

async function handleAddArtistSubmit(e) {
  e.preventDefault()
  console.log('[admin-firebase] Add/Edit artist submit')
  const form = e.currentTarget
  const fd = new FormData(form)

  const name = String(fd.get('artistName') || '').trim()
  const genre = String(fd.get('artistGenre') || '').trim()
  const bio = String(fd.get('artistBio') || '').trim()
  const imageFile = /** @type {File|null} */ (fd.get('artistImage'))

  if (!name) {
    if (window.notifications) {
      window.notifications.show('Artist name is required', 'error')
    } else {
      console.error('Artist name is required')
    }
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
          'Artist image upload failed. This usually means cloud storage is not enabled or storage rules block uploads.\n\n' +
          'I can still save the artist WITHOUT an image. Continue?'

        let ok = false
        if (window.notifications && window.notifications.confirm) {
          ok = await window.notifications.confirm(msg, 'Continue Without Image?', 'warning')
        } else {
          ok = confirm(msg)
        }
        if (!ok) return
        imageUrl = ''
      }
    }

    const artistData = {
      name,
      genre,
      bio,
      image: imageUrl,
      status: 'active',
      updatedAt: serverTimestamp(),
    }

    if (editingArtistId) {
      // Update existing artist
      // Keep existing image if no new image uploaded
      if (!imageUrl) {
        const existingArtist = await getArtistById(editingArtistId)
        if (existingArtist && existingArtist.image) {
          artistData.image = existingArtist.image
        }
      }
      await updateArtistInFirestore(editingArtistId, artistData)
      
      if (window.notifications) {
        window.notifications.show('Artist updated successfully', 'success')
      }
    } else {
      // Create new artist
      artistData.createdAt = serverTimestamp()
      const ref = await addDoc(collection(db, 'artists'), artistData)
      
      // Refresh caches + selects
      artistCache = null
      await populateArtistSelect(ref.id)
      
      if (window.notifications) {
        window.notifications.show('Artist added successfully', 'success')
      }
    }

    // Refresh artists table (if visible)
    await renderArtistsTable()

    // If user was in the middle of uploading a track, restore their draft inputs
    if (window.__audioUploadDraft) {
      restoreAudioUploadDraft(window.__audioUploadDraft)
      window.__audioUploadDraft = null
    }

    closeAddArtistForm()
    form.reset()
    setArtistImagePreview(null)
    editingArtistId = null
  } catch (err) {
    console.error(err)
    alert('Failed to save artist. Please try again.')
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
  const rawAudioUrlInput = String(fd.get('audioUrl') || '').trim()
  const audioUrlInput = rawAudioUrlInput && !/^https?:\/\//i.test(rawAudioUrlInput) ? `https://${rawAudioUrlInput}` : rawAudioUrlInput

  const artworkFile = /** @type {File|null} */ (fd.get('trackArtwork'))

  const spotifyArtworkUrl = document.getElementById('spotifyArtworkUrl')?.value || ''

  const editingItem = window.adminPanel && window.adminPanel.editingItem
  const isEdit = Boolean(editingItem && editingItem.type === 'track' && editingItem.id)
  const existingTrack = isEdit ? (editingItem.data || null) : null

  if (!title || !artistId || artistId === '__add_new__' || !genre) {
    if (window.notifications) {
      window.notifications.show('Please fill in Track Title, Artist and Genre.', 'error')
    } else {
      console.error('Please fill in Track Title, Artist and Genre.')
    }
    return
  }

  // Links-only workflow: require an audio link on create; allow keeping existing link on edit.
  if (!isEdit && !audioUrlInput) {
    if (window.notifications) {
      window.notifications.show('Please provide an audio link (URL).', 'error')
    } else {
      console.error('Please provide an audio link (URL).')
    }
    return
  }

  // Determine the actual URL that will be saved.
  const effectiveAudioUrlForSave = audioUrlInput || existingTrack?.audioUrl || ''

  // Ask for confirmation if the current audio link hasn't been tested in this session.
  if (effectiveAudioUrlForSave && window.__lastTestedAudioUrl !== effectiveAudioUrlForSave) {
    const msg = 'You have not tested the current audio link in this session. Use the inline preview below the field (recommended) or continue anyway?'
    let ok = false
    if (window.notifications && window.notifications.confirm) {
      ok = await window.notifications.confirm(msg, 'Link Not Tested', 'warning')
    } else {
      ok = confirm(msg)
    }
    if (!ok) return
  }

  const now = Date.now()
  const artworkExt = artworkFile && artworkFile instanceof File ? safeFileExt(artworkFile.name) : ''

  try {
    const artistName = await resolveArtistName(artistId)

    // Links-only: use input if provided, otherwise keep existing.
    const audioUrl = effectiveAudioUrlForSave

    // Handle artwork - either upload file or use Spotify URL
    let artworkUrl = existingTrack?.artwork || ''
    if (spotifyArtworkUrl && spotifyArtworkUrl.startsWith('http')) {
      // Use the Spotify artwork URL
      artworkUrl = spotifyArtworkUrl
    } else if (artworkFile && artworkFile instanceof File && artworkFile.size > 0) {
      // Upload the artwork file
      const artPath = `artwork/${artistId}/${now}.${artworkExt || 'jpg'}`
      artworkUrl = await uploadFileToStorage(artPath, artworkFile)
    }

    const payload = {
      title,
      artist: artistId,
      artistName,
      genre,
      duration,
      artwork: artworkUrl,
      audioUrl,
      releaseDate: releaseDate || '',
      description,
      status: existingTrack?.status || 'published',
      platformLinks: existingTrack?.platformLinks || {},
    }

    if (isEdit) {
      await updateTrackInFirestore(editingItem.id, payload)
    } else {
      await addDoc(collection(db, 'tracks'), {
        ...payload,
        streams: 0,
        likes: 0,
        downloads: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    if (window.notifications) {
      window.notifications.show(isEdit ? 'Track updated successfully' : 'Track uploaded successfully', 'success')
    } else {
      console.log(isEdit ? 'Track updated successfully' : 'Track uploaded successfully')
    }
    form.reset()

    if (isEdit && window.adminPanel) {
      window.adminPanel.editingItem = null
    }

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
    if (window.notifications) {
      window.notifications.show('Upload failed. Please try again.', 'error')
    } else {
      console.error('Upload failed. Please try again.')
    }
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

// Delete artist from Firestore
async function deleteArtistFromFirestore(artistId) {
  try {
    await deleteDoc(doc(db, 'artists', artistId));
    console.log('[admin-firebase] Artist deleted:', artistId);
    return true;
  } catch (error) {
    console.error('[admin-firebase] Error deleting artist:', error);
    throw error;
  }
}

// Update artist in Firestore
async function updateArtistInFirestore(artistId, artistData) {
  try {
    const artistRef = doc(db, 'artists', artistId);
    await updateDoc(artistRef, {
      ...artistData,
      updatedAt: serverTimestamp()
    });
    console.log('[admin-firebase] Artist updated:', artistId);
    return true;
  } catch (error) {
    console.error('[admin-firebase] Error updating artist:', error);
    throw error;
  }
}

// Get artist by ID
async function getArtistById(artistId) {
  try {
    const artistRef = doc(db, 'artists', artistId);
    const artistSnap = await getDoc(artistRef);
    if (artistSnap.exists()) {
      return { id: artistSnap.id, ...artistSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('[admin-firebase] Error fetching artist:', error);
    throw error;
  }
}

// Global function to edit artist
window.editArtist = async function(artistId) {
  console.log('[admin-firebase] editArtist called with ID:', artistId);
  try {
    const artist = await getArtistById(artistId);
    console.log('[admin-firebase] Retrieved artist:', artist);
    if (!artist) {
      console.error('[admin-firebase] Artist not found:', artistId);
      if (window.notifications) {
        window.notifications.show('Artist not found', 'error');
      }
      return;
    }

    editingArtistId = artistId;
    
    // Populate form with artist data
    const form = document.getElementById('artistForm');
    if (form) {
      document.getElementById('artistName').value = artist.name || '';
      document.getElementById('artistGenre').value = artist.genre || '';
      document.getElementById('artistStatus').value = artist.status || 'active';
      document.getElementById('artistBio').value = artist.bio || '';
      
      // Show existing image preview
      if (artist.image) {
        const preview = document.getElementById('artistImagePreview');
        if (preview) {
          preview.style.backgroundImage = `url('${artist.image}')`;
          preview.classList.add('has-image');
          preview.querySelector('i')?.remove();
          preview.querySelector('span')?.remove();
        }
      }
    }

    // Update form title
    const formTitle = document.getElementById('artistFormTitle');
    if (formTitle) {
      formTitle.textContent = 'Edit Artist';
    }

    // Show inline form
    const formContainer = document.getElementById('artistManagementForm');
    if (formContainer) {
      formContainer.style.display = '';
      formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (error) {
    console.error('[admin-firebase] Error opening edit artist:', error);
    if (window.notifications) {
      window.notifications.show('Failed to load artist data', 'error');
    }
  }
};

// Global function to delete artist
window.deleteArtist = async function(artistId, artistName) {
  console.log('[admin-firebase] deleteArtist called with ID:', artistId, 'name:', artistName);
  const confirmMsg = `Are you sure you want to delete "${artistName}"? This action cannot be undone.`;
  
  let confirmed = false;
  if (window.notifications && window.notifications.confirm) {
    confirmed = await window.notifications.confirm(confirmMsg, 'Confirm Delete', 'warning');
  } else {
    confirmed = confirm(confirmMsg);
  }
  
  if (!confirmed) return;

  try {
    await deleteArtistFromFirestore(artistId);
    
    // Refresh caches
    artistCache = null;
    
    // Refresh artists table
    await renderArtistsTable();
    
    // Refresh artist select dropdown
    await populateArtistSelect();
    
    if (window.notifications) {
      window.notifications.show('Artist deleted successfully!', 'success');
    } else {
      console.log('[admin-firebase] Artist deleted successfully');
    }
  } catch (error) {
    console.error('[admin-firebase] Error deleting artist:', error);
    if (window.notifications) {
      const msg = error?.message ? String(error.message) : String(error);
      const code = error?.code ? String(error.code) : '';
      window.notifications.show(`Failed to delete artist${code ? ` (${code})` : ''}: ${msg}`, 'error');
    } else {
      alert(error?.message ? String(error.message) : 'Failed to delete artist. Please try again.');
    }
  }
};

// Delete track from Firestore
async function deleteTrackFromFirestore(trackId) {
  try {
    await deleteDoc(doc(db, 'tracks', trackId));
    console.log('[admin-firebase] Track deleted:', trackId);
    return true;
  } catch (error) {
    console.error('[admin-firebase] Error deleting track:', error);
    if (window.notifications) {
      const msg = error?.message ? String(error.message) : String(error);
      const code = error?.code ? String(error.code) : '';
      window.notifications.show(`Failed to delete track${code ? ` (${code})` : ''}: ${msg}`, 'error');
    } else {
      alert(error?.message ? String(error.message) : 'Failed to delete track. Please try again.');
    }
    throw error;
  }
}

// Make the function available globally for admin.js
window.saveTrackToFirestore = saveTrackToFirestore;
window.updateTrackInFirestore = updateTrackInFirestore;
window.getTrackById = getTrackById;
window.fetchArtists = fetchArtists;
window.fetchTracks = fetchTracks;
window.fetchPayments = fetchPayments;
window.deleteArtistFromFirestore = deleteArtistFromFirestore;
window.deleteTrackFromFirestore = deleteTrackFromFirestore;
window.updateArtistInFirestore = updateArtistInFirestore;
window.getArtistById = getArtistById;
window.renderArtistsTable = renderArtistsTable;

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
  const artistImageInput = document.getElementById('artistImageInput')
  if (artistImageInput) {
    artistImageInput.addEventListener('change', () => {
      const f = artistImageInput.files && artistImageInput.files[0]
      setArtistImagePreview(f || null)
    })
  }

  // Inline audio/link preview for the admin panel
  const audioUrlInput = document.getElementById('audioUrl')
  if (audioUrlInput && !audioUrlInput.dataset.previewBound) {
    audioUrlInput.dataset.previewBound = 'true'

    const updatePreview = () => {
      const raw = String(audioUrlInput.value || '').trim()
      const url = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw
      const inline = document.getElementById('audioUrlInlinePreview')

      if (!inline) return

      inline.innerHTML = ''

      if (!url) {
        return
      }

      // Basic URL validation
      let parsed = null
      try {
        parsed = new URL(url)
      } catch {
        const note = document.createElement('div')
        note.className = 'audio-inline-note'
        note.textContent = 'Invalid link format. Please paste a full URL.'
        inline.appendChild(note)
        return
      }

      const host = parsed.hostname.replace(/^www\./, '')
      const path = parsed.pathname || ''
      const lower = url.toLowerCase()

      // Direct audio files
      if (lower.match(/\.(mp3|wav|ogg|m4a)(\?.*)?$/)) {
        const audio = document.createElement('audio')
        audio.controls = true
        audio.preload = 'none'
        audio.src = url
        inline.appendChild(audio)
        // Mark as tested when playback starts
        audio.addEventListener('play', () => {
          window.__lastTestedAudioUrl = url
        })
        return
      }

      // YouTube (including YouTube Music)
      if (
        host === 'youtube.com' ||
        host === 'm.youtube.com' ||
        host === 'music.youtube.com' ||
        host === 'youtu.be'
      ) {
        let videoId = ''
        if (host === 'youtu.be') {
          videoId = path.split('/').filter(Boolean)[0] || ''
        } else {
          videoId = parsed.searchParams.get('v') || ''
        }
        if (videoId) {
          const iframe = document.createElement('iframe')
          iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`
          iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
          iframe.allowFullscreen = true
          inline.appendChild(iframe)
          // Admin “tested” intent when preview is visible
          window.__lastTestedAudioUrl = url
          return
        }
      }

      // SoundCloud (basic embed)
      if (host === 'soundcloud.com' || host === 'm.soundcloud.com' || host === 'on.soundcloud.com') {
        const iframe = document.createElement('iframe')
        iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&visual=true`
        iframe.allow = 'autoplay'
        inline.appendChild(iframe)
        window.__lastTestedAudioUrl = url
        return
      }

      // Spotify
      if (host === 'open.spotify.com') {
        const parts = path.split('/').filter(Boolean)
        const type = parts[0]
        const id = parts[1]
        if (type && id) {
          const iframe = document.createElement('iframe')
          iframe.src = `https://open.spotify.com/embed/${encodeURIComponent(type)}/${encodeURIComponent(id)}`
          iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'
          inline.appendChild(iframe)
          window.__lastTestedAudioUrl = url
          return
        }
      }

      // Apple Music (best-effort embed)
      if (host === 'music.apple.com' || host === 'itunes.apple.com') {
        const embedUrl = url.replace(/^https:\/\/music\.apple\.com\//i, 'https://embed.music.apple.com/')
        const iframe = document.createElement('iframe')
        iframe.src = embedUrl
        iframe.allow = 'autoplay *; encrypted-media *; fullscreen *; clipboard-write'
        inline.appendChild(iframe)
        window.__lastTestedAudioUrl = url
        return
      }

      // Fallback: attempt a best-effort inline embed for unknown links.
      // If the platform forbids embedding (X-Frame-Options/CSP), the iframe will appear blank.
      const iframe = document.createElement('iframe')
      iframe.src = url
      iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups'
      iframe.referrerPolicy = 'no-referrer'
      inline.appendChild(iframe)
      window.__lastTestedAudioUrl = url

      const note = document.createElement('div')
      note.className = 'audio-inline-note'
      note.textContent = 'If the player area above is blank, this platform blocks embedding. Try a different link (e.g., an official embed/share link) or a direct audio file URL.'
      inline.appendChild(note)
    }

    audioUrlInput.addEventListener('input', updatePreview)
    audioUrlInput.addEventListener('paste', () => setTimeout(updatePreview, 50))
    // Initial render if form is prefilled (edit mode)
    setTimeout(updatePreview, 0)
  }

  // Global delegated delete handling (covers both admin.js and admin-firebase rendered tables)
  if (!window.__adminDeleteDelegationBound) {
    window.__adminDeleteDelegationBound = true
    document.addEventListener(
      'click',
      async (e) => {
        const artistDel = e.target.closest('.js-delete-artist, .delete-artist-btn')
        const trackDel = e.target.closest('.js-delete-track, .delete-track-btn')

        if (!artistDel && !trackDel) return

        // Prevent duplicate handlers from firing in other scripts
        e.preventDefault()
        e.stopPropagation()

        try {
          if (artistDel) {
            const artistId = artistDel.dataset?.artistId || artistDel.closest('tr')?.dataset?.artistId
            const artistName = artistDel.closest('tr')?.dataset?.artistName || 'Unknown'
            console.log('[admin-firebase] Delegated artist delete click:', artistId)
            if (!artistId) {
              if (window.notifications) window.notifications.show('Delete failed: missing artist id', 'error')
            } else {
              await window.deleteArtist(artistId, artistName)
            }
          }

          if (trackDel) {
            const trackId = trackDel.dataset?.trackId || trackDel.closest('tr')?.dataset?.trackId
            console.log('[admin-firebase] Delegated track delete click:', trackId)
            if (!trackId) {
              if (window.notifications) window.notifications.show('Delete failed: missing track id', 'error')
              return
            }

            let ok = false
            if (window.notifications && window.notifications.confirm) {
              ok = await window.notifications.confirm('Are you sure you want to delete this track?', 'Delete Track', 'warning')
            } else {
              ok = confirm('Are you sure you want to delete this track?')
            }
            if (!ok) return

            await deleteTrackFromFirestore(trackId)

            if (typeof window.adminPanel?.loadTracks === 'function') {
              await window.adminPanel.loadTracks()
            }

            if (window.notifications) {
              window.notifications.show('Track deleted successfully!', 'success')
            }
          }
        } catch (err) {
          console.error('[admin-firebase] Delegated delete failed:', err)
          if (window.notifications) {
            const msg = err?.message ? String(err.message) : String(err)
            const code = err?.code ? String(err.code) : ''
            window.notifications.show(`Delete failed${code ? ` (${code})` : ''}: ${msg}`, 'error')
          }
        }
      },
      true
    )
  }

  const select = document.getElementById('trackArtist')
  if (select) {
    select.addEventListener('change', async () => {
      if (select.value === '__add_new__') {
        // Save current form draft so user can continue after adding the artist
        window.__audioUploadDraft = captureAudioUploadDraft()
        const artworkInput = document.getElementById('trackArtwork')
        const hasArtwork = artworkInput && artworkInput.files && artworkInput.files.length > 0

        if (hasArtwork) {
          let ok = false
          if (window.notifications && window.notifications.confirm) {
            ok = await window.notifications.confirm('You have selected an artwork file. If you add a new artist now, you may need to re-select that file afterwards. Continue?', 'Confirm Action', 'warning')
          } else {
            ok = confirm('You have selected an artwork file. If you add a new artist now, you may need to re-select that file afterwards. Continue?')
          }
          if (!ok) {
            select.value = ''
            return
          }
        }

        openAddArtistModal()
      }
    })
  }

  document.getElementById('closeArtistForm')?.addEventListener('click', closeAddArtistForm)
  document.getElementById('cancelArtistForm')?.addEventListener('click', closeAddArtistForm)

  const artistForm = document.getElementById('artistForm')
  if (artistForm) {
    artistForm.addEventListener('submit', handleAddArtistSubmit)
  } else {
    console.warn('[admin-firebase] artistForm not found; inline artist save will not work')
  }

  window.dispatchEvent(new Event('adminFirebaseReady'))
}

document.addEventListener('DOMContentLoaded', () => {
  initAdminFirebase()
})
