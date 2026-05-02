import { auth } from './firebase-init.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
import { getAllNotifications, markAllNotificationsRead, markNotificationRead } from './user-data.js'

class NotificationsPage {
    constructor() {
        this.currentUser = null
        this.listEl = document.getElementById('allNotificationsList')
        this.metaEl = document.getElementById('notificationsMeta')
        this.unreadEl = document.getElementById('unreadCount')
        this.markAllBtn = document.getElementById('markAllReadBtn')
        this.detailEl = document.getElementById('notificationDetail')

        this._items = []
        this._selectedId = null

        this._bound = false

        this.init()
    }

    init() {
        onAuthStateChanged(auth, (user) => {
            if (!user) {
                const href = 'auth.html'
                if (typeof window.spaNavigate === 'function') window.spaNavigate(href)
                else window.location.href = href
                return
            }

            this.currentUser = user
            this.bindEvents()
            this.load()
        })
    }

    bindEvents() {
        if (this._bound) return
        this._bound = true

        if (this.markAllBtn) {
            this.markAllBtn.addEventListener('click', async () => {
                if (!this.currentUser?.uid) return
                try {
                    await markAllNotificationsRead(this.currentUser.uid)
                    await this.load()
                    if (window.notifications) window.notifications.show('All notifications marked as read', 'success')
                } catch (e) {
                    console.error('[NotificationsPage] markAllRead failed', e)
                    if (window.notifications) window.notifications.show('Failed to mark notifications as read', 'error')
                }
            })
        }

        if (this.listEl) {
            this.listEl.addEventListener('click', (e) => {
                const item = e.target.closest('.notification-item')
                if (!item) return

                const notificationId = item.dataset.notificationId || ''

                this.selectNotificationById(notificationId)

                if (notificationId && this.currentUser?.uid) {
                    markNotificationRead(this.currentUser.uid, notificationId)
                        .then(() => {
                            item.classList.remove('unread')
                        })
                        .catch((err) => console.error('[NotificationsPage] markNotificationRead failed', err))
                }
            })
        }
    }

    async load() {
        if (!this.currentUser?.uid) return
        if (!this.listEl) return

        this.listEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-spinner fa-spin"></i>
                <h3>Loading notifications...</h3>
            </div>
        `

        try {
            const items = await getAllNotifications(this.currentUser.uid, 200)
            this._items = Array.isArray(items) ? items : []
            const unreadCount = (items || []).filter((n) => n?.read === false).length

            if (this.unreadEl) this.unreadEl.textContent = `${unreadCount} unread`
            if (this.metaEl) this.metaEl.textContent = `${items.length} notification${items.length !== 1 ? 's' : ''}`

            if (!items || items.length === 0) {
                this.listEl.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-bell"></i>
                        <h3>No notifications</h3>
                        <p>You’re all caught up.</p>
                    </div>
                `

                if (this.detailEl) {
                    this.detailEl.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-bell"></i>
                            <h3>No notifications</h3>
                            <p>You’re all caught up.</p>
                        </div>
                    `
                }
                return
            }

            this.listEl.innerHTML = items
                .map((n) => {
                    const created = n.createdAt?.toDate?.() || n.createdAt || n.clientCreatedAt || n.serverCreatedAt?.toDate?.()
                    const time = created ? this.formatTimeAgo(created) : ''
                    const unread = n.read === false ? 'unread' : ''
                    const icon = n.type === 'welcome' ? 'fa-music' : n.type === 'tip' ? 'fa-info-circle' : 'fa-bell'
                    const trackId = n.trackId || n.data?.trackId || ''
                    const safeMessage = String(n.message || '')

                    return `
                        <div class="notification-item ${unread}" role="button" tabindex="0" data-notification-id="${n.id || ''}" data-track-id="${trackId}">
                            <div class="notification-icon">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div class="notification-content">
                                <p class="notification-text">${this.escapeHtml(safeMessage)}</p>
                                <span class="notification-time">${this.escapeHtml(time)}</span>
                            </div>
                        </div>
                    `
                })
                .join('')

            const initialId = this.getSelectedIdFromUrl() || items[0]?.id || null
            if (initialId) {
                this.selectNotificationById(initialId)
            }
        } catch (e) {
            console.error('[NotificationsPage] load failed', e)
            this.listEl.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Failed to load notifications</h3>
                    <p>Please try again.</p>
                </div>
            `

            if (this.detailEl) {
                this.detailEl.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-circle"></i>
                        <h3>Failed to load notifications</h3>
                        <p>Please try again.</p>
                    </div>
                `
            }
        }
    }

    getSelectedIdFromUrl() {
        const params = new URLSearchParams(window.location.search)
        return params.get('id')
    }

    selectNotificationById(notificationId) {
        const id = String(notificationId || '').trim()
        if (!id) return

        this._selectedId = id

        try {
            const url = new URL(window.location.href)
            url.searchParams.set('id', id)
            window.history.replaceState({}, '', url.toString())
        } catch (_) {}

        const all = this.listEl ? Array.from(this.listEl.querySelectorAll('.notification-item')) : []
        all.forEach((el) => {
            if (el.dataset.notificationId === id) el.classList.add('is-active')
            else el.classList.remove('is-active')
        })

        const n = (this._items || []).find((x) => String(x?.id || '') === id)
        if (!n) return

        const title = n.title || 'Notification'
        const message = String(n.message || '')
        const created = n.createdAt?.toDate?.() || n.createdAt || n.clientCreatedAt || n.serverCreatedAt?.toDate?.()
        const createdText = created ? this.formatTimeAgo(created) : ''
        const trackId = n.trackId || n.data?.trackId || ''
        const unread = n.read === false

        if (this.detailEl) {
            this.detailEl.innerHTML = `
                <div class="notification-detail-header">
                    <div>
                        <h2 class="notification-detail-title">${this.escapeHtml(title)}</h2>
                        <div class="notification-detail-meta">${this.escapeHtml(createdText)}${unread ? ' • Unread' : ''}</div>
                    </div>
                </div>
                <div class="notification-detail-message">${this.escapeHtml(message)}</div>
                <div class="notification-detail-actions">
                    ${trackId ? `<a class="btn btn-primary" href="track-detail.html?id=${encodeURIComponent(trackId)}"><i class="fas fa-music"></i> Open Track</a>` : ''}
                </div>
            `
        }

        if (unread && this.currentUser?.uid) {
            markNotificationRead(this.currentUser.uid, id).catch(() => {})
            const activeEl = this.listEl?.querySelector(`.notification-item[data-notification-id="${CSS.escape(id)}"]`)
            if (activeEl) activeEl.classList.remove('unread')
        }
    }

    formatTimeAgo(date) {
        const d = date instanceof Date ? date : new Date(date)
        const diff = Date.now() - d.getTime()
        const minutes = Math.floor(diff / 60000)
        if (minutes < 1) return 'Just now'
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        return `${days}d ago`
    }

    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
    }

    escapeAttr(str) {
        return this.escapeHtml(str).replace(/\n/g, ' ')
    }
}

function boot() {
    if (document.getElementById('allNotificationsList')) {
        new NotificationsPage()
    }
}

document.addEventListener('DOMContentLoaded', boot)
document.addEventListener('includes:loaded', boot)
