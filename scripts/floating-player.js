// Persistent Floating Player - Singleton pattern
// Handles both audio files and external links (YouTube, Spotify, SoundCloud)
class PersistentFloatingPlayer {
    constructor() {
        this.audio = null;
        this.isPlaying = false;
        this.currentTrack = null;
        this.playerElement = null;
        this.videoWindow = null;
        this._abortController = null;
        this.isDragging = false;
        this.wasDragged = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.syncInterval = null;
        this.playlist = [];
        this.currentIndex = 0;
        this.currentPlatform = null; // 'audio', 'youtube', 'youtubemusic', 'spotify', 'soundcloud'
        this.embedContainer = null;
        this.videoVisible = true;
        this.isCollapsed = false;
        this.isMobile = window.innerWidth <= 480;
        this.isShuffled = false;
        this.repeatMode = 'none'; // 'none', 'one', 'all'

        this._streamTimer = null;
        this._streamCountedForTrackId = null;
        
        this.init();
    }

    normalizeArtistLine(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';

        const parts = raw
            .split(/\s*(?:&|•|\+|,|\/|\bfeat\.?\b|\bft\.?\b|\bx\b)\s*/i)
            .map((p) => String(p || '').trim())
            .filter((p) => p && p.toLowerCase() !== 'unknown artist');

        const out = [];
        const seen = new Set();
        for (const p of parts) {
            const key = p.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(p);
        }
        return out.join(' & ');
    }

    init() {
        this.createPlayerElement();
        this.createVideoWindow();
        this.loadStateFromStorage();
        this.setupEventListeners();
        this.startSyncInterval();
        this.handleVisibilityChange();
        
        // Listen for resize to update mobile state and reposition video
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth <= 480;
            // Reposition video window on resize
            if (this.videoVisible && this.videoWindow) {
                this.positionVideoWindow();
            }
        });
    }

    rebind() {
        this.createPlayerElement();
        this.createVideoWindow();
        this.setupEventListeners();
        this.updatePlayButton();
    }

    createPlayerElement() {
        // Check if player already exists
        if (document.getElementById('persistentFloatingPlayer')) return;
        
        const playerHTML = `
            <div id="persistentFloatingPlayer" class="persistent-floating-player" style="display: none;">
                <div class="flp-header">
                    <div class="flp-drag-handle">
                        <i class="fas fa-grip-vertical"></i>
                    </div>
                    <button class="flp-collapse" id="flpCollapseBtn" aria-label="Collapse player">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <button class="flp-close" id="flpCloseBtn" aria-label="Close player">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <!-- Mini thumbnail for collapsed mode -->
                <div class="flp-mini-thumb" id="flpMiniThumb" title="Expand player">
                    <img id="flpMiniArtwork" src="" alt="Now Playing">
                    <div class="play-indicator"><i class="fas fa-play"></i></div>
                </div>
                <div class="flp-content">
                    <div class="flp-artwork">
                        <img id="flpArtwork" src="" alt="Now Playing">
                        <div class="flp-waveform" id="flpWaveform"></div>
                    </div>
                    <!-- Video toggle button below artwork -->
                    <button class="flp-video-toggle" id="flpVideoToggle" style="display: none;" title="Toggle Video">
                        <i class="fas fa-video"></i>
                    </button>
                    <div class="flp-info">
                        <h4 id="flpTitle">Select a track</h4>
                        <p id="flpArtist">--</p>
                        <span class="flp-platform-badge" id="flpPlatformBadge" style="display: none;"></span>
                    </div>
                    <div class="flp-controls">
                        <button class="flp-btn flp-btn-small" id="flpShuffleBtn" aria-label="Shuffle">
                            <i class="fas fa-random"></i>
                        </button>
                        <button class="flp-btn" id="flpPrevBtn" aria-label="Previous">
                            <i class="fas fa-step-backward"></i>
                        </button>
                        <button class="flp-btn flp-play-btn" id="flpPlayBtn" aria-label="Play">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="flp-btn" id="flpNextBtn" aria-label="Next">
                            <i class="fas fa-step-forward"></i>
                        </button>
                        <button class="flp-btn flp-btn-small" id="flpRepeatBtn" aria-label="Repeat">
                            <i class="fas fa-redo"></i>
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
        
        if (this.videoVisible) {
            this.showVideoWindow();
        } else {
            this.closeVideoWindow();
        }
        
        this.updateVideoToggleButton();
        this.saveState();
    }
    
    updateVideoToggleButton() {
        const toggleBtn = document.getElementById('flpVideoToggle');
        if (toggleBtn) {
            if (this.videoVisible) {
                toggleBtn.innerHTML = '<i class="fas fa-video"></i>';
                toggleBtn.classList.add('active');
                toggleBtn.title = 'Hide Video';
            } else {
                toggleBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
                toggleBtn.classList.remove('active');
                toggleBtn.title = 'Show Video';
            }
        }
    }

    closeVideoWindow() {
        if (this.videoWindow) {
            this.videoWindow.style.display = 'none';
            this.videoWindow.classList.remove('visible');
        }
        this.videoVisible = false;
        this.updateVideoToggleButton();
    }

    showVideoWindow() {
        if (this.videoWindow) {
            this.videoWindow.style.display = 'block';
            this.videoVisible = true;
            
            // Position video window above the floating player
            this.positionVideoWindow();
            
            // Reposition again after iframe loads (delayed)
            setTimeout(() => this.positionVideoWindow(), 100);
            setTimeout(() => this.positionVideoWindow(), 500);
            
            // On mobile, add visible class for CSS
            if (this.isMobile) {
                this.videoWindow.classList.add('visible');
            }
        }
        this.updateVideoToggleButton();
    }
    
    positionVideoWindow() {
        if (!this.videoWindow || !this.playerElement) return;
        
        const playerRect = this.playerElement.getBoundingClientRect();
        // Use actual height or default to 16:9 ratio based on width
        let videoHeight = this.videoWindow.offsetHeight;
        if (videoHeight < 50) {
            // If video window hasn't rendered yet, calculate based on 16:9 ratio
            videoHeight = 280 * 9 / 16 + 50; // video width * ratio + header height
        }
        
        // Position video window above the floating player
        const videoBottom = playerRect.top - 10; // 10px gap
        
        this.videoWindow.style.bottom = 'auto';
        this.videoWindow.style.top = `${Math.max(10, videoBottom - videoHeight)}px`;
        this.videoWindow.style.right = `${window.innerWidth - playerRect.right}px`;
        this.videoWindow.style.left = 'auto';
    }

    attachDragEvents() {
        // Disable dragging on mobile completely
        if (this.isMobile) return;
        
        const dragHandle = this.playerElement.querySelector('.flp-drag-handle');
        const miniThumb = document.getElementById('flpMiniThumb');
        
        // Drag handle for expanded mode
        if (dragHandle) {
            dragHandle.addEventListener('mousedown', (e) => this.startDrag(e));
            dragHandle.addEventListener('touchstart', (e) => this.startDrag(e), { passive: false });
        }
        
        // Mini thumbnail is draggable when collapsed
        if (miniThumb) {
            miniThumb.addEventListener('mousedown', (e) => this.startDrag(e));
            miniThumb.addEventListener('touchstart', (e) => this.startDrag(e), { passive: false });
        }
        
        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('mouseup', () => this.stopDrag());
        document.addEventListener('touchmove', (e) => this.onDrag(e), { passive: false });
        document.addEventListener('touchend', () => this.stopDrag());
    }

    startDrag(e) {
        this.isDragging = true;
        this.dragStartPosition = { x: e.clientX || e.touches?.[0]?.clientX, y: e.clientY || e.touches?.[0]?.clientY };
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
        
        // Track end position for movement detection
        this.dragEndPosition = { x: clientX, y: clientY };
        
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
        
        // Reposition video window while dragging
        if (this.videoVisible) {
            this.positionVideoWindow();
        }
    }

    stopDrag() {
        if (!this.isDragging) return;
        
        // Check if there was actual movement (more than 5px)
        const start = this.dragStartPosition || { x: 0, y: 0 };
        const end = this.dragEndPosition || start;
        const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        this.wasDragged = distance > 5;
        
        this.isDragging = false;
        this.playerElement.style.transition = '';
        this.playerElement.classList.remove('dragging');
        this.savePosition();
        
        // Reposition video window after drag
        if (this.videoVisible) {
            this.positionVideoWindow();
        }
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
            
            // Reposition video window after loading position
            if (this.videoVisible) {
                setTimeout(() => this.positionVideoWindow(), 0);
            }
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
                    this.currentPlatform = state.platform || null;
                    this.videoVisible = state.videoVisible !== false;
                    this.isCollapsed = state.isCollapsed || false;
                    this.isShuffled = !!state.isShuffled;
                    this.repeatMode = state.repeatMode || 'none';
                    
                    // Restore based on platform type
                    if (state.platform === 'audio' && state.track.audioUrl) {
                        this.restoreAudio(state);
                    } else if (state.platform && state.platform !== 'audio') {
                        // For embeds, rebuild the iframe so play() can actually control it
                        this.isPlaying = false;
                        this.loadTrack(state.track);

                        if (state.isPlaying) {
                            // Best-effort resume. May be blocked by browser autoplay policy.
                            setTimeout(() => this.play(), 0);
                        } else {
                            this.updatePlayButton();
                            this.saveState();
                        }
                    } else {
                        // Fallback - detect platform from track
                        const { platform } = this.detectPlatform(state.track);
                        this.currentPlatform = platform;
                        this.isPlaying = false;
                        this.loadTrack(state.track);

                        if (state.isPlaying) {
                            // Best-effort resume. May be blocked by browser autoplay policy.
                            setTimeout(() => this.play(), 0);
                        } else {
                            this.updatePlayButton();
                            this.saveState();
                        }
                    }

                    this.updateShuffleRepeatUI();
                    
                    // Restore collapsed state
                    if (this.isCollapsed) {
                        this.playerElement?.classList.add('collapsed');
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
        const desiredTime = typeof state.currentTime === 'number' ? state.currentTime : 0;
        const shouldAutoPlay = !!state.isPlaying;

        const applyTimeAndMaybePlay = () => {
            try {
                if (desiredTime > 0 && isFinite(this.audio.duration) && this.audio.duration > 0) {
                    this.audio.currentTime = Math.min(desiredTime, Math.max(0, this.audio.duration - 0.25));
                } else if (desiredTime > 0) {
                    this.audio.currentTime = desiredTime;
                }
            } catch (_) {}

            if (shouldAutoPlay) {
                this.audio.play().then(() => {
                    this.isPlaying = true;
                    this.updatePlayButton();
                    this.scheduleStreamIncrement();
                    this.dispatchStateChange();
                    this.saveState();
                }).catch(() => {
                    this.isPlaying = false;
                    this.updatePlayButton();
                    this.saveState();
                });
            } else {
                this.isPlaying = false;
                this.updatePlayButton();
                this.saveState();
            }
        };

        if (this.audio.readyState >= 1) {
            applyTimeAndMaybePlay();
        } else {
            this.audio.addEventListener('loadedmetadata', applyTimeAndMaybePlay, { once: true });
        }

        this.audio.load();
        this.updateUI('audio');
        this.show();
        this.updateShuffleRepeatUI();
    }

    updateShuffleRepeatUI() {
        const shuffleBtn = document.getElementById('flpShuffleBtn');
        if (shuffleBtn) {
            shuffleBtn.classList.toggle('active', !!this.isShuffled);
        }

        const repeatBtn = document.getElementById('flpRepeatBtn');
        if (repeatBtn) {
            repeatBtn.classList.toggle('active', this.repeatMode !== 'none');
            if (this.repeatMode === 'one') {
                repeatBtn.innerHTML = '<i class="fas fa-redo"></i><span class="flp-repeat-one">1</span>';
            } else {
                repeatBtn.innerHTML = '<i class="fas fa-redo"></i>';
            }
        }
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
        this.resetStreamTracking();
        this.closeVideoWindow();
        this.isCollapsed = false;
        this.playerElement?.classList.remove('collapsed');
        
        // Detect platform and get URL
        const { platform, url } = this.detectPlatform(track);
        this.currentPlatform = platform;
        
        if (platform === 'audio' && url) {
            // Direct audio file
            this.loadAudioFile(track, url);
        } else if (platform === 'youtubemusic') {
            // YouTube Music - treat as audio (no video window)
            this.loadYouTubeMusicEmbed(track, url);
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

    resetStreamTracking() {
        if (this._streamTimer) {
            clearTimeout(this._streamTimer);
            this._streamTimer = null;
        }
        this._streamCountedForTrackId = null;
    }

    getCurrentTrackId() {
        return this.currentTrack?.id || this.currentTrack?.originalData?.id || null;
    }

    hasRecentlyCountedStream(trackId) {
        try {
            const raw = localStorage.getItem('floatingPlayerStreamDedup');
            if (!raw) return false;
            const s = JSON.parse(raw);
            if (!s || typeof s !== 'object') return false;
            if (s.trackId !== trackId) return false;
            // Dedup within 30 seconds
            return !!s.timestamp && (Date.now() - s.timestamp) < 30 * 1000;
        } catch (_) {
            return false;
        }
    }

    markStreamCounted(trackId) {
        try {
            localStorage.setItem('floatingPlayerStreamDedup', JSON.stringify({
                trackId,
                timestamp: Date.now()
            }));
        } catch (_) {}
    }

    async incrementStreamsForCurrentTrack() {
        const trackId = this.getCurrentTrackId();
        if (!trackId) return;
        if (this._streamCountedForTrackId === trackId) return;
        if (this.hasRecentlyCountedStream(trackId)) return;

        this._streamCountedForTrackId = trackId;
        this.markStreamCounted(trackId);

        try {
            const { incrementTrackStreams } = await import('./user-data.js');
            await incrementTrackStreams(trackId, 1);
        } catch (error) {
            console.error('[FloatingPlayer] Error incrementing streams:', error);
        }
    }

    scheduleStreamIncrement() {
        const trackId = this.getCurrentTrackId();
        if (!trackId) return;
        if (this._streamCountedForTrackId === trackId) return;

        if (this._streamTimer) {
            clearTimeout(this._streamTimer);
        }

        const delayMs = this.currentPlatform === 'audio' ? 15000 : 1000;
        this._streamTimer = setTimeout(() => {
            this._streamTimer = null;
            if (!this.isPlaying) return;
            if (this.getCurrentTrackId() !== trackId) return;
            this.incrementStreamsForCurrentTrack();
        }, delayMs);
    }

    detectPlatform(track) {
        // Check for direct audio URL first
        // Backwards compatibility: historically, some platform links may have been stored in audioUrl.
        if (track.audioUrl && track.audioUrl.trim() !== '') {
            const u = track.audioUrl.trim();

            // If it's a platform link, route to embed player instead of HTML5 audio
            if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(u)) {
                return { platform: 'youtube', url: u };
            }
            if (/^(https?:\/\/)?(open\.)?spotify\.com\//i.test(u)) {
                return { platform: 'spotify', url: u };
            }
            if (/^(https?:\/\/)?(www\.)?soundcloud\.com\//i.test(u)) {
                return { platform: 'soundcloud', url: u };
            }

            // Treat as direct audio only if it looks like an actual audio file URL
            if (/\.(mp3|wav|ogg|m4a|aac)(\?|#|$)/i.test(u)) {
                return { platform: 'audio', url: u };
            }
        }
        
        // Check platform links
        const links = track.platformLinks || {};
        
        // YouTube Music (treat as audio - no video window)
        const youtubeMusicUrl = track.youtubeMusicUrl || links.youtubeMusic || '';
        if (youtubeMusicUrl) {
            return { platform: 'youtubemusic', url: youtubeMusicUrl };
        }
        
        // YouTube (show video window)
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
        
        // Create YouTube embed in video window with ad-blocking parameters
        const videoContent = document.getElementById('flpVideoContent');
        const videoTitle = document.getElementById('flpVideoTitle');
        
        if (videoContent) {
            // Embed parameters to minimize ads and UI elements
            // - modestbranding=1: Hide YouTube logo
            // - rel=0: Hide related videos
            // - iv_load_policy=3: Hide annotations
            // - fs=0: Disable fullscreen button
            // - controls=0: Hide player controls
            // - disablekb=1: Disable keyboard controls
            // - playsinline=1: Play inline on mobile
            videoContent.innerHTML = `
                <iframe 
                    id="flpYouTubeEmbed"
                    src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&origin=${window.location.origin}&modestbranding=1&rel=0&iv_load_policy=3&fs=0&controls=0&disablekb=1&playsinline=1"
                    frameborder="0"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                ></iframe>
            `;
        }
        
        if (videoTitle) {
            videoTitle.textContent = track.title || 'Now Playing';
        }
        
        // Show video toggle button for YouTube (including mobile)
        if (toggleBtn) {
            toggleBtn.style.display = 'flex';
        }
        
        // On mobile, video is closed by default - user can toggle it
        if (this.isMobile) {
            this.videoVisible = false;
            this.closeVideoWindow();
        } else {
            this.showVideoWindow();
        }
        
        this.updateVideoToggleButton();
        this.isPlaying = true;
        this.updatePlayButton();
        this.saveState();
    }
    
    loadYouTubeMusicEmbed(track, url) {
        // YouTube Music - extract video ID and play as audio-only
        const videoId = this.extractYouTubeId(url);
        if (!videoId) {
            this.showNotification('Invalid YouTube Music URL', 'error');
            return;
        }
        
        this.updateUI('youtubemusic');
        this.show();
        
        // Hide video toggle - YouTube Music is audio-only
        const toggleBtn = document.getElementById('flpVideoToggle');
        if (toggleBtn) toggleBtn.style.display = 'none';
        
        // Create hidden iframe for audio playback (no video window)
        const videoContent = document.getElementById('flpVideoContent');
        
        if (videoContent) {
            videoContent.innerHTML = `
                <iframe 
                    id="flpYouTubeMusicEmbed"
                    src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&origin=${window.location.origin}&modestbranding=1&rel=0&iv_load_policy=3&fs=0&controls=0&disablekb=1"
                    frameborder="0"
                    allow="accelerometer; autoplay; encrypted-media"
                    sandbox="allow-scripts allow-same-origin"
                    style="position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;"
                ></iframe>
            `;
        }
        
        // Explicitly close video window for YouTube Music
        this.closeVideoWindow();
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
        
        // Don't show video window for Spotify - it's audio only
        this.videoVisible = false;
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
        
        // Don't show video window for SoundCloud - it's audio only
        this.videoVisible = false;
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
        const miniArtworkEl = document.getElementById('flpMiniArtwork');
        const badgeEl = document.getElementById('flpPlatformBadge');
        
        if (titleEl) titleEl.textContent = this.currentTrack.title || 'Select a track';
        if (artistEl) {
            const rawArtist = this.currentTrack.artistName || this.currentTrack.artist || '--';
            const normalized = this.normalizeArtistLine(rawArtist);
            artistEl.textContent = normalized || rawArtist;
        }
        
        // Set main artwork
        if (artworkEl && this.currentTrack.artwork) {
            artworkEl.src = this.currentTrack.artwork;
            artworkEl.alt = this.currentTrack.title;
        }
        
        // Set mini thumbnail artwork
        if (miniArtworkEl && this.currentTrack.artwork) {
            miniArtworkEl.src = this.currentTrack.artwork;
            miniArtworkEl.alt = this.currentTrack.title;
        }
        
        // Show platform badge
        if (badgeEl && platform && platform !== 'audio' && platform !== 'youtubemusic') {
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
            youtubemusic: '<i class="fab fa-youtube"></i> YouTube Music',
            spotify: '<i class="fab fa-spotify"></i> Spotify',
            soundcloud: '<i class="fab fa-soundcloud"></i> SoundCloud'
        };
        return icons[platform] || '';
    }
    
    sendYouTubeCommand(command) {
        const iframe = document.getElementById('flpYouTubeEmbed') || document.getElementById('flpYouTubeMusicEmbed');
        if (!iframe || !iframe.contentWindow) return;
        
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: command
        }), 'https://www.youtube.com');
    }

    attemptYouTubePlay(retries = 6) {
        if (this.currentPlatform !== 'youtube' && this.currentPlatform !== 'youtubemusic') return;
        const iframe = document.getElementById('flpYouTubeEmbed') || document.getElementById('flpYouTubeMusicEmbed');
        if (!iframe) return;

        let attempt = 0;
        const tick = () => {
            attempt += 1;
            this.sendYouTubeCommand('playVideo');
            if (attempt < retries) {
                setTimeout(tick, 250 + attempt * 250);
            }
        };
        setTimeout(tick, 0);
    }

    play() {
        // Handle embeds (YouTube, Spotify, SoundCloud)
        if (this.currentPlatform && this.currentPlatform !== 'audio') {
            // Check if embed needs to be loaded (after page navigation)
            const videoContent = document.getElementById('flpVideoContent');
            if (!videoContent || !videoContent.innerHTML.trim()) {
                // Reload the embed
                const { url } = this.detectPlatform(this.currentTrack);
                if (url) {
                    if (this.currentPlatform === 'youtube') {
                        this.loadYouTubeEmbed(this.currentTrack, url);
                    } else if (this.currentPlatform === 'youtubemusic') {
                        this.loadYouTubeMusicEmbed(this.currentTrack, url);
                    } else if (this.currentPlatform === 'spotify') {
                        this.loadSpotifyEmbed(this.currentTrack, url);
                    } else if (this.currentPlatform === 'soundcloud') {
                        this.loadSoundCloudEmbed(this.currentTrack, url);
                    }
                }
            }
            
            // Control YouTube embed via postMessage API
            if (this.currentPlatform === 'youtube' || this.currentPlatform === 'youtubemusic') {
                this.attemptYouTubePlay();
            }
            
            this.isPlaying = true;
            this.updatePlayButton();
            this.animateWaveform(true);
            this.dispatchStateChange();
            return;
        }
        
        // Handle audio files
        if (!this.audio) {
            // Try to restore audio if we have a track
            if (this.currentTrack && this.currentTrack.audioUrl) {
                this.audio = new Audio();
                this.setupAudioEvents();
                this.audio.src = this.currentTrack.audioUrl;
                this.audio.load();
            } else {
                this.showNotification('No track loaded', 'warning');
                return;
            }
        }
        
        this.audio.play().then(() => {
            this.isPlaying = true;
            this.updatePlayButton();
            this.saveState();
            this.animateWaveform(true);
            this.scheduleStreamIncrement();
            this.dispatchStateChange();
        }).catch(err => {
            console.error('[FloatingPlayer] Play error:', err);
            // Show play button so user can interact
            this.updatePlayButton();
        });
    }

    pause() {
        // Handle embeds
        if (this.currentPlatform && this.currentPlatform !== 'audio') {
            // Control YouTube embed via postMessage API
            if (this.currentPlatform === 'youtube' || this.currentPlatform === 'youtubemusic') {
                this.sendYouTubeCommand('pauseVideo');
            }
            this.isPlaying = false;
            this.updatePlayButton();
            this.animateWaveform(false);
            this.dispatchStateChange();
            return;
        }
        
        // Handle audio files
        if (this.audio) {
            this.audio.pause();
            this.isPlaying = false;
            this.updatePlayButton();
            this.saveState();
            this.animateWaveform(false);
            this.resetStreamTracking();
            this.dispatchStateChange();
        }
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    dispatchStateChange() {
        if (!this.currentTrack) return;
        
        document.dispatchEvent(new CustomEvent('floatingPlayerStateChanged', {
            detail: {
                track: this.currentTrack,
                isPlaying: this.isPlaying,
                currentTime: this.audio?.currentTime || 0,
                platform: this.currentPlatform,
                isShuffled: this.isShuffled,
                repeatMode: this.repeatMode
            }
        }));
    }

    updatePlayButton() {
        const playBtn = document.getElementById('flpPlayBtn');
        if (playBtn) {
            playBtn.innerHTML = this.isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
            playBtn.setAttribute('aria-label', this.isPlaying ? 'Pause' : 'Play');
        }
        
        // Update mini thumbnail play indicator
        const playIndicator = document.querySelector('.flp-mini-thumb .play-indicator i');
        if (playIndicator) {
            playIndicator.className = this.isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
    }
    
    collapse() {
        if (this.isCollapsed) return;
        
        this.isCollapsed = true;
        this.playerElement?.classList.add('collapsed');
        
        // Close video window when collapsing
        if (this.videoVisible) {
            this.closeVideoWindow();
        }
        
        this.saveState();
    }
    
    expand() {
        if (!this.isCollapsed) return;
        
        this.isCollapsed = false;
        this.playerElement?.classList.remove('collapsed');
        
        // Re-open video window if it was visible
        if (this.videoVisible && this.currentPlatform === 'youtube') {
            this.showVideoWindow();
        }
        
        this.saveState();
    }
    
    toggleCollapse() {
        if (this.isCollapsed) {
            this.expand();
        } else {
            this.collapse();
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
        
        // Update progress fill immediately for visual feedback
        const fillEl = document.getElementById('flpProgressFill');
        const seekEl = document.getElementById('flpSeek');
        if (fillEl) fillEl.style.width = percentage + '%';
        if (seekEl) seekEl.value = percentage;
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
        
        // Dispatch event to notify listeners that player has closed
        document.dispatchEvent(new CustomEvent('persistentPlayer:closed', {
            detail: {
                isPlaying: false,
                currentTrack: null
            }
        }));
    }

    saveState() {
        if (!this.currentTrack) return;
        
        const state = {
            track: this.currentTrack,
            playlist: this.playlist,
            currentIndex: this.currentIndex,
            isPlaying: this.isPlaying,
            currentTime: this.audio?.currentTime || 0,
            platform: this.currentPlatform,
            videoVisible: this.videoVisible,
            isCollapsed: this.isCollapsed,
            isShuffled: this.isShuffled,
            repeatMode: this.repeatMode,
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
        if (this._abortController) {
            this._abortController.abort();
        }
        this._abortController = new AbortController();
        const signal = this._abortController.signal;

        const playBtn = document.getElementById('flpPlayBtn');
        const prevBtn = document.getElementById('flpPrevBtn');
        const nextBtn = document.getElementById('flpNextBtn');
        const closeBtn = document.getElementById('flpCloseBtn');
        const seekBar = document.getElementById('flpSeek');
        const videoToggleBtn = document.getElementById('flpVideoToggle');
        const collapseBtn = document.getElementById('flpCollapseBtn');
        const miniThumb = document.getElementById('flpMiniThumb');
        const shuffleBtn = document.getElementById('flpShuffleBtn');
        const repeatBtn = document.getElementById('flpRepeatBtn');
        
        if (playBtn) playBtn.addEventListener('click', () => this.togglePlay(), { signal });
        if (prevBtn) prevBtn.addEventListener('click', () => this.prevTrack(), { signal });
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextTrack(), { signal });
        if (closeBtn) closeBtn.addEventListener('click', () => this.close(), { signal });
        if (seekBar) seekBar.addEventListener('input', (e) => this.seek(e.target.value), { signal });
        if (videoToggleBtn) videoToggleBtn.addEventListener('click', () => this.toggleVideoWindow(), { signal });
        if (collapseBtn) collapseBtn.addEventListener('click', () => this.collapse(), { signal });
        if (miniThumb) {
            // Use pointerup to detect click after potential drag
            miniThumb.addEventListener('pointerup', (e) => {
                // Only expand if there was no significant drag movement
                if (!this.wasDragged) {
                    this.expand();
                }
                this.wasDragged = false;
            }, { signal });
        }
        if (shuffleBtn) shuffleBtn.addEventListener('click', () => this.toggleShuffle(), { signal });
        if (repeatBtn) repeatBtn.addEventListener('click', () => this.toggleRepeat(), { signal });
        
        // Listen for page navigation to persist player
        window.addEventListener('beforeunload', () => {
            this.saveState();
        }, { signal });
        
        // Listen for track changes from main player
        document.addEventListener('trackChanged', (e) => {
            if (e.detail && e.detail.track) {
                this.syncWithMainPlayer(e.detail.track, e.detail.isPlaying, e.detail.currentTime);
            }
        }, { signal });
    }

    nextTrack() {
        if (this.playlist.length === 0) return;
        
        // Handle repeat one
        if (this.repeatMode === 'one') {
            this.loadTrack(this.playlist[this.currentIndex]);
            this.play();
            return;
        }
        
        // Handle shuffle
        if (this.isShuffled) {
            this.currentIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        }
        
        const track = this.playlist[this.currentIndex];
        this.loadTrack(track);
        this.play();
    }

    prevTrack() {
        if (this.playlist.length === 0) return;
        // If more than 3 seconds in, restart current track
        if (this.audio && this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            return;
        }
        
        // Handle shuffle
        if (this.isShuffled) {
            this.currentIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        }
        
        const track = this.playlist[this.currentIndex];
        this.loadTrack(track);
        this.play();
    }

    handleTrackEnd() {
        this.resetStreamTracking();
        // Handle repeat one
        if (this.repeatMode === 'one') {
            if (this.audio) {
                this.audio.currentTime = 0;
                this.play();
            }
            return;
        }
        
        // Handle repeat all - continue playing
        if (this.repeatMode === 'all' || this.currentIndex < this.playlist.length - 1) {
            this.nextTrack();
        } else {
            // End of playlist, stop playing
            this.isPlaying = false;
            this.updatePlayButton();
        }
    }
    
    toggleShuffle() {
        this.isShuffled = !this.isShuffled;
        const shuffleBtn = document.getElementById('flpShuffleBtn');
        if (shuffleBtn) {
            shuffleBtn.classList.toggle('active', this.isShuffled);
        }
        this.dispatchStateChange();
        this.saveState();
    }
    
    toggleRepeat() {
        const modes = ['none', 'all', 'one'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];
        
        const repeatBtn = document.getElementById('flpRepeatBtn');
        if (repeatBtn) {
            repeatBtn.classList.toggle('active', this.repeatMode !== 'none');
            // Update icon for repeat one
            if (this.repeatMode === 'one') {
                repeatBtn.innerHTML = '<i class="fas fa-redo"></i><span class="flp-repeat-one">1</span>';
            } else {
                repeatBtn.innerHTML = '<i class="fas fa-redo"></i>';
            }
        }
        this.dispatchStateChange();
        this.saveState();
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
        return;
    }

    if (typeof persistentPlayer.rebind === 'function') {
        persistentPlayer.rebind();
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

// Re-initialize after BFCache restores a page
window.addEventListener('pageshow', initPersistentPlayer);
