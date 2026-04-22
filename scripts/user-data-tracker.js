import { auth } from './firebase-init.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
import { ensureUserProfileDoc, logListeningEvent } from './user-data.js'

let currentUser = null
let lastLoggedTrackId = null
let lastLoggedAt = 0

function shouldLog(trackId) {
  const now = Date.now()
  if (trackId !== lastLoggedTrackId) return true
  // Avoid spamming when play/pause toggles quickly
  if (now - lastLoggedAt > 30_000) return true
  return false
}

async function handlePlayerStateChange(detail) {
  if (!currentUser?.uid) return
  if (!detail?.isPlaying) return
  const track = detail.track
  if (!track?.id) return

  if (!shouldLog(track.id)) return

  lastLoggedTrackId = track.id
  lastLoggedAt = Date.now()

  try {
    await logListeningEvent(currentUser.uid, track, { platform: detail.platform })
  } catch (e) {
    console.error('[UserDataTracker] Failed to log listening event:', e)
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
