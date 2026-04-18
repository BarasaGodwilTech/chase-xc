import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'

import { db } from '../firebase-init.js'

export async function fetchPublishedTracks() {
  console.log('[ContentRepo] Fetching published tracks...')
  try {
    const tracksRef = collection(db, 'tracks')
    const q = query(tracksRef, where('status', '==', 'published'), orderBy('releaseDate', 'desc'))
    const snap = await getDocs(q)
    const tracks = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    console.log('[ContentRepo] Fetched', tracks.length, 'published tracks')
    return tracks
  } catch (error) {
    console.error('[ContentRepo] Error fetching published tracks:', error)
    throw error
  }
}

export async function fetchArtists() {
  console.log('[ContentRepo] Fetching all artists...')
  try {
    const artistsRef = collection(db, 'artists')
    const snap = await getDocs(artistsRef)
    const artists = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    console.log('[ContentRepo] Fetched', artists.length, 'artists')
    return artists
  } catch (error) {
    console.error('[ContentRepo] Error fetching artists:', error)
    throw error
  }
}

export async function fetchArtistById(artistId) {
  console.log('[ContentRepo] Fetching artist by ID:', artistId)
  try {
    const ref = doc(db, 'artists', artistId)
    const snap = await getDoc(ref)
    const artist = snap.exists() ? { id: snap.id, ...snap.data() } : null
    console.log('[ContentRepo] Artist found:', !!artist)
    return artist
  } catch (error) {
    console.error('[ContentRepo] Error fetching artist by ID:', error)
    throw error
  }
}
