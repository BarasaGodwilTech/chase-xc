import { auth } from './firebase-init.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
import { ensureUserProfileDoc, logListeningEvent, incrementUserStats } from './user-data.js'

let currentUser = null
let lastLoggedTrackId = null
let lastLoggedAt = 0

let activeTrackId = null
let lastSeenCurrentTime = 0
let accumulatedSeconds = 0

function shouldLog(trackId) {
  const now = Date.now()
  if (trackId !== lastLoggedTrackId) return true
  // Avoid spamming when play/pause toggles quickly
  if (now - lastLoggedAt > 30_000) return true
  return false
}

async function handlePlayerStateChange(detail) {
  if (!currentUser?.uid) return

  const track = detail?.track
  const trackId = track?.id
  if (!trackId) return

  const currentTime = Number(detail?.currentTime || 0)
  const isPlaying = !!detail?.isPlaying

  // Accumulate listening time for the current track.
  if (activeTrackId === trackId) {
    const delta = currentTime - lastSeenCurrentTime
    if (Number.isFinite(delta) && delta > 0 && delta < 30) {
      accumulatedSeconds += delta
    }
    lastSeenCurrentTime = currentTime
  } else {
    // Track changed; flush previous track time.
    await flushListeningMinutes().catch(() => {})
    activeTrackId = trackId
    lastSeenCurrentTime = currentTime
  }

  // When playback pauses/stops, flush.
  if (!isPlaying) {
    await flushListeningMinutes().catch(() => {})
    return
  }

  // Log a new listening event only when playback starts.
  if (!shouldLog(trackId)) return

  lastLoggedTrackId = trackId
  lastLoggedAt = Date.now()

  try {
    await logListeningEvent(currentUser.uid, track, { platform: detail.platform })
  } catch (e) {
    console.error('[UserDataTracker] Failed to log listening event:', e)
  }
}

async function flushListeningMinutes() {
  if (!currentUser?.uid) return
  if (!Number.isFinite(accumulatedSeconds) || accumulatedSeconds <= 0) return

  const minutes = Math.floor(accumulatedSeconds / 60)
  if (minutes <= 0) return

  accumulatedSeconds = accumulatedSeconds - (minutes * 60)

  try {
    await incrementUserStats(currentUser.uid, { listeningMinutesDelta: minutes })
  } catch (e) {
    console.error('[UserDataTracker] Failed to increment listening time:', e)
  }
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user
  if (user) {
    try {
      await ensureUserProfileDoc(user)
    } catch (e) {
      console.error('[UserDataTracker] Failed to ensure profile doc:', e)
    }
  }
})

document.addEventListener('floatingPlayerStateChanged', (e) => {
  handlePlayerStateChange(e.detail)
})
