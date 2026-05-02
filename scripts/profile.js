import { auth } from './firebase-init.js'
import { updateProfile, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
import { initSettings, getConfig } from './config-loader.js'
import {
    ensureUserProfileDoc,
    updateUserProfile,
    getRecentListeningEvents,
    getTopTracks,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getWeeklyListeningActivity,
    getFavorites,
    getPlaylists,
    createPlaylist
} from './user-data.js'
import { likedTracksManager } from './liked-tracks-manager.js'
import { fetchArtists, fetchArtistById, fetchTrackById } from './data/content-repo.js'

function uniqueStrings(values) {
    const out = []
    const seen = new Set()
    for (const v of values || []) {
        const s = String(v || '').trim()
        if (!s) continue
        const key = s.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(s)
    }
    return out
}

function splitArtistParts(name) {
    const raw = String(name || '').trim()
    if (!raw) return []
    return raw
        .split(/\s*(?:&|•|\+|,|\/|\bfeat\.?\b|\bft\.?\b|\bx\b)\s*/i)
        .map((p) => String(p || '').trim())
        .filter((p) => p && p.toLowerCase() !== 'unknown artist')
}

function normalizeArtistParts(values) {
    const parts = []
    for (const v of values || []) {
        parts.push(...splitArtistParts(v))
    }
    return uniqueStrings(parts)
}

async function resolveTrackArtistLine(track, artistsById) {
    const t = track || {}
    const namesFromDoc = Array.isArray(t.collaboratorNames) ? t.collaboratorNames : []
    const collabIds = Array.isArray(t.collaborators) ? t.collaborators : []

    const parts = []
    parts.push(...namesFromDoc)

    if (collabIds.length > 0) {
        const fetched = await Promise.all(
            collabIds.map(async (id) => {
                const key = String(id || '').trim()
                if (!key) return ''
                const fromCache = artistsById?.get(key)
                if (fromCache?.name) return fromCache.name
                try {
                    const a = await fetchArtistById(key)
                    return a?.name || ''
                } catch (_) {
                    return ''
                }
            })
        )
        parts.push(...fetched)
    }

    if (t.artistName) parts.push(t.artistName)

    const primaryId = String(t.artist || '').trim()
    if (primaryId) {
        const fromCache = artistsById?.get(primaryId)
        if (fromCache?.name) parts.push(fromCache.name)
        else {
            try {
                const a = await fetchArtistById(primaryId)
                if (a?.name) parts.push(a.name)
            } catch (_) {}
        }
    }

    const normalized = normalizeArtistParts(parts)
    return normalized.length > 0 ? normalized.join(' & ') : (t.artistName || 'Unknown Artist')
}

class UserProfile {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.authInitialized = false;
        this._artistsById = new Map();
        this._artistsByName = new Map();
        this._profileClickHandlersBound = false;
        this.init();
    }

    async init() {
        // Initialize settings first to ensure config is loaded
        await initSettings();

        // Check authentication
        onAuthStateChanged(auth, (user) => {
            this.authInitialized = true;
            if (user) {
                this.currentUser = user;
                this.loadUserProfile();
                this.setupEventListeners();
            } else {
                // Only redirect if auth is initialized and user is not on auth page
                if (!window.location.pathname.includes('auth.html')) {
                    const href = 'auth.html'
                    if (typeof window.spaNavigate === 'function') {
                        window.spaNavigate(href)
                    } else {
                        window.location.href = href;
                    }
                }
            }
        });

        // Listen for liked tracks updates to refresh UI
        if (!window.__profileLikedTracksListenerBound) {
            window.__profileLikedTracksListenerBound = true
            document.addEventListener('likedTracksUpdated', (e) => {
                const { trackId, isLiked } = e.detail;
                if (trackId && isLiked !== undefined) {
                    likedTracksManager.updateTrackHeartIcons(trackId, isLiked);
                } else {
                    likedTracksManager.updateAllHeartIcons();
                }
            });
        }
    }

    async loadUserProfile() {
        if (!this.currentUser) return;

        const ensured = await ensureUserProfileDoc(this.currentUser)
        this.userProfile = ensured?.data || null

        this.updateUI();
    }

    updateUI() {
        if (!this.userProfile) return;

        // Update header info
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const memberSince = document.getElementById('memberSince');
        const infoName = document.getElementById('infoName');
        const infoEmail = document.getElementById('infoEmail');
        const infoPhone = document.getElementById('infoPhone');
        const infoLocation = document.getElementById('infoLocation');

        if (profileName) profileName.textContent = this.userProfile.displayName || 'User';
        if (profileEmail) profileEmail.textContent = this.userProfile.email;
        if (memberSince) {
            const date = new Date(this.userProfile.memberSince);
            memberSince.textContent = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        }
        if (infoName) infoName.textContent = this.userProfile.displayName || 'User';
        if (infoEmail) infoEmail.textContent = this.userProfile.email;
        if (infoPhone) infoPhone.textContent = this.userProfile.phone || 'Not provided';
        if (infoLocation) infoLocation.textContent = this.userProfile.location || 'Not provided';

        // Update stats
        const tracksListened = document.getElementById('tracksListened');
        const favoritesCount = document.getElementById('favoritesCount');
        const membershipStatus = document.getElementById('membershipStatus');
        const totalListeningTime = document.getElementById('totalListeningTime');

        if (tracksListened) tracksListened.textContent = this.userProfile.stats?.tracksListened || 0;
        if (favoritesCount) favoritesCount.textContent = this.userProfile.stats?.favorites || 0;
        if (membershipStatus) membershipStatus.textContent = this.getMembershipStatus();
        if (totalListeningTime) totalListeningTime.textContent = this.formatListeningTime(this.userProfile.stats?.totalListeningTime || 0);

        // Load favorites, history, and playlists
        this.loadFavorites();
        this.loadHistory();
        this.loadPlaylists();

        // Load overview widgets
        this.loadTopTracks();
        this.loadNotifications();
        this.loadListeningActivity();
    }

    getMembershipStatus() {
        const membership = localStorage.getItem(`membership_${this.currentUser.uid}`);
        if (membership) {
            const data = JSON.parse(membership);
            return data.plan ? data.plan.charAt(0).toUpperCase() + data.plan.slice(1) : 'Free';
        }
        return 'Free';
    }

    formatListeningTime(minutes) {
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }

    setupEventListeners() {
        // Tab switching
        const tabs = document.querySelectorAll('.profile-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });

        this.bindProfileListClickHandlers();

        // Edit profile modal
        const editProfileBtn = document.getElementById('editProfileBtn');
        const editPersonalInfo = document.getElementById('editPersonalInfo');
        const closeEditModal = document.getElementById('closeEditModal');
        const editProfileModal = document.getElementById('editProfileModal');
        const editProfileForm = document.getElementById('editProfileForm');

        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', () => this.openEditModal());
        }

        if (editPersonalInfo) {
            editPersonalInfo.addEventListener('click', () => this.openEditModal());
        }

        if (closeEditModal) {
            closeEditModal.addEventListener('click', () => this.closeEditModal());
        }

        if (editProfileModal) {
            editProfileModal.addEventListener('click', (e) => {
                if (e.target === editProfileModal) {
                    this.closeEditModal();
                }
            });
        }

        if (editProfileForm) {
            editProfileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
        }

        // Mark all notifications as read
        const markAllRead = document.getElementById('markAllRead');
        if (markAllRead) {
            markAllRead.addEventListener('click', () => this.markAllNotificationsRead());
        }

        // Create playlist buttons
        const createPlaylistBtn = document.getElementById('createPlaylistBtn');
        const createFirstPlaylist = document.getElementById('createFirstPlaylist');
        
        if (createPlaylistBtn) {
            createPlaylistBtn.addEventListener('click', () => this.createPlaylist());
        }
        
        if (createFirstPlaylist) {
            createFirstPlaylist.addEventListener('click', () => this.createPlaylist());
        }

        // Close modal on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeEditModal();
            }
        });
    }

    getTrackArtistAvatarHtml(track) {
        const t = track || {}
        const primaryId = String(t.artist || '').trim()
        const collabIds = Array.isArray(t.collaborators) ? t.collaborators.map((x) => String(x)) : []

        const nameParts = normalizeArtistParts([
            t.artistName,
            ...(Array.isArray(t.collaboratorNames) ? t.collaboratorNames : [])
        ])

        const idsFromNames = nameParts
            .map((n) => this._artistsByName?.get(String(n).toLowerCase())?.id)
            .filter(Boolean)
            .map((id) => String(id))

        const ids = uniqueStrings([primaryId, ...collabIds, ...idsFromNames].filter(Boolean))
        const items = ids
            .map((id) => ({ id, src: this._artistsById?.get(String(id))?.image || '' }))
            .filter((x) => x.id && x.src)
            .slice(0, 4)

        if (items.length === 0) return ''

        return `
            <div class="collab-avatars profile-track-artist-avatars">
                ${items
                    .map(({ id, src }) =>
                        `<a class="collab-avatar artist-avatar-link" href="artist-detail.html?id=${encodeURIComponent(id)}" data-artist-id="${String(id).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" aria-label="View artist" tabindex="0"><img src="${String(src).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" alt="" loading="lazy" decoding="async"></a>`
                    )
                    .join('')}
            </div>
        `
    }

    bindProfileListClickHandlers() {
        if (this._profileClickHandlersBound) return;
        this._profileClickHandlersBound = true;

        const navigateToTrack = (trackId) => {
            const id = String(trackId || '').trim();
            if (!id) return;
            const href = `track-detail.html?id=${encodeURIComponent(id)}`;
            if (typeof window.spaNavigate === 'function') {
                window.spaNavigate(href);
            } else {
                window.location.href = href;
            }
        };

        const topTracksList = document.getElementById('topTracksList');
        if (topTracksList) {
            topTracksList.addEventListener('click', (e) => {
                const item = e.target.closest('.top-track-item');
                if (!item) return;
                const trackId = item.dataset.trackId;
                if (trackId) navigateToTrack(trackId);
            });
        }

        const historyList = document.getElementById('historyList');
        if (historyList) {
            historyList.addEventListener('click', (e) => {
                const item = e.target.closest('.history-item');
                if (!item) return;
                const trackId = item.dataset.trackId;
                if (trackId) navigateToTrack(trackId);
            });
        }

        const notificationsList = document.getElementById('notificationsList');
        if (notificationsList) {
            notificationsList.addEventListener('click', async (e) => {
                const item = e.target.closest('.notification-item');
                if (!item) return;
                const trackId = item.dataset.trackId;
                const notificationId = item.dataset.notificationId;
                if (notificationId && this.currentUser?.uid) {
                    try {
                        await markNotificationRead(this.currentUser.uid, notificationId)
                    } catch (_) {}
                }
                if (item.classList.contains('unread')) {
                    item.classList.remove('unread');
                }
                if (notificationId) {
                    const href = `notifications.html?id=${encodeURIComponent(notificationId)}`;
                    if (typeof window.spaNavigate === 'function') {
                        window.spaNavigate(href);
                    } else {
                        window.location.href = href;
                    }
                }
            });
        }
    }

    switchTab(tabId) {
        // Update tab buttons
        const tabs = document.querySelectorAll('.profile-tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabId) {
                tab.classList.add('active');
            }
        });

        // Update tab panels
        const panels = document.querySelectorAll('.tab-panel');
        panels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === tabId) {
                panel.classList.add('active');
            }
        });
    }

    openEditModal() {
        const modal = document.getElementById('editProfileModal');
        const editFullName = document.getElementById('editFullName');
        const editPhone = document.getElementById('editPhone');
        const editLocation = document.getElementById('editLocation');
        const editBio = document.getElementById('editBio');

        if (editFullName) editFullName.value = this.userProfile.displayName || '';
        if (editPhone) editPhone.value = this.userProfile.phone || '';
        if (editLocation) editLocation.value = this.userProfile.location || '';
        if (editBio) editBio.value = this.userProfile.bio || '';

        if (modal) modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeEditModal() {
        const modal = document.getElementById('editProfileModal');
        if (modal) modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    async handleProfileUpdate(e) {
        e.preventDefault();

        const fullName = document.getElementById('editFullName').value.trim();
        const phone = document.getElementById('editPhone').value.trim();
        const location = document.getElementById('editLocation').value.trim();
        const bio = document.getElementById('editBio').value.trim();

        if (!fullName) {
            this.showNotification('Full name is required', 'error');
            return;
        }

        try {
            // Update Firebase auth profile
            await updateProfile(auth.currentUser, {
                displayName: fullName
            });

            // Update local profile
            this.userProfile.displayName = fullName;
            this.userProfile.phone = phone;
            this.userProfile.location = location;
            this.userProfile.bio = bio;

            await updateUserProfile(this.currentUser.uid, {
                displayName: fullName,
                phone,
                location,
                bio
            })

            this.updateUI();
            this.closeEditModal();
            this.showNotification('Profile updated successfully', 'success');
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showNotification('Error updating profile', 'error');
        }
    }

    async markAllNotificationsRead() {
        if (!this.currentUser?.uid) return
        try {
            await markAllNotificationsRead(this.currentUser.uid)
            await this.loadNotifications()
            this.showNotification('All notifications marked as read', 'success')
        } catch (e) {
            console.error('Error marking notifications read:', e)
            this.showNotification('Error marking notifications read', 'error')
        }
    }

    async loadFavorites() {
        const favoritesGrid = document.getElementById('favoritesGrid');
        if (!favoritesGrid) return;

        try {
            const favorites = await getFavorites(this.currentUser.uid, 50)
            if (!favorites || favorites.length === 0) {
                favoritesGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-heart"></i>
                        <h3>No favorites yet</h3>
                        <p>Start exploring and add tracks to your favorites</p>
                        <a href="music.html" class="btn btn-primary">Browse Music</a>
                    </div>
                `;
                return;
            }

            if (!this._artistsById || this._artistsById.size === 0) {
                try {
                    const artists = await fetchArtists()
                    this._artistsById = new Map((artists || []).map((a) => [String(a.id), a]))
                    this._artistsByName = new Map(
                        (artists || [])
                            .filter((a) => a && a.name)
                            .map((a) => [String(a.name).trim().toLowerCase(), a])
                    )
                } catch (e) {
                    console.warn('[Profile] Failed to fetch artists for favorites collaboration resolution', e)
                    this._artistsById = new Map()
                    this._artistsByName = new Map()
                }
            }

            const resolvedFavorites = []
            for (const fav of favorites) {
                const id = fav?.trackId || fav?.id
                if (!id) continue
                try {
                    const t = await fetchTrackById(id)
                    const base = t || fav
                    const artistName = await resolveTrackArtistLine(base, this._artistsById)
                    resolvedFavorites.push({ ...base, ...fav, id: base?.id || id, trackId: id, artistName })
                } catch (_) {
                    const artistName = await resolveTrackArtistLine(fav, this._artistsById)
                    resolvedFavorites.push({ ...fav, id, trackId: id, artistName })
                }
            }

            // Store tracks for event handlers
            window.__profileTracks = resolvedFavorites;

            favoritesGrid.innerHTML = resolvedFavorites.map((track, index) => {
                const spotifyUrl = track.spotifyUrl || track.platformLinks?.spotify || '';
                const isLiked = likedTracksManager.isTrackLiked(track.trackId);
                const avatarHtml = this.getTrackArtistAvatarHtml(track)
                return `
                <div class="track-card" data-track="${index}" data-track-id="${track.trackId}" data-spotify-url="${spotifyUrl}">
                    <div class="track-artwork">
                        <img src="${track.artwork || 'public/player-cover-1.jpg'}" alt="${track.title}">
                        ${spotifyUrl ? '<div class="spotify-indicator" title="Listen on Spotify"><i class="fab fa-spotify"></i></div>' : ''}
                        <button class="track-play-btn" type="button" aria-label="Play ${track.title}">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                    <div class="track-content">
                        <div class="track-header">
                            <div class="track-info">
                                <h4 class="track-title">${track.title}</h4>
                                <p class="track-artist">${track.artistName}</p>
                                ${avatarHtml || ''}
                            </div>
                            <button class="like-btn-mini ${isLiked ? 'liked' : ''}" title="Like" data-like-track-id="${track.trackId}" type="button">
                                <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `}).join('');

            // Setup event listeners after rendering
            this.setupTrackCardListeners();
        } catch (e) {
            console.error('Error loading favorites:', e)
        }
    }

    loadHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        getRecentListeningEvents(this.currentUser.uid, 20).then((events) => {
            const history = events.map((e) => ({
                trackId: e.trackId,
                title: e.title,
                artist: e.artistName,
                artwork: e.artwork,
                timestamp: e.clientStartedAt?.toDate?.() || e.clientStartedAt
            }))

            if (history.length === 0) {
                historyList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-history"></i>
                        <h3>No listening history</h3>
                        <p>Start listening to build your history</p>
                        <a href="music.html" class="btn btn-primary">Browse Music</a>
                    </div>
                `;
                return;
            }

            historyList.innerHTML = history.slice(0, 20).map(track => `
                <div class="history-item" data-track-id="${track.trackId || ''}" role="button" tabindex="0">
                    <img src="${track.artwork || 'public/player-cover-1.jpg'}" alt="${track.title}">
                    <div class="history-info">
                        <h4>${track.title}</h4>
                        <p>${track.artist}</p>
                    </div>
                    <span class="history-time">${this.formatTimeAgo(track.timestamp)}</span>
                </div>
            `).join('');
        }).catch((e) => {
            console.error('Error loading history:', e)
        })

        return

        if (history.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>No listening history</h3>
                    <p>Start listening to build your history</p>
                    <a href="music.html" class="btn btn-primary">Browse Music</a>
                </div>
            `;
            return;
        }

        historyList.innerHTML = history.slice(0, 20).map(track => `
            <div class="history-item">
                <img src="${track.artwork || 'public/player-cover-1.jpg'}" alt="${track.title}">
                <div class="history-info">
                    <h4>${track.title}</h4>
                    <p>${track.artist}</p>
                </div>
                <span class="history-time">${this.formatTimeAgo(track.timestamp)}</span>
            </div>
        `).join('');
    }

    async loadTopTracks() {
        const list = document.getElementById('topTracksList')
        if (!list || !this.currentUser?.uid) return

        try {
            const top = await getTopTracks(this.currentUser.uid, 3)
            if (!top || top.length === 0) {
                list.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-star"></i>
                        <h3>No top tracks yet</h3>
                        <p>Play some music to see your top tracks here</p>
                        <a href="music.html" class="btn btn-primary">Browse Music</a>
                    </div>
                `
                return
            }

            list.innerHTML = top.map((t, idx) => `
                <div class="top-track-item" data-track-id="${t.trackId || ''}" role="button" tabindex="0">
                    <span class="track-rank">${idx + 1}</span>
                    <div class="track-info">
                        <p class="track-title">${t.title || ''}</p>
                        <p class="track-artist">${t.artistName || ''}</p>
                    </div>
                    <span class="track-plays">${t.plays} play${t.plays !== 1 ? 's' : ''}</span>
                </div>
            `).join('')
        } catch (e) {
            console.error('Error loading top tracks:', e)
        }
    }

    async loadNotifications() {
        const list = document.getElementById('notificationsList')
        if (!list || !this.currentUser?.uid) return

        try {
            const items = await getNotifications(this.currentUser.uid, 10)
            if (!items || items.length === 0) {
                list.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-bell"></i>
                        <h3>No notifications</h3>
                        <p>You're all caught up</p>
                    </div>
                `
                return
            }

            list.innerHTML = items.map((n) => {
                const created = n.createdAt?.toDate?.() || n.createdAt || n.clientCreatedAt
                const time = created ? this.formatTimeAgo(created) : ''
                const icon = n.type === 'welcome' ? 'fa-music' : n.type === 'tip' ? 'fa-info-circle' : 'fa-bell'
                const unread = n.read === false ? 'unread' : ''
                const trackId = n.trackId || n.data?.trackId || ''
                return `
                    <div class="notification-item ${unread}" data-notification-id="${n.id || ''}" data-track-id="${trackId}">
                        <div class="notification-icon">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="notification-content">
                            <p class="notification-text">${n.message || ''}</p>
                            <span class="notification-time">${time}</span>
                        </div>
                    </div>
                `
            }).join('')
        } catch (e) {
            console.error('Error loading notifications:', e)
        }
    }

    async loadListeningActivity() {
        const chart = document.querySelector('.activity-chart')
        if (!chart || !this.currentUser?.uid) return

        try {
            const activity = await getWeeklyListeningActivity(this.currentUser.uid)
            const max = Math.max(1, ...activity.map(a => a.count))
            chart.innerHTML = activity.map((a) => {
                const pct = Math.round((a.count / max) * 100)
                return `
                    <div class="activity-bar">
                        <div class="bar-fill" style="width: ${pct}%"></div>
                        <span class="bar-label">${a.label}</span>
                    </div>
                `
            }).join('')
        } catch (e) {
            console.error('Error loading listening activity:', e)
        }
    }

    async loadPlaylists() {
        const playlistsGrid = document.getElementById('playlistsGrid');
        if (!playlistsGrid) return;

        try {
            const playlists = await getPlaylists(this.currentUser.uid, 50);
            if (!playlists || playlists.length === 0) {
                playlistsGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-list"></i>
                        <h3>No playlists yet</h3>
                        <p>Create your first playlist to organize your music</p>
                        <button class="btn btn-primary" id="createFirstPlaylist">
                            <i class="fas fa-plus"></i> Create Playlist
                        </button>
                    </div>
                `;
                const createFirstPlaylist = document.getElementById('createFirstPlaylist');
                if (createFirstPlaylist) {
                    createFirstPlaylist.addEventListener('click', () => this.createPlaylist());
                }
                return;
            }

            // Store playlists for event handlers
            window.__profilePlaylists = playlists;

            // Fetch track details for each playlist's preview
            const playlistsWithPreviews = await Promise.all(playlists.map(async (playlist) => {
                const trackIds = playlist.tracks || [];
                const previewTracks = [];
                
                // Fetch first 3 tracks for preview
                for (const trackId of trackIds.slice(0, 3)) {
                    try {
                        const track = await fetchTrackById(trackId);
                        if (track) {
                            previewTracks.push(track);
                        }
                    } catch (error) {
                        console.error('[Profile] Error loading track for preview:', trackId, error);
                    }
                }

                return { ...playlist, previewTracks };
            }));

            playlistsGrid.innerHTML = playlistsWithPreviews.map(playlist => {
                const previewHTML = playlist.previewTracks.length > 0 
                    ? `<div class="playlist-preview">
                        ${playlist.previewTracks.map(track => `
                            <div class="playlist-preview-track">
                                <img src="${track.artwork || 'public/player-cover-1.jpg'}" alt="${track.title}">
                            </div>
                        `).join('')}
                        ${playlist.trackCount > 3 ? `<div class="playlist-preview-more">+${playlist.trackCount - 3}</div>` : ''}
                    </div>`
                    : '';

                return `
                <div class="playlist-card" data-playlist-id="${playlist.id}">
                    <div class="playlist-artwork">
                        ${playlist.previewTracks.length > 0 
                            ? `<img src="${playlist.previewTracks[0].artwork || 'public/player-cover-1.jpg'}" alt="${playlist.name}" class="playlist-cover-image">`
                            : '<i class="fas fa-music"></i>'
                        }
                        <button class="playlist-play-btn" type="button" aria-label="Play ${playlist.name}">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                    <div class="playlist-content">
                        <h4>${playlist.name}</h4>
                        <p>${playlist.trackCount || (playlist.tracks?.length || 0)} tracks</p>
                    </div>
                    ${previewHTML}
                    <div class="playlist-actions">
                        <button class="playlist-action-btn" data-action="edit" title="Edit playlist">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="playlist-action-btn" data-action="delete" title="Delete playlist">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `}).join('');

            // Setup playlist card listeners
            this.setupPlaylistCardListeners();
        } catch (e) {
            console.error('Error loading playlists:', e)
        }
    }

    async createPlaylist() {
        const playlistName = prompt('Enter playlist name:');
        if (!playlistName || !playlistName.trim()) return;

        try {
            await createPlaylist(this.currentUser.uid, playlistName.trim())
            this.loadPlaylists()
            this.showNotification('Playlist created successfully', 'success')
        } catch (e) {
            console.error('Error creating playlist:', e)
            this.showNotification('Error creating playlist', 'error')
        }
    }

    formatTimeAgo(timestamp) {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return past.toLocaleDateString();
    }

    setupTrackCardListeners() {
        // Play button listeners
        document.querySelectorAll('#favoritesGrid .track-play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.track-card');
                const trackIndex = parseInt(card.dataset.track);
                const track = window.__profileTracks[trackIndex];
                
                if (track && window.persistentPlayer) {
                    // Set full playlist for favorites so next/prev/shuffle/repeat work
                    const playlistData = window.__profileTracks.map(t => ({
                        id: t.id,
                        title: t.title,
                        artistName: t.artistName,
                        artwork: t.artwork,
                        platformLinks: t.platformLinks || {},
                        originalData: t
                    }));
                    window.persistentPlayer.setPlaylist(playlistData, trackIndex);
                    window.persistentPlayer.play();
                }
            });
        });

        // Artist avatar navigation
        document.querySelectorAll('#favoritesGrid .artist-avatar-link[data-artist-id]').forEach((link) => {
            if (link._artistNavHandler) {
                link.removeEventListener('click', link._artistNavHandler)
            }
            link._artistNavHandler = (e) => {
                e.preventDefault()
                e.stopPropagation()
                const artistId = link.dataset.artistId
                if (!artistId) return
                const href = `artist-detail.html?id=${encodeURIComponent(artistId)}`
                if (typeof window.spaNavigate === 'function') {
                    window.spaNavigate(href)
                } else {
                    window.location.href = href
                }
            }
            link.addEventListener('click', link._artistNavHandler)
        })

        // Like button listeners (already liked, so remove from favorites)
        document.querySelectorAll('#favoritesGrid .like-btn-mini').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const trackId = btn.dataset.likeTrackId;
                this.handleUnlikeTrack(trackId, btn);
            });
        });

        // Card click - navigate to track detail
        document.querySelectorAll('#favoritesGrid .track-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.track-play-btn') || 
                    e.target.closest('.like-btn-mini') || 
                    e.target.closest('.spotify-indicator') ||
                    e.target.closest('.artist-avatar-link')) {
                    return;
                }
                const trackId = card.dataset.trackId;
                if (trackId) {
                    const href = `track-detail.html?id=${trackId}`;
                    if (typeof window.spaNavigate === 'function') {
                        window.spaNavigate(href)
                    } else {
                        window.location.href = href;
                    }
                }
            });
        });

        // Spotify indicator click
        document.querySelectorAll('#favoritesGrid .spotify-indicator').forEach(indicator => {
            indicator.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = indicator.closest('.track-card');
                const spotifyUrl = card.dataset.spotifyUrl;
                if (spotifyUrl) {
                    window.open(spotifyUrl, '_blank');
                }
            });
        });
    }

    setupPlaylistCardListeners() {
        // Play button on playlist card
        document.querySelectorAll('#playlistsGrid .playlist-play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.playlist-card');
                const playlistId = card.dataset.playlistId;
                const playlist = window.__profilePlaylists?.find(p => p.id === playlistId);
                
                if (playlist && playlist.tracks && playlist.tracks.length > 0) {
                    // Play first track in playlist
                    const firstTrackId = playlist.tracks[0];
                    if (!firstTrackId) {
                        this.showNotification('Playlist is empty', 'info');
                        return;
                    }

                    if (window.persistentPlayer) {
                        fetchTrackById(firstTrackId).then((t) => {
                            if (!t) {
                                this.showNotification('Track not found', 'error');
                                return;
                            }
                            const ensureArtistsLoaded = async () => {
                                if (this._artistsById && this._artistsById.size > 0) return
                                try {
                                    const artists = await fetchArtists()
                                    this._artistsById = new Map((artists || []).map((a) => [String(a.id), a]))
                                } catch (_) {
                                    this._artistsById = new Map()
                                }
                            }
                            const loadWithResolvedArtist = async () => {
                                await ensureArtistsLoaded()
                                const artistName = await resolveTrackArtistLine(t, this._artistsById)
                                window.persistentPlayer.loadTrack({
                                    id: t.id,
                                    title: t.title,
                                    artistName,
                                    artwork: t.artwork,
                                    platformLinks: t.platformLinks || {},
                                    originalData: { ...t, artistName }
                                });
                                window.persistentPlayer.play();
                                this.showNotification(`Playing ${playlist.name}`, 'success');
                            }
                            loadWithResolvedArtist().catch(() => {
                                window.persistentPlayer.loadTrack({
                                    id: t.id,
                                    title: t.title,
                                    artistName: t.artistName,
                                    artwork: t.artwork,
                                    platformLinks: t.platformLinks || {},
                                    originalData: t
                                });
                                window.persistentPlayer.play();
                                this.showNotification(`Playing ${playlist.name}`, 'success');
                            })
                        }).catch((err) => {
                            console.error('[Profile] Failed to load first track:', err);
                            this.showNotification('Failed to load track', 'error');
                        });
                    }
                } else {
                    this.showNotification('Playlist is empty', 'info');
                }
            });
        });

        // Edit button
        document.querySelectorAll('#playlistsGrid .playlist-action-btn[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.playlist-card');
                const playlistId = card.dataset.playlistId;
                const playlist = window.__profilePlaylists?.find(p => p.id === playlistId);
                
                if (playlist) {
                    const newName = prompt('Edit playlist name:', playlist.name);
                    if (newName && newName.trim()) {
                        this.updatePlaylistName(playlistId, newName.trim());
                    }
                }
            });
        });

        // Delete button
        document.querySelectorAll('#playlistsGrid .playlist-action-btn[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.playlist-card');
                const playlistId = card.dataset.playlistId;
                
                if (confirm('Are you sure you want to delete this playlist?')) {
                    this.deletePlaylist(playlistId);
                }
            });
        });

        // Card click - navigate to playlist detail page
        document.querySelectorAll('#playlistsGrid .playlist-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.playlist-play-btn') || 
                    e.target.closest('.playlist-action-btn')) {
                    return;
                }
                const playlistId = card.dataset.playlistId;
                const href = `playlist-detail.html?id=${playlistId}`;
                if (typeof window.spaNavigate === 'function') {
                    window.spaNavigate(href)
                } else {
                    window.location.href = href;
                }
            });
        });
    }

    async handleUnlikeTrack(trackId, btn) {
        if (!this.currentUser?.uid) return;
        
        // Use centralized liked tracks manager
        const track = window.__profileTracks?.find(t => t.trackId === trackId) || { id: trackId, trackId: trackId };
        const result = await likedTracksManager.toggleLike(track, btn);
        
        if (result.error) {
            this.showNotification('Error removing favorite', 'error');
            return;
        }
        
        // Remove card from DOM with animation
        const card = btn.closest('.track-card');
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => {
            card.remove();
            // Check if empty
            const grid = document.getElementById('favoritesGrid');
            if (grid && grid.children.length === 0) {
                this.loadFavorites(); // Reload to show empty state
            }
        }, 300);
        
        this.showNotification('Removed from favorites', 'success');
    }

    async updatePlaylistName(playlistId, newName) {
        if (!this.currentUser?.uid) return;
        
        try {
            const { doc, updateDoc, getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            const db = getFirestore();
            const playlistRef = doc(db, 'users', this.currentUser.uid, 'playlists', playlistId);
            await updateDoc(playlistRef, { name: newName });
            
            this.loadPlaylists();
            this.showNotification('Playlist updated', 'success');
        } catch (e) {
            console.error('Error updating playlist:', e);
            this.showNotification('Error updating playlist', 'error');
        }
    }

    async deletePlaylist(playlistId) {
        if (!this.currentUser?.uid) return;
        
        try {
            const { doc, deleteDoc, getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
            const db = getFirestore();
            const playlistRef = doc(db, 'users', this.currentUser.uid, 'playlists', playlistId);
            await deleteDoc(playlistRef);
            
            this.loadPlaylists();
            this.showNotification('Playlist deleted', 'success');
        } catch (e) {
            console.error('Error deleting playlist:', e);
            this.showNotification('Error deleting playlist', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#00d4ff'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            z-index: 3000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

function initUserProfilePage() {
    const root = document.querySelector('.profile-header')
    if (!root) return
    if (root.dataset.profileInit === '1') return
    root.dataset.profileInit = '1'
    new UserProfile()
}

// Initialize profile page
document.addEventListener('DOMContentLoaded', () => {
    initUserProfilePage()
})

document.addEventListener('includes:loaded', () => {
    initUserProfilePage()
})

document.addEventListener('spa:navigated', () => {
    initUserProfilePage()
})

// Add notification animations
if (!document.getElementById('profileNotificationAnimations')) {
const style = document.createElement('style');
style.id = 'profileNotificationAnimations'
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
}
