import { auth } from './firebase-init.js'
import { updateProfile, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
import { initSettings, getConfig } from './config-loader.js'
import {
    ensureUserProfileDoc,
    updateUserProfile,
    getRecentListeningEvents,
    getTopTracks,
    getNotifications,
    markAllNotificationsRead,
    getWeeklyListeningActivity,
    getFavorites,
    getPlaylists,
    createPlaylist
} from './user-data.js'

class UserProfile {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.authInitialized = false;
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
                    window.location.href = 'auth.html';
                }
            }
        });
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

    loadFavorites() {
        const favoritesGrid = document.getElementById('favoritesGrid');
        if (!favoritesGrid) return;

        getFavorites(this.currentUser.uid, 50).then((favorites) => {
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

            favoritesGrid.innerHTML = favorites.map((track, index) => `
                <div class="track-card" data-track="${index}" data-track-id="${track.trackId}">
                    <div class="track-artwork">
                        <img src="${track.artwork || 'public/player-cover-1.jpg'}" alt="${track.title}">
                        <button class="track-play-btn" type="button">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                    <div class="track-content">
                        <h4 class="track-title">${track.title}</h4>
                        <p class="track-artist">${track.artistName}</p>
                    </div>
                </div>
            `).join('');
        }).catch((e) => {
            console.error('Error loading favorites:', e)
        })
    }

    loadHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        getRecentListeningEvents(this.currentUser.uid, 20).then((events) => {
            const history = events.map((e) => ({
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
                <div class="history-item">
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
                <div class="top-track-item">
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
                return `
                    <div class="notification-item ${unread}">
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

    loadPlaylists() {
        const playlistsGrid = document.getElementById('playlistsGrid');
        if (!playlistsGrid) return;

        getPlaylists(this.currentUser.uid, 50).then((playlists) => {
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

            playlistsGrid.innerHTML = playlists.map(playlist => `
                <div class="playlist-card" data-playlist-id="${playlist.id}">
                    <div class="playlist-artwork">
                        <i class="fas fa-music"></i>
                    </div>
                    <div class="playlist-content">
                        <h4>${playlist.name}</h4>
                        <p>${playlist.trackCount || (playlist.tracks?.length || 0)} tracks</p>
                    </div>
                </div>
            `).join('');
        }).catch((e) => {
            console.error('Error loading playlists:', e)
        })
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

// Initialize profile page
document.addEventListener('DOMContentLoaded', () => {
    new UserProfile();
});

// Add notification animations
const style = document.createElement('style');
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
