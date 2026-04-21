// music-data.js
class MusicDataRenderer {
    constructor() {
        this.dataManager = window.dataManager;
        this.init();
    }

    init() {
        this.renderMusicGrid();
        this.setupEventListeners();

        // Listen for data updates from admin panel
        window.addEventListener('dataUpdated', () => {
            this.renderMusicGrid();
        });

        // Execute any pending action after login
        setTimeout(() => this.executePendingAction(), 500);
    }

    // Helper to escape HTML
    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    renderMusicGrid() {
        const container = document.getElementById('musicGrid');
        if (!container) return;

        const tracks = this.dataManager.getPublishedTracks();

        // Populate window.__tracks for audio player compatibility (same as music-page.js)
        window.__tracks = tracks.map((track) => {
            const artist = this.dataManager.getArtist(track.artist);
            return {
                ...track,
                artistName: artist?.name || track.artistName || 'Unknown Artist'
            };
        });

        container.innerHTML = tracks.map((track, index) => {
            const artist = this.dataManager.getArtist(track.artist);
            const categories = this.getTrackCategories(track);
            const badge = this.getTrackBadge(track);
            const spotifyUrl = track.spotifyUrl || (track.platformLinks?.spotify) || '';

            return `
                <div class="track-card" data-track="${index}" data-category="${categories.join(' ')}" data-spotify-url="${spotifyUrl}" data-track-id="${track.id || ''}">
                    <div class="track-artwork">
                        <img src="${this.escapeHtml(track.artwork)}" alt="${this.escapeHtml(track.title)}">
                        ${badge ? `<div class="track-badge ${badge.type}">${badge.text}</div>` : ''}
                        ${spotifyUrl ? '<div class="spotify-indicator" title="Listen on Spotify"><i class="fab fa-spotify"></i></div>' : ''}
                        <button class="track-play-btn" aria-label="Play ${this.escapeHtml(track.title)}" type="button">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                    <div class="track-content">
                        <div class="track-header">
                            <div class="track-info">
                                <h4 class="track-title">${this.escapeHtml(track.title)}</h4>
                                <p class="track-artist">${this.escapeHtml(artist?.name || track.artistName || 'Unknown Artist')}</p>
                            </div>
                            <button class="like-btn-mini" title="Like" data-like-track-id="${track.id}" type="button">
                                <i class="far fa-heart"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Update results count
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) {
            resultsCount.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;
        }

        // Dispatch event for loading skeleton to hide
        document.dispatchEvent(new CustomEvent('music:loaded'));
    }

    getTrackCategories(track) {
        const categories = ['all'];
        if (track.featured) categories.push('featured');
        if (track.categories) categories.push(...track.categories);
        
        // Auto-categorize based on streams and release date
        if (track.streams > 50000) categories.push('popular');
        if (track.streams > 100000) categories.push('trending');
        
        const releaseDate = new Date(track.releaseDate);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (releaseDate > thirtyDaysAgo) categories.push('new');
        
        return categories;
    }

    getTrackBadge(track) {
        if (track.streams > 100000) return { type: 'trending', text: 'Trending' };
        if (track.streams > 50000) return { type: 'popular', text: 'Popular' };
        
        const releaseDate = new Date(track.releaseDate);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (releaseDate > thirtyDaysAgo) return { type: 'new-release', text: 'New' };
        
        return null;
    }

    toggleLike(trackId, btn = null) {
        // Check if user is authenticated
        if (!this.isUserAuthenticated()) {
            // Store pending action for after login
            this.storePendingAction('like', { trackId });
            this.redirectToAuth();
            return;
        }

        // User is authenticated, proceed with like action
        if (btn) {
            this.toggleLikeButton(btn);
        }
        // Also update the data model
        const track = this.dataManager.getTrack(trackId);
        if (track) {
            track.likes = (track.likes || 0) + 1;
            this.dataManager.saveTrack(track);
            this.renderMusicGrid();
        }
    }

    toggleLikeButton(btn) {
        const icon = btn.querySelector('i');
        if (icon.classList.contains('far')) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            btn.classList.add('liked');
        } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
            btn.classList.remove('liked');
        }
    }

    executePendingAction() {
        this.checkLoginCancelled();

        const pendingActionStr = sessionStorage.getItem('pendingAction');
        if (!pendingActionStr) return;

        try {
            const pendingAction = JSON.parse(pendingActionStr);

            switch (pendingAction.type) {
                case 'like':
                    this.handleLikeAfterLogin(pendingAction.data.trackId);
                    break;
                case 'addToPlaylist':
                    this.handleAddToPlaylistAfterLogin(pendingAction.data.trackData);
                    break;
                default:
                    console.warn('[MusicData] Unknown pending action type:', pendingAction.type);
            }

            // Clear pending action after attempting to execute
            sessionStorage.removeItem('pendingAction');
        } catch (e) {
            console.error('[MusicData] Error executing pending action:', e);
            sessionStorage.removeItem('pendingAction');
        }
    }

    checkLoginCancelled() {
        const loginCancelled = sessionStorage.getItem('loginCancelled');
        if (loginCancelled === 'true') {
            sessionStorage.removeItem('loginCancelled');
            sessionStorage.removeItem('pendingAction');
            this.showNotification('Action cancelled. Please log in to like or add tracks to your playlist.', 'info');
        }
    }

    handleLikeAfterLogin(trackId) {
        // Find the button for this track
        const btn = document.querySelector(`.like-btn-mini[data-like-track-id="${trackId}"]`);
        if (btn) {
            this.toggleLikeButton(btn);
        }
        // TODO: Call your backend API to like the track
        console.log('[MusicData] Liked track after login:', trackId);
    }

    handleAddToPlaylistAfterLogin(trackData) {
        // TODO: Call your backend API to add track to playlist
        console.log('[MusicData] Added to playlist after login:', trackData.title);
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            font-weight: 500;
            max-width: 300px;
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    isUserAuthenticated() {
        if (typeof window.auth !== 'undefined' && window.auth.currentUser) {
            return true;
        }
        const user = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
        return user !== null;
    }

    storePendingAction(actionType, actionData) {
        const pendingAction = {
            type: actionType,
            data: actionData,
            timestamp: Date.now(),
            returnUrl: window.location.pathname
        };
        sessionStorage.setItem('pendingAction', JSON.stringify(pendingAction));
        console.log('[MusicData] Stored pending action:', pendingAction);
    }

    redirectToAuth() {
        const currentUrl = window.location.href;
        const authUrl = `auth.html?redirect=${encodeURIComponent(currentUrl)}`;
        window.location.href = authUrl;
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.currentTarget.getAttribute('data-filter');
                this.applyFilter(filter);
            });
        });

        // Search functionality
        const searchInput = document.getElementById('musicSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // Play button listeners - plays track on all devices
        document.querySelectorAll('.track-play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.track-card');
                const trackIndex = parseInt(card.dataset.track);
                const track = window.__tracks[trackIndex];
                if (track) {
                    this.handlePlayTrack(track);
                }
            });
        });

        // Card click listeners - navigate to detail page on all devices
        document.querySelectorAll('.track-card').forEach(card => {
            if (card._clickHandler) {
                card.removeEventListener('click', card._clickHandler);
            }
            
            card._clickHandler = (e) => {
                // Don't navigate if clicking on play button, like button, or spotify indicator
                if (e.target.closest('.track-play-btn') || 
                    e.target.closest('.like-btn-mini') || 
                    e.target.closest('.spotify-indicator')) {
                    return;
                }
                const trackId = card.dataset.trackId;
                if (trackId) {
                    window.location.href = `track-detail.html?id=${trackId}`;
                }
            };
            card.addEventListener('click', card._clickHandler);
        });

        // Like button listeners
        document.querySelectorAll('.like-btn-mini[data-like-track-id]').forEach(btn => {
            if (btn._likeHandler) {
                btn.removeEventListener('click', btn._likeHandler);
            }
            btn._likeHandler = (e) => {
                e.stopPropagation();
                const trackId = btn.dataset.likeTrackId;
                this.toggleLike(trackId, btn);
            };
            btn.addEventListener('click', btn._likeHandler);
        });

        // Spotify indicator click
        document.querySelectorAll('.spotify-indicator').forEach(indicator => {
            if (indicator._spotifyHandler) {
                indicator.removeEventListener('click', indicator._spotifyHandler);
            }
            indicator._spotifyHandler = (e) => {
                e.stopPropagation();
                const card = indicator.closest('.track-card');
                const spotifyUrl = card.dataset.spotifyUrl;
                if (spotifyUrl) {
                    window.open(spotifyUrl, '_blank');
                }
            };
            indicator.addEventListener('click', indicator._spotifyHandler);
        });
    }

    handlePlayTrack(track) {
        console.log('[MusicData] Playing track:', track.title);

        // Use persistent floating player for all tracks
        if (window.persistentPlayer) {
            // Build full playlist from all tracks if not set
            if (window.persistentPlayer.playlist.length === 0 && window.__tracks?.length > 0) {
                const fullPlaylist = window.__tracks.map(t => ({
                    id: t.id,
                    title: t.title,
                    artistName: t.artistName,
                    artwork: t.artwork,
                    audioUrl: t.audioUrl,
                    platformLinks: t.platformLinks || {},
                    originalData: t
                }));
                window.persistentPlayer.setPlaylist(fullPlaylist, 0);
            }
            
            // Find track index in playlist
            const existingIndex = window.persistentPlayer.playlist.findIndex(t => t.id === track.id);
            if (existingIndex !== -1) {
                window.persistentPlayer.currentIndex = existingIndex;
                window.persistentPlayer.loadTrack(window.persistentPlayer.playlist[existingIndex]);
            } else {
                // Track not in playlist, add it
                window.persistentPlayer.playlist.push({
                    id: track.id,
                    title: track.title,
                    artistName: track.artistName,
                    artwork: track.artwork,
                    audioUrl: track.audioUrl,
                    platformLinks: track.platformLinks || {},
                    originalData: track
                });
                window.persistentPlayer.currentIndex = window.persistentPlayer.playlist.length - 1;
                window.persistentPlayer.loadTrack(track);
            }
            
            // For audio files, also sync with main audio player if available
            if (track.audioUrl && track.audioUrl.trim() !== '' && window.audioPlayer) {
                window.audioPlayer.loadTrackByData(track.id);
            }
            
            window.persistentPlayer.play();
        } else {
            console.error('[MusicData] Persistent player not available');
        }
    }

    handleShareTrack(track) {
        console.log('[MusicData] Sharing track:', track.title);

        const shareData = {
            title: track.title,
            text: `Listen to ${track.title} by ${track.artistName || 'Unknown Artist'}`,
            url: window.location.href
        };

        if (navigator.share) {
            navigator.share(shareData).catch(console.error);
        } else {
            const shareText = `${shareData.text} - ${shareData.url}`;
            navigator.clipboard.writeText(shareText).then(() => {
                alert('Link copied to clipboard!');
            }).catch(() => {
                prompt('Copy this link:', shareText);
            });
        }
    }

    handleAddToPlaylist(track) {
        console.log('[MusicData] Adding to playlist:', track.title);

        if (!this.isUserAuthenticated()) {
            this.storePendingAction('addToPlaylist', { trackId: track.id, trackData: track });
            this.redirectToAuth();
            return;
        }

        console.log('[MusicData] User authenticated, proceeding with add to playlist action');
    }

    openExternalPlayer(url, track = null) {
        // Show notification if persistent player available
        if (window.persistentPlayer) {
            window.persistentPlayer.showNotification(`Opening "${track?.title || 'track'}" in external player`, 'info');
        }
        // Open in new tab instead of popup
        window.open(url, '_blank');
    }

    applyFilter(filter) {
        const tracks = document.querySelectorAll('.track-card');
        tracks.forEach(track => {
            if (filter === 'all' || track.getAttribute('data-category').includes(filter)) {
                track.style.display = 'block';
            } else {
                track.style.display = 'none';
            }
        });

        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
    }

    handleSearch(query) {
        const tracks = document.querySelectorAll('.track-card');
        const lowercaseQuery = query.toLowerCase();
        
        tracks.forEach(track => {
            const title = track.querySelector('.track-title').textContent.toLowerCase();
            const artist = track.querySelector('.track-artist').textContent.toLowerCase();
            
            if (title.includes(lowercaseQuery) || artist.includes(lowercaseQuery)) {
                track.style.display = 'block';
            } else {
                track.style.display = 'none';
            }
        });
    }
}

function initMusicDataRenderer() {
    window.musicData = new MusicDataRenderer();
}

// Initialize music data renderer
document.addEventListener('DOMContentLoaded', function() {
    if (document.querySelector('[data-include]')) return
    initMusicDataRenderer()
});

document.addEventListener('includes:loaded', function() {
    initMusicDataRenderer()
});