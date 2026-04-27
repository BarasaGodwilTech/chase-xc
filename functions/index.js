const { onCall, HttpsError } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

admin.initializeApp()

function assertString(v, name) {
  if (typeof v !== 'string' || !v.trim()) {
    throw new HttpsError('invalid-argument', `Missing or invalid ${name}`)
  }
}

function safeExtFromMime(mime) {
  const m = String(mime || '').toLowerCase()
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg'
  if (m === 'image/png') return 'png'
  if (m === 'image/webp') return 'webp'
  if (m === 'image/gif') return 'gif'
  return ''
}

function sanitizeSegment(s) {
  return String(s || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\.\./g, '')
    .replace(/^\/+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._\-/]/g, '')
}

exports.githubUploadProfileImage = onCall({ timeoutSeconds: 60, memory: '256MiB', cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required')
  }

  const data = request.data || {}
  const entityType = String(data.entityType || '').toLowerCase() // 'artists' | 'team'
  const mimeType = String(data.mimeType || '').toLowerCase()
  const originalName = String(data.fileName || '').trim()
  const base64 = String(data.base64 || '')

  if (!['artists', 'team'].includes(entityType)) {
    throw new HttpsError('invalid-argument', 'Invalid entityType')
  }
  assertString(mimeType, 'mimeType')
  assertString(base64, 'base64')

  // Size guard (base64 overhead ~ 33%). Keep conservative.
  if (base64.length > 3_500_000) {
    throw new HttpsError('invalid-argument', 'Image too large. Please upload a smaller image.')
  }

  const settingsSnap = await admin.firestore().doc('settings/github').get()
  const settings = settingsSnap.exists ? settingsSnap.data() : null
  const enabled = Boolean(settings && settings.enabled)
  if (!enabled) {
    throw new HttpsError('failed-precondition', 'GitHub image uploads are not enabled')
  }

  const owner = settings.owner
  const repo = settings.repo
  const branch = settings.branch || 'main'
  const folder = settings.folder || 'images/profiles'
  const publicBaseUrl = settings.publicBaseUrl || ''

  ;['owner', 'repo'].forEach((k) => assertString(settings[k], k))

  const secretSnap = await admin.firestore().doc('private/github').get()
  const secret = secretSnap.exists ? secretSnap.data() : null
  if (!secret || !secret.token) {
    throw new HttpsError('failed-precondition', 'GitHub token is not configured')
  }

  const extFromMime = safeExtFromMime(mimeType)
  const fallbackExt = (originalName.split('.').pop() || '').toLowerCase()
  const ext = extFromMime || fallbackExt || 'jpg'

  const ts = Date.now()
  const safeFile = sanitizeSegment(`${ts}.${ext}`)
  const path = sanitizeSegment(`${folder}/${entityType}/${safeFile}`)

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`

  const commitMessage = `Upload ${entityType} profile image ${safeFile}`

  const resp = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `token ${secret.token}`,
      'User-Agent': 'chase-xc-admin',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: commitMessage,
      content: base64,
      branch
    })
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new HttpsError('internal', `GitHub upload failed (${resp.status}). ${text}`)
  }

  const json = await resp.json()
  const downloadUrl = json && json.content && json.content.download_url ? json.content.download_url : ''

  let publicUrl = ''
  if (publicBaseUrl) {
    publicUrl = `${String(publicBaseUrl).replace(/\/$/, '')}/${path}`
  } else if (downloadUrl) {
    publicUrl = downloadUrl
  }

  return {
    path,
    url: publicUrl,
    downloadUrl
  }
})
