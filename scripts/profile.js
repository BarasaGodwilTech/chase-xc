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
import { likedTracksManager } from './liked-tracks-manager.js'

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
        
        // Listen for liked tracks updates to refresh UI
        document.addEventListener('likedTracksUpdated', (e) => {
            const { trackId, isLiked } = e.detail;
            if (trackId && isLiked !== undefined) {
                likedTracksManager.updateTrackHeartIcons(trackId, isLiked);
            } else {
                likedTracksManager.updateAllHeartIcons();
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

            // Store tracks for event handlers
            window.__profileTracks = favorites;

            favoritesGrid.innerHTML = favorites.map((track, index) => {
                const spotifyUrl = track.spotifyUrl || track.platformLinks?.spotify || '';
                const isLiked = likedTracksManager.isTrackLiked(track.trackId);
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

            // Store playlists for event handlers
            window.__profilePlaylists = playlists;

            playlistsGrid.innerHTML = playlists.map(playlist => `
                <div class="playlist-card" data-playlist-id="${playlist.id}">
                    <div class="playlist-artwork">
                        <i class="fas fa-music"></i>
                        <button class="playlist-play-btn" type="button" aria-label="Play ${playlist.name}">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                    <div class="playlist-content">
                        <h4>${playlist.name}</h4>
                        <p>${playlist.trackCount || (playlist.tracks?.length || 0)} tracks</p>
                    </div>
                    <div class="playlist-actions">
                        <button class="playlist-action-btn" data-action="edit" title="Edit playlist">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="playlist-action-btn" data-action="delete" title="Delete playlist">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');

            // Setup playlist card listeners
            this.setupPlaylistCardListeners();
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

    setupTrackCardListeners() {
        // Play button listeners
        document.querySelectorAll('#favoritesGrid .track-play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.track-card');
                const trackIndex = parseInt(card.dataset.track);
                const track = window.__profileTracks[trackIndex];
                
                if (track && window.persistentPlayer) {
                    window.persistentPlayer.loadTrack(track);
                    window.persistentPlayer.play();
                }
            });
        });

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
                    e.target.closest('.spotify-indicator')) {
                    return;
                }
                const trackId = card.dataset.trackId;
                if (trackId) {
                    window.location.href = `track-detail.html?id=${trackId}`;
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
                    const firstTrack = playlist.tracks[0];
                    if (window.persistentPlayer) {
                        window.persistentPlayer.loadTrack(firstTrack);
                        window.persistentPlayer.play();
                        this.showNotification(`Playing ${playlist.name}`, 'success');
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

        // Card click - navigate to playlist detail (or could open edit modal)
        document.querySelectorAll('#playlistsGrid .playlist-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.playlist-play-btn') || 
                    e.target.closest('.playlist-action-btn')) {
                    return;
                }
                const playlistId = card.dataset.playlistId;
                // For now, open edit modal on card click
                const playlist = window.__profilePlaylists?.find(p => p.id === playlistId);
                if (playlist) {
                    const newName = prompt('Edit playlist name:', playlist.name);
                    if (newName && newName.trim()) {
                        this.updatePlaylistName(playlistId, newName.trim());
                    }
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
