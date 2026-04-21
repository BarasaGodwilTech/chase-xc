// Persistent Floating Player - Singleton pattern
// Handles both audio files and external links (YouTube, Spotify, SoundCloud)
class PersistentFloatingPlayer {
    constructor() {
        this.audio = null;
        this.isPlaying = false;
        this.currentTrack = null;
        this.playerElement = null;
        this.videoWindow = null;
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.syncInterval = null;
        this.playlist = [];
        this.currentIndex = 0;
        this.currentPlatform = null; // 'audio', 'youtube', 'spotify', 'soundcloud'
        this.embedContainer = null;
        this.videoVisible = true;
        
        this.init();
    }

    init() {
        this.createPlayerElement();
        this.createVideoWindow();
        this.loadStateFromStorage();
        this.setupEventListeners();
        this.startSyncInterval();
        this.handleVisibilityChange();
    }

    createPlayerElement() {
        // Check if player already exists
        if (document.getElementById('persistentFloatingPlayer')) return;
        
        const playerHTML = `
            <div id="persistentFloatingPlayer" class="persistent-floating-player" style="display: none;">
                <div class="flp-drag-handle">
                    <i class="fas fa-grip-vertical"></i>
                </div>
                <button class="flp-close" id="flpCloseBtn" aria-label="Close player">
                    <i class="fas fa-times"></i>
                </button>
                <div class="flp-content">
                    <div class="flp-artwork">
                        <img id="flpArtwork" src="" alt="Now Playing">
                        <div class="flp-waveform" id="flpWaveform"></div>
                        <button class="flp-video-toggle" id="flpVideoToggle" style="display: none;" title="Toggle Video">
                            <i class="fas fa-video"></i>
                        </button>
                    </div>
                    <div class="flp-info">
                        <h4 id="flpTitle">Select a track</h4>
                        <p id="flpArtist">--</p>
                        <span class="flp-platform-badge" id="flpPlatformBadge" style="display: none;"></span>
                    </div>
                    <div class="flp-controls">
                        <button class="flp-btn" id="flpPrevBtn" aria-label="Previous">
                            <i class="fas fa-step-backward"></i>
                        </button>
                        <button class="flp-btn flp-play-btn" id="flpPlayBtn" aria-label="Play">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="flp-btn" id="flpNextBtn" aria-label="Next">
                            <i class="fas fa-step-forward"></i>
                        </button>
                    </div>
                    <div class="flp-progress-container">
                        <span id="flpCurrentTime" class="flp-time">0:00</span>
                        <div class="flp-progress-bar">
                            <div class="flp-progress-fill" id="flpProgressFill"></div>
                            <input type="range" class="flp-seek" id="flpSeek" min="0" max="100" value="0">
                        </div>
                        <span id="flpDuration" class="flp-time">0:00</span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', playerHTML);
        this.playerElement = document.getElementById('persistentFloatingPlayer');
        this.attachDragEvents();
    }

    createVideoWindow() {
        // Check if video window already exists
        if (document.getElementById('flpVideoWindow')) return;
        
        const videoWindowHTML = `
            <div id="flpVideoWindow" class="flp-video-window" style="display: none;">
                <div class="flp-video-header">
                    <span class="flp-video-title" id="flpVideoTitle">Now Playing</span>
                    <div class="flp-video-actions">
                        <button class="flp-video-btn" id="flpMinimizeVideo" title="Minimize to audio only">
                            <i class="fas fa-compress-alt"></i>
                        </button>
                        <button class="flp-video-btn" id="flpCloseVideo" title="Close video">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="flp-video-content" id="flpVideoContent">
                    <!-- Embed will be inserted here -->
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', videoWindowHTML);
        this.videoWindow = document.getElementById('flpVideoWindow');
        
        // Setup video window event listeners
        const minimizeBtn = document.getElementById('flpMinimizeVideo');
        const closeBtn = document.getElementById('flpCloseVideo');
        
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => this.toggleVideoWindow());
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeVideoWindow());
        }
    }

    toggleVideoWindow() {
        if (!this.videoWindow) return;
        
        this.videoVisible = !this.videoVisible;
        this.videoWindow.style.display = this.videoVisible ? 'block' : 'none';
        
        const toggleBtn = document.getElementById('flpVideoToggle');
        if (toggleBtn) {
            toggleBtn.innerHTML = this.videoVisible ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
        }
    }

    closeVideoWindow() {
        if (this.videoWindow) {
            this.videoWindow.style.display = 'none';
            const content = document.getElementById('flpVideoContent');
            if (content) content.innerHTML = '';
        }
        this.videoVisible = false;
        
        const toggleBtn = document.getElementById('flpVideoToggle');
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
        }
    }

    showVideoWindow() {
        if (this.videoWindow) {
            this.videoWindow.style.display = 'block';
            this.videoVisible = true;
        }
    }

    attachDragEvents() {
        const dragHandle = this.playerElement.querySelector('.flp-drag-handle');
        
        dragHandle.addEventListener('mousedown', (e) => this.startDrag(e));
        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('mouseup', () => this.stopDrag());
        
        // Touch events for mobile
        dragHandle.addEventListener('touchstart', (e) => this.startDrag(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.onDrag(e), { passive: false });
        document.addEventListener('touchend', () => this.stopDrag());
    }

    startDrag(e) {
        this.isDragging = true;
        const rect = this.playerElement.getBoundingClientRect();
        const clientX = e.clientX || e.touches?.[0]?.clientX;
        const clientY = e.clientY || e.touches?.[0]?.clientY;
        
        this.dragOffsetX = clientX - rect.left;
        this.dragOffsetY = clientY - rect.top;
        this.playerElement.style.transition = 'none';
        this.playerElement.classList.add('dragging');
    }

    onDrag(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        
        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }
        
        let left = clientX - this.dragOffsetX;
        let top = clientY - this.dragOffsetY;
        
        // Boundary constraints - avoid WhatsApp button area (bottom-left)
        const minLeft = 10;
        const maxLeft = window.innerWidth - this.playerElement.offsetWidth - 10;
        const minTop = 60;
        const maxTop = window.innerHeight - this.playerElement.offsetHeight - 80;
        
        left = Math.max(minLeft, Math.min(maxLeft, left));
        top = Math.max(minTop, Math.min(maxTop, top));
        
        this.playerElement.style.left = left + 'px';
        this.playerElement.style.top = top + 'px';
        this.playerElement.style.right = 'auto';
        this.playerElement.style.bottom = 'auto';
    }

    stopDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.playerElement.style.transition = '';
        this.playerElement.classList.remove('dragging');
        this.savePosition();
    }

    savePosition() {
        const left = this.playerElement.style.left;
        const top = this.playerElement.style.top;
        if (left && top) {
            localStorage.setItem('floatingPlayerLeft', left);
            localStorage.setItem('floatingPlayerTop', top);
        }
    }

    loadPosition() {
        const left = localStorage.getItem('floatingPlayerLeft');
        const top = localStorage.getItem('floatingPlayerTop');
        if (left && top) {
            this.playerElement.style.left = left;
            this.playerElement.style.top = top;
            this.playerElement.style.right = 'auto';
            this.playerElement.style.bottom = 'auto';
        }
    }

    loadStateFromStorage() {
        const savedState = localStorage.getItem('floatingPlayerState');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                // Restore if saved within last hour
                if (state.track && state.timestamp && Date.now() - state.timestamp < 3600000) {
                    this.currentTrack = state.track;
                    this.playlist = state.playlist || [state.track];
                    this.currentIndex = state.currentIndex || 0;
                    this.updateUI();
                    if (state.isPlaying && state.track.audioUrl) {
                        this.restoreAudio(state);
                    } else {
                        this.show();
                    }
                }
            } catch (e) {
                console.error('[FloatingPlayer] Failed to load player state:', e);
            }
        }
    }

    restoreAudio(state) {
        if (!this.audio) {
            this.audio = new Audio();
            this.setupAudioEvents();
        }
        this.audio.src = state.track.audioUrl;
        this.audio.currentTime = state.currentTime || 0;
        this.audio.load();
        this.show();
        // Auto-play might be blocked, so we just show the player
        // User can click play to resume
        this.updatePlayButton();
    }

    setupAudioEvents() {
        if (!this.audio) return;
        
        this.audio.addEventListener('timeupdate', () => {
            this.updateProgress();
            this.saveProgress();
        });
        
        this.audio.addEventListener('loadedmetadata', () => {
            const durationEl = document.getElementById('flpDuration');
            if (durationEl) durationEl.textContent = this.formatTime(this.audio.duration);
        });
        
        this.audio.addEventListener('ended', () => {
            this.handleTrackEnd();
        });
        
        this.audio.addEventListener('error', (e) => {
            console.error('[FloatingPlayer] Audio error:', e);
        });
    }

    setPlaylist(tracks, startIndex = 0) {
        this.playlist = tracks;
        this.currentIndex = startIndex;
        if (tracks.length > 0) {
            this.loadTrack(tracks[startIndex]);
        }
    }

    loadTrack(track) {
        if (!track) return;
        
        this.currentTrack = track;
        this.closeVideoWindow();
        
        // Detect platform and get URL
        const { platform, url } = this.detectPlatform(track);
        this.currentPlatform = platform;
        
        if (platform === 'audio' && url) {
            // Direct audio file
            this.loadAudioFile(track, url);
        } else if (platform === 'youtube') {
            // YouTube - show video window
            this.loadYouTubeEmbed(track, url);
        } else if (platform === 'spotify') {
            // Spotify embed
            this.loadSpotifyEmbed(track, url);
        } else if (platform === 'soundcloud') {
            // SoundCloud embed
            this.loadSoundCloudEmbed(track, url);
        } else {
            this.showNotification('No playable source found', 'warning');
        }
    }

    detectPlatform(track) {
        // Check for direct audio URL first
        if (track.audioUrl && track.audioUrl.trim() !== '') {
            return { platform: 'audio', url: track.audioUrl };
        }
        
        // Check platform links
        const links = track.platformLinks || {};
        
        // YouTube
        const youtubeUrl = track.youtubeUrl || links.youtube || '';
        if (youtubeUrl) {
            return { platform: 'youtube', url: youtubeUrl };
        }
        
        // Spotify
        const spotifyUrl = track.spotifyUrl || links.spotify || '';
        if (spotifyUrl) {
            return { platform: 'spotify', url: spotifyUrl };
        }
        
        // SoundCloud
        const soundcloudUrl = track.soundcloudUrl || links.soundcloud || '';
        if (soundcloudUrl) {
            return { platform: 'soundcloud', url: soundcloudUrl };
        }
        
        return { platform: null, url: null };
    }

    loadAudioFile(track, url) {
        if (!this.audio) {
            this.audio = new Audio();
            this.setupAudioEvents();
        }
        
        this.audio.src = url;
        this.audio.load();
        this.updateUI('audio');
        this.show();
        this.saveState();
        
        // Hide video toggle for audio files
        const toggleBtn = document.getElementById('flpVideoToggle');
        if (toggleBtn) toggleBtn.style.display = 'none';
    }

    loadYouTubeEmbed(track, url) {
        const videoId = this.extractYouTubeId(url);
        if (!videoId) {
            this.showNotification('Invalid YouTube URL', 'error');
            return;
        }
        
        this.updateUI('youtube');
        this.show();
        
        // Show video toggle button
        const toggleBtn = document.getElementById('flpVideoToggle');
        if (toggleBtn) {
            toggleBtn.style.display = 'flex';
            toggleBtn.innerHTML = '<i class="fas fa-video"></i>';
        }
        
        // Create YouTube embed in video window
        const videoContent = document.getElementById('flpVideoContent');
        const videoTitle = document.getElementById('flpVideoTitle');
        
        if (videoContent) {
            videoContent.innerHTML = `
                <iframe 
                    id="flpYouTubeEmbed"
                    src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&origin=${window.location.origin}"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                ></iframe>
            `;
        }
        
        if (videoTitle) {
            videoTitle.textContent = track.title || 'Now Playing';
        }
        
        this.showVideoWindow();
        this.isPlaying = true;
        this.updatePlayButton();
        this.saveState();
    }

    loadSpotifyEmbed(track, url) {
        const spotifyUri = this.extractSpotifyUri(url);
        if (!spotifyUri) {
            this.showNotification('Invalid Spotify URL', 'error');
            return;
        }
        
        this.updateUI('spotify');
        this.show();
        
        // Hide video toggle for Spotify
        const toggleBtn = document.getElementById('flpVideoToggle');
        if (toggleBtn) toggleBtn.style.display = 'none';
        
        // Create Spotify embed in video window (treated as audio player)
        const videoContent = document.getElementById('flpVideoContent');
        const videoTitle = document.getElementById('flpVideoTitle');
        
        if (videoContent) {
            videoContent.innerHTML = `
                <iframe 
                    id="flpSpotifyEmbed"
                    src="https://open.spotify.com/embed/${spotifyUri}?utm_source=generator&theme=0"
                    frameborder="0"
                    allowfullscreen=""
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                ></iframe>
            `;
        }
        
        if (videoTitle) {
            videoTitle.textContent = track.title || 'Now Playing';
        }
        
        this.showVideoWindow();
        this.isPlaying = true;
        this.updatePlayButton();
        this.saveState();
    }

    loadSoundCloudEmbed(track, url) {
        this.updateUI('soundcloud');
        this.show();
        
        // Hide video toggle for SoundCloud
        const toggleBtn = document.getElementById('flpVideoToggle');
        if (toggleBtn) toggleBtn.style.display = 'none';
        
        // Create SoundCloud embed in video window
        const videoContent = document.getElementById('flpVideoContent');
        const videoTitle = document.getElementById('flpVideoTitle');
        
        if (videoContent) {
            videoContent.innerHTML = `
                <iframe 
                    id="flpSoundCloudEmbed"
                    src="https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%231db954&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true"
                    frameborder="0"
                    allow="autoplay"
                ></iframe>
            `;
        }
        
        if (videoTitle) {
            videoTitle.textContent = track.title || 'Now Playing';
        }
        
        this.showVideoWindow();
        this.isPlaying = true;
        this.updatePlayButton();
        this.saveState();
    }

    extractYouTubeId(url) {
        if (!url) return null;
        
        // Handle various YouTube URL formats
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        
        return null;
    }

    extractSpotifyUri(url) {
        if (!url) return null;
        
        // Handle Spotify URL formats
        // https://open.spotify.com/track/xxx -> track/xxx
        // https://open.spotify.com/album/xxx -> album/xxx
        const match = url.match(/spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/);
        if (match) {
            return `${match[1]}/${match[2]}`;
        }
        
        return null;
    }

    updateUI(platform = null) {
        if (!this.currentTrack) return;
        
        const titleEl = document.getElementById('flpTitle');
        const artistEl = document.getElementById('flpArtist');
        const artworkEl = document.getElementById('flpArtwork');
        const badgeEl = document.getElementById('flpPlatformBadge');
        
        if (titleEl) titleEl.textContent = this.currentTrack.title || 'Select a track';
        if (artistEl) artistEl.textContent = this.currentTrack.artistName || this.currentTrack.artist || '--';
        if (artworkEl && this.currentTrack.artwork) {
            artworkEl.src = this.currentTrack.artwork;
            artworkEl.alt = this.currentTrack.title;
        }
        
        // Show platform badge
        if (badgeEl && platform && platform !== 'audio') {
            badgeEl.style.display = 'inline-flex';
            badgeEl.className = `flp-platform-badge flp-badge-${platform}`;
            badgeEl.innerHTML = this.getPlatformIcon(platform);
        } else if (badgeEl) {
            badgeEl.style.display = 'none';
        }
    }

    getPlatformIcon(platform) {
        const icons = {
            youtube: '<i class="fab fa-youtube"></i> YouTube',
            spotify: '<i class="fab fa-spotify"></i> Spotify',
            soundcloud: '<i class="fab fa-soundcloud"></i> SoundCloud'
        };
        return icons[platform] || '';
    }

    play() {
        // Handle embeds (YouTube, Spotify, SoundCloud)
        if (this.currentPlatform && this.currentPlatform !== 'audio') {
            // For embeds, we can't control playback directly
            // Just update UI state - the embed handles its own playback
            this.isPlaying = true;
            this.updatePlayButton();
            this.animateWaveform(true);
            return;
        }
        
        // Handle audio files
        if (!this.audio) {
            this.showNotification('No track loaded', 'warning');
            return;
        }
        
        this.audio.play().then(() => {
            this.isPlaying = true;
            this.updatePlayButton();
            this.saveState();
            this.animateWaveform(true);
        }).catch(err => {
            console.error('[FloatingPlayer] Play error:', err);
            // Show play button so user can interact
            this.updatePlayButton();
        });
    }

    pause() {
        // Handle embeds
        if (this.currentPlatform && this.currentPlatform !== 'audio') {
            this.isPlaying = false;
            this.updatePlayButton();
            this.animateWaveform(false);
            return;
        }
        
        // Handle audio files
        if (this.audio) {
            this.audio.pause();
            this.isPlaying = false;
            this.updatePlayButton();
            this.saveState();
            this.animateWaveform(false);
        }
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    updatePlayButton() {
        const playBtn = document.getElementById('flpPlayBtn');
        if (playBtn) {
            playBtn.innerHTML = this.isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
            playBtn.setAttribute('aria-label', this.isPlaying ? 'Pause' : 'Play');
        }
    }

    updateProgress() {
        if (!this.audio || !this.audio.duration) return;
        
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        const fillEl = document.getElementById('flpProgressFill');
        const seekEl = document.getElementById('flpSeek');
        const currentTimeEl = document.getElementById('flpCurrentTime');
        
        if (fillEl) fillEl.style.width = progress + '%';
        if (seekEl) seekEl.value = progress;
        if (currentTimeEl) currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
    }

    seek(percentage) {
        if (this.audio && this.audio.duration) {
            this.audio.currentTime = (percentage / 100) * this.audio.duration;
        }
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    show() {
        if (this.playerElement) {
            this.playerElement.style.display = 'block';
            this.loadPosition();
        }
    }

    hide() {
        if (this.playerElement) {
            this.playerElement.style.display = 'none';
        }
    }

    close() {
        this.pause();
        if (this.audio) {
            this.audio.src = '';
        }
        this.closeVideoWindow();
        this.currentTrack = null;
        this.currentPlatform = null;
        this.isPlaying = false;
        this.hide();
        localStorage.removeItem('floatingPlayerState');
    }

    saveState() {
        if (!this.currentTrack) return;
        
        const state = {
            track: this.currentTrack,
            playlist: this.playlist,
            currentIndex: this.currentIndex,
            isPlaying: this.isPlaying,
            currentTime: this.audio?.currentTime || 0,
            timestamp: Date.now()
        };
        localStorage.setItem('floatingPlayerState', JSON.stringify(state));
    }

    saveProgress() {
        if (!this.currentTrack || !this.audio) return;
        const state = JSON.parse(localStorage.getItem('floatingPlayerState') || '{}');
        if (state.track) {
            state.currentTime = this.audio.currentTime;
            state.timestamp = Date.now();
            localStorage.setItem('floatingPlayerState', JSON.stringify(state));
        }
    }

    startSyncInterval() {
        this.syncInterval = setInterval(() => {
            if (this.isPlaying) {
                this.saveState();
            }
        }, 5000);
    }

    handleVisibilityChange() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isPlaying && this.audio && this.audio.paused) {
                this.audio.play().catch(console.error);
            }
        });
    }

    setupEventListeners() {
        const playBtn = document.getElementById('flpPlayBtn');
        const prevBtn = document.getElementById('flpPrevBtn');
        const nextBtn = document.getElementById('flpNextBtn');
        const closeBtn = document.getElementById('flpCloseBtn');
        const seekBar = document.getElementById('flpSeek');
        const videoToggleBtn = document.getElementById('flpVideoToggle');
        
        if (playBtn) playBtn.addEventListener('click', () => this.togglePlay());
        if (prevBtn) prevBtn.addEventListener('click', () => this.prevTrack());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextTrack());
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        if (seekBar) seekBar.addEventListener('input', (e) => this.seek(e.target.value));
        if (videoToggleBtn) videoToggleBtn.addEventListener('click', () => this.toggleVideoWindow());
        
        // Listen for page navigation to persist player
        window.addEventListener('beforeunload', () => {
            this.saveState();
        });
        
        // Listen for track changes from main player
        document.addEventListener('trackChanged', (e) => {
            if (e.detail && e.detail.track) {
                this.syncWithMainPlayer(e.detail.track, e.detail.isPlaying, e.detail.currentTime);
            }
        });
    }

    nextTrack() {
        if (this.playlist.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        const track = this.playlist[this.currentIndex];
        this.loadTrack(track);
        if (this.isPlaying || this.audio) {
            this.play();
        }
    }

    prevTrack() {
        if (this.playlist.length === 0) return;
        // If more than 3 seconds in, restart current track
        if (this.audio && this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            return;
        }
        this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        const track = this.playlist[this.currentIndex];
        this.loadTrack(track);
        if (this.isPlaying || this.audio) {
            this.play();
        }
    }

    handleTrackEnd() {
        this.nextTrack();
    }

    syncWithMainPlayer(track, isPlaying, currentTime) {
        if (track && (!this.currentTrack || this.currentTrack.id !== track.id)) {
            this.loadTrack(track);
        }
        if (isPlaying && !this.isPlaying) {
            this.play();
        } else if (!isPlaying && this.isPlaying) {
            this.pause();
        }
        if (currentTime && this.audio && Math.abs(this.audio.currentTime - currentTime) > 1) {
            this.audio.currentTime = currentTime;
        }
    }

    animateWaveform(active) {
        const waveform = document.getElementById('flpWaveform');
        if (!waveform) return;
        
        if (active) {
            waveform.innerHTML = '';
            for (let i = 0; i < 20; i++) {
                const bar = document.createElement('div');
                bar.className = 'waveform-bar';
                bar.style.animationDelay = `${i * 0.05}s`;
                waveform.appendChild(bar);
            }
        } else {
            waveform.innerHTML = '';
        }
    }

    showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (window.musicData && window.musicData.showNotification) {
            window.musicData.showNotification(message, type);
            return;
        }
        
        // Create simple notification
        const notification = document.createElement('div');
        notification.className = `flp-notification flp-notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'warning' ? '#f59e0b' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            z-index: 10001;
            animation: slideIn 0.3s ease-out;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize persistent player when DOM is ready
let persistentPlayer = null;

function initPersistentPlayer() {
    if (!persistentPlayer) {
        persistentPlayer = new PersistentFloatingPlayer();
        window.persistentPlayer = persistentPlayer;
    }
}

// Initialize on DOMContentLoaded or immediately if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPersistentPlayer);
} else {
    initPersistentPlayer();
}

// Re-initialize after includes are loaded
document.addEventListener('includes:loaded', initPersistentPlayer);
