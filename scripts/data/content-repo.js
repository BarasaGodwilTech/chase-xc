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
  const tracksRef = collection(db, 'tracks')
  const q = query(tracksRef, where('status', '==', 'published'), orderBy('releaseDate', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function fetchArtists() {
  const artistsRef = collection(db, 'artists')
  const snap = await getDocs(artistsRef)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function fetchArtistById(artistId) {
  const ref = doc(db, 'artists', artistId)
  const snap = await getDoc(ref)
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}
