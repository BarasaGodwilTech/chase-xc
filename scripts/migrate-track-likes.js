import { db } from './firebase-init.js'
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  increment
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'

/**
 * Migration script to backfill track likes from existing user favorites
 * 
 * This script:
 * 1. Fetches all users from Firestore
 * 2. For each user, fetches their favorites
 * 3. Counts how many users liked each track
 * 4. Updates each track's likes field with the correct count
 * 
 * Run this script once to migrate existing likes to the new system.
 * After running, new likes will be automatically counted via incrementTrackLikes()
 */

async function migrateTrackLikes() {
  console.log('[Migration] Starting track likes migration...')
  
  try {
    // Step 1: Fetch all users
    console.log('[Migration] Fetching all users...')
    const usersRef = collection(db, 'users')
    const usersSnap = await getDocs(usersRef)
    const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    console.log(`[Migration] Found ${users.length} users`)
    
    // Step 2: Count likes per track
    console.log('[Migration] Counting likes per track...')
    const likesPerTrack = new Map()
    
    for (const user of users) {
      const favoritesRef = collection(db, 'users', user.id, 'favorites')
      const favoritesSnap = await getDocs(favoritesRef)
      const favorites = favoritesSnap.docs.map(doc => doc.data())
      
      for (const favorite of favorites) {
        const trackId = favorite.trackId
        if (trackId) {
          likesPerTrack.set(trackId, (likesPerTrack.get(trackId) || 0) + 1)
        }
      }
    }
    
    console.log(`[Migration] Found ${likesPerTrack.size} tracks with likes`)
    
    // Step 3: Update each track's likes field
    console.log('[Migration] Updating track likes in Firestore...')
    let updatedCount = 0
    let errorCount = 0
    
    for (const [trackId, likeCount] of likesPerTrack.entries()) {
      try {
        const trackRef = doc(db, 'tracks', trackId)
        await updateDoc(trackRef, {
          likes: likeCount
        })
        updatedCount++
        console.log(`[Migration] Updated track ${trackId}: ${likeCount} likes`)
      } catch (error) {
        errorCount++
        console.error(`[Migration] Error updating track ${trackId}:`, error)
      }
    }
    
    console.log(`[Migration] Migration complete!`)
    console.log(`[Migration] Updated ${updatedCount} tracks`)
    console.log(`[Migration] Errors: ${errorCount}`)
    
    return { success: true, updatedCount, errorCount }
  } catch (error) {
    console.error('[Migration] Migration failed:', error)
    return { success: false, error: error.message }
  }
}

// Export the function
export { migrateTrackLikes }

// Auto-run if this script is loaded directly (for testing)
if (typeof window !== 'undefined') {
  window.migrateTrackLikes = migrateTrackLikes
  console.log('[Migration] Migration script loaded. Run migrateTrackLikes() to execute.')
}
