import { db } from './firebase-init.js'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'

function userDocRef(uid) {
  return doc(db, 'users', uid)
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
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
