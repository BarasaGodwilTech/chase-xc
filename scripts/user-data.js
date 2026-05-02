import { db, functions } from './firebase-init.js'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'

import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js'

function userDocRef(uid) {
  return doc(db, 'users', uid)
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

// Track stats functions for likes and streams
function trackDocRef(trackId) {
  return doc(db, 'tracks', trackId)
}

export async function incrementTrackLikes(trackId, delta = 1) {
  if (!trackId) return
  const ref = trackDocRef(trackId)
  await updateDoc(ref, {
    likes: increment(delta)
  })
}

export async function incrementTrackStreams(trackId, delta = 1, { eventId } = {}) {
  if (!trackId) return
  const trimmedEventId = String(eventId || '').trim()

  // Prefer callable function (bypasses Firestore rules, allows server-side dedup/rate limits).
  if (trimmedEventId) {
    try {
      const call = httpsCallable(functions, 'incrementTrackStreams')
      await call({ trackId, delta, eventId: trimmedEventId })
      return
    } catch (e) {
      // Fall through to single fallback below
    }
  }

  // Fallback to direct update (may be blocked by Firestore rules in prod).
  try {
    const ref = trackDocRef(trackId)
    await updateDoc(ref, {
      streams: increment(delta)
    })
  } catch (inner) {
    console.error('[user-data] incrementTrackStreams failed:', inner)
    throw inner
  }
}

export async function ensureUserProfileDoc(user) {
  if (!user?.uid) return null

  const ref = userDocRef(user.uid)
  const snap = await getDoc(ref)

  if (snap.exists()) return { ref, data: snap.data() }

  const base = {
    uid: user.uid,
    displayName: user.displayName || 'User',
    email: user.email || '',
    phone: '',
    location: '',
    bio: '',
    memberSince: user.metadata?.creationTime || new Date().toISOString(),
    stats: {
      tracksListened: 0,
      favorites: 0,
      totalListeningTime: 0
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }

  await setDoc(ref, base)

  await seedDefaultNotifications(user.uid)

  const createdSnap = await getDoc(ref)
  return { ref, data: createdSnap.data() }
}

export async function updateUserProfile(uid, patch) {
  if (!uid) return
  await updateDoc(userDocRef(uid), {
    ...patch,
    updatedAt: serverTimestamp()
  })
}

export async function seedDefaultNotifications(uid) {
  if (!uid) return

  const col = collection(db, 'users', uid, 'notifications')
  const existing = await getDocs(query(col, limit(1)))
  if (!existing.empty) return

  const batch = writeBatch(db)

  const now = Date.now()
  const items = [
    {
      type: 'welcome',
      message: 'Welcome to Chase x Records. Your profile is ready.',
      createdAt: new Date(now),
      read: false
    },
    {
      type: 'tip',
      message: 'Tip: Play tracks to build your listening history and top tracks.',
      createdAt: new Date(now - 60 * 60 * 1000),
      read: false
    }
  ]

  items.forEach((item) => {
    const ref = doc(col)
    batch.set(ref, {
      ...item,
      createdAt: item.createdAt,
      serverCreatedAt: serverTimestamp()
    })
  })

  await batch.commit()
}

function favoriteDocRef(uid, trackId) {
  return doc(db, 'users', uid, 'favorites', trackId)
}

export async function isFavorite(uid, trackId) {
  if (!uid || !trackId) return false
  const snap = await getDoc(favoriteDocRef(uid, trackId))
  return snap.exists()
}

export async function getFavorites(uid, max = 100) {
  if (!uid) return []
  const col = collection(db, 'users', uid, 'favorites')
  const q = query(col, orderBy('updatedAt', 'desc'), limit(max))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function toggleFavorite(uid, track, { force } = {}) {
  if (!uid || !track?.id) return { liked: false }

  const ref = favoriteDocRef(uid, track.id)
  const snap = await getDoc(ref)
  const currentlyLiked = snap.exists()

  const shouldLike = typeof force === 'boolean' ? force : !currentlyLiked

  if (shouldLike) {
    await setDoc(ref, {
      trackId: track.id,
      title: track.title || '',
      artistName: track.artistName || track.artist || '',
      artwork: track.artwork || track.cover || '',
      audioUrl: track.audioUrl || null,
      platformLinks: track.platformLinks || {},
      createdAt: snap.exists() ? snap.data()?.createdAt || serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true })
    await incrementUserStats(uid, { favoritesDelta: currentlyLiked ? 0 : 1 })
    
    // Increment track likes count in tracks collection
    if (!currentlyLiked) {
      await incrementTrackLikes(track.id, 1)
    }
    
    return { liked: true }
  }

  if (currentlyLiked) {
    await deleteDoc(ref)
    await incrementUserStats(uid, { favoritesDelta: -1 })
    
    // Decrement track likes count in tracks collection
    await incrementTrackLikes(track.id, -1)
  }
  return { liked: false }
}

function playlistsColRef(uid) {
  return collection(db, 'users', uid, 'playlists')
}

function playlistDocRef(uid, playlistId) {
  return doc(db, 'users', uid, 'playlists', playlistId)
}

export async function createPlaylist(uid, name) {
  if (!uid) return null
  const trimmed = (name || '').trim()
  if (!trimmed) return null

  const ref = doc(playlistsColRef(uid))
  await setDoc(ref, {
    name: trimmed,
    tracks: [],
    trackCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return ref.id
}

export async function getPlaylists(uid, max = 50) {
  if (!uid) return []
  const q = query(playlistsColRef(uid), orderBy('updatedAt', 'desc'), limit(max))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addTrackToPlaylist(uid, playlistId, track) {
  if (!uid || !playlistId || !track?.id) return
  const ref = playlistDocRef(uid, playlistId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return

  const data = snap.data() || {}
  const existing = Array.isArray(data.tracks) ? data.tracks : []
  const already = existing.includes(track.id)

  await updateDoc(ref, {
    tracks: arrayUnion(track.id),
    trackCount: already ? safeNumber(data.trackCount) : safeNumber(data.trackCount) + 1,
    updatedAt: serverTimestamp()
  })
}

export async function removeTrackFromPlaylist(uid, playlistId, trackId) {
  if (!uid || !playlistId || !trackId) return
  const ref = playlistDocRef(uid, playlistId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return

  const data = snap.data() || {}
  const existing = Array.isArray(data.tracks) ? data.tracks : []
  const had = existing.includes(trackId)

  await updateDoc(ref, {
    tracks: arrayRemove(trackId),
    trackCount: had ? Math.max(0, safeNumber(data.trackCount) - 1) : safeNumber(data.trackCount),
    updatedAt: serverTimestamp()
  })
}

export async function logListeningEvent(uid, track, meta = {}) {
  if (!uid || !track?.id) return

  const eventsCol = collection(db, 'users', uid, 'listeningEvents')

  const payload = {
    trackId: track.id,
    title: track.title || '',
    artistName: track.artistName || track.artist || '',
    artwork: track.artwork || track.cover || '',
    platform: meta.platform || null,
    startedAt: serverTimestamp(),
    clientStartedAt: new Date(),
    sourcePage: window.location.pathname
  }

  await addDoc(eventsCol, payload)

  await incrementUserStats(uid, {
    tracksListenedDelta: 1
  })
}

export async function incrementUserStats(uid, { tracksListenedDelta = 0, favoritesDelta = 0, listeningMinutesDelta = 0 } = {}) {
  if (!uid) return

  const ref = userDocRef(uid)
  const snap = await getDoc(ref)
  const data = snap.exists() ? snap.data() : null

  const current = data?.stats || {}
  const next = {
    tracksListened: safeNumber(current.tracksListened) + safeNumber(tracksListenedDelta),
    favorites: safeNumber(current.favorites) + safeNumber(favoritesDelta),
    totalListeningTime: safeNumber(current.totalListeningTime) + safeNumber(listeningMinutesDelta)
  }

  await setDoc(ref, { stats: next, updatedAt: serverTimestamp() }, { merge: true })
}

export async function getRecentListeningEvents(uid, max = 20) {
  if (!uid) return []

  const col = collection(db, 'users', uid, 'listeningEvents')
  const q = query(col, orderBy('startedAt', 'desc'), limit(max))
  const snap = await getDocs(q)

  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getWeeklyListeningActivity(uid) {
  const events = await getRecentListeningEvents(uid, 200)

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayIndex = (date) => {
    const js = date.getDay() // 0 Sun ... 6 Sat
    return js === 0 ? 6 : js - 1
  }

  const result = new Array(7).fill(0)
  const now = Date.now()
  const sevenDays = 7 * 24 * 60 * 60 * 1000

  events.forEach((e) => {
    const d = e.clientStartedAt?.toDate?.() || (e.clientStartedAt ? new Date(e.clientStartedAt) : null)
    if (!d) return
    if (now - d.getTime() > sevenDays) return
    result[dayIndex(d)] += 1
  })

  return labels.map((label, idx) => ({ label, count: result[idx] }))
}

export async function getTopTracks(uid, max = 3) {
  const events = await getRecentListeningEvents(uid, 500)
  const counts = new Map()

  events.forEach((e) => {
    const key = e.trackId
    if (!key) return
    const prev = counts.get(key)
    if (prev) {
      prev.plays += 1
    } else {
      counts.set(key, {
        trackId: e.trackId,
        title: e.title,
        artistName: e.artistName,
        artwork: e.artwork,
        plays: 1
      })
    }
  })

  return Array.from(counts.values())
    .sort((a, b) => b.plays - a.plays)
    .slice(0, max)
}

export async function getNotifications(uid, max = 10) {
  if (!uid) return []

  const col = collection(db, 'users', uid, 'notifications')
  const q = query(col, orderBy('serverCreatedAt', 'desc'), limit(max))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getAllNotifications(uid, max = 100) {
  return await getNotifications(uid, max)
}

export async function markNotificationRead(uid, notificationId) {
  if (!uid || !notificationId) return
  const ref = doc(db, 'users', uid, 'notifications', notificationId)
  await updateDoc(ref, { read: true })
}

export async function markAllNotificationsRead(uid) {
  if (!uid) return

  const col = collection(db, 'users', uid, 'notifications')
  const snap = await getDocs(query(col, where('read', '==', false), limit(50)))
  if (snap.empty) return

  const batch = writeBatch(db)
  snap.docs.forEach((d) => {
    batch.update(d.ref, { read: true })
  })
  await batch.commit()
}
