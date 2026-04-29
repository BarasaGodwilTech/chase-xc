// Enhanced Audio Player with Data Integration
class AudioPlayer {
  constructor() {
    this._abortController = null;
    this._saveStateRaf = 0;
    this._pendingRestore = null;

    this.bindElements();

    // Only initialize if audio element exists on the page
    if (!this.audio) return;

    this.isPlaying = false;
    this.currentTrackIndex = 0;
    this.isShuffled = false;
    this.repeatMode = 0; // 0: no repeat, 1: repeat all, 2: repeat one
    this.shuffleHistory = [];
    this.originalTrackOrder = [];
    
    // External player support
    this.isPlayingExternal = false;
    this.externalTrackData = null;
    this.ytPlayer = null;
    this.previousVolume = 70;

    // Use data from dataManager instead of hardcoded tracks
    this.tracks = [];
    this.dataManager = window.dataManager;

    this.init();
  }

  bindElements() {
    this.audio = document.getElementById("audioElement");
    this.playBtn = document.getElementById("playBtn");
    this.prevBtn = document.getElementById("prevBtn");
    this.nextBtn = document.getElementById("nextBtn");
    this.seekBar = document.getElementById("seekBar");
    this.volumeControl = document.getElementById("volumeControl");
    this.progressBar = document.getElementById("progressBar");
    this.currentTimeDisplay = document.getElementById("currentTime");
    this.durationDisplay = document.getElementById("duration");
    this.playerTitle = document.getElementById("playerTitle");
    this.playerArtist = document.getElementById("playerArtist");
    this.playerCover = document.getElementById("playerCover");
    
    // Repeat and Shuffle buttons
    this.repeatBtn = document.getElementById("repeatBtn");
    this.shuffleBtn = document.getElementById("shuffleBtn");
    this.likeBtn = document.getElementById("likeBtn");
  }

  init() {
    this.loadTracksFromData();
    this._pendingRestore = this.loadPlayerStateFromStorage();
    if (this._pendingRestore && typeof this._pendingRestore.volume === 'number' && this.volumeControl) {
      this.volumeControl.value = String(this._pendingRestore.volume);
    }
    this.setupEventListeners();

    if (this._pendingRestore && this.tracks.length > 0) {
      const restoredIndex = this.tracks.findIndex(t => t.id === this._pendingRestore.trackId);
      if (restoredIndex !== -1) {
        this.currentTrackIndex = restoredIndex;
      }
    }

    this.loadTrack(this.currentTrackIndex);
    this.updateVolume();
    this.updateButtonStates();

    if (this._pendingRestore) {
      this.applyPendingRestore();
    }

    // Listen for data updates
    window.addEventListener('dataUpdated', () => {
      this.loadTracksFromData();
      // If current track was deleted, reset to first track
      if (this.currentTrackIndex >= this.tracks.length) {
        this.currentTrackIndex = 0;
        this.loadTrack(this.currentTrackIndex);
      }
    });
    
    // Sync with floating player when it changes
    this.setupFloatingPlayerSync();
  }

  rebind() {
    this.bindElements();
    if (!this.audio) return;
    if (!this.isPlayingExternal) {
      this.isPlaying = !this.audio.paused && !this.audio.ended;
    }
    this.setupEventListeners();
    this.updatePlayButton();
    this.updateButtonStates();
    this.updateVolume();
  }

  loadPlayerStateFromStorage() {
    try {
      const raw = localStorage.getItem('audioPlayerState');
      if (!raw) return null;
      const state = JSON.parse(raw);
      if (!state || typeof state !== 'object') return null;
      if (!state.timestamp || Date.now() - state.timestamp > 3600000) return null;
      return state;
    } catch (e) {
      console.error('[AudioPlayer] Failed to load state:', e);
      return null;
    }
  }

  savePlayerStateToStorage() {
    try {
      const track = this.tracks[this.currentTrackIndex];
      if (!track) return;
      const state = {
        trackId: track.id,
        currentTime: (!this.isPlayingExternal && this.audio) ? (this.audio.currentTime || 0) : 0,
        isPlaying: !!this.isPlaying,
        isShuffled: !!this.isShuffled,
        repeatMode: typeof this.repeatMode === 'number' ? this.repeatMode : 0,
        volume: this.volumeControl ? Number(this.volumeControl.value) : undefined,
        timestamp: Date.now()
      };
      localStorage.setItem('audioPlayerState', JSON.stringify(state));
    } catch (e) {
      console.error('[AudioPlayer] Failed to save state:', e);
    }
  }

  scheduleSaveState() {
    if (this._saveStateRaf) return;
    this._saveStateRaf = requestAnimationFrame(() => {
      this._saveStateRaf = 0;
      this.savePlayerStateToStorage();
    });
  }

  applyPendingRestore() {
    const state = this._pendingRestore;
    this._pendingRestore = null;
    if (!state) return;

    if (typeof state.isShuffled === 'boolean') {
      this.isShuffled = state.isShuffled;
    }
    if (typeof state.repeatMode === 'number') {
      this.repeatMode = state.repeatMode;
    }
    this.updateButtonStates();

    if (!this.isPlayingExternal && this.audio && typeof state.currentTime === 'number' && state.currentTime > 0) {
      const targetTime = state.currentTime;
      const setTime = () => {
        try {
          if (!isNaN(this.audio.duration) && this.audio.duration > 0) {
            this.audio.currentTime = Math.min(targetTime, this.audio.duration - 0.25);
          } else {
            this.audio.currentTime = targetTime;
          }
        } catch (_) {}
      };

      if (this.audio.readyState >= 1) {
        setTime();
      } else {
        this.audio.addEventListener('loadedmetadata', setTime, { once: true });
      }
    }

    if (state.isPlaying) {
      this.play();
    } else {
      this.pause();
    }
  }
  
  setupFloatingPlayerSync() {
    // Listen for floating player state changes
    document.addEventListener('floatingPlayerStateChanged', (e) => {
      if (!e.detail || !e.detail.track) return;
      
      const { track, isPlaying, currentTime, isShuffled, repeatMode } = e.detail;
      
      // Only sync if it's an audio track (not embed)
      if (track.audioUrl && track.audioUrl.trim() !== '') {
        // Find track index
        const trackIndex = this.tracks.findIndex(t => t.id === track.id);
        if (trackIndex !== -1 && trackIndex !== this.currentTrackIndex) {
          this.currentTrackIndex = trackIndex;
          this.loadTrack(trackIndex);
        }
        
        // Sync playback state
        if (isPlaying && !this.isPlaying) {
          this.audio.play().catch(console.error);
          this.isPlaying = true;
        } else if (!isPlaying && this.isPlaying) {
          this.audio.pause();
          this.isPlaying = false;
        }
        
        // Sync current time
        if (currentTime && Math.abs(this.audio.currentTime - currentTime) > 1) {
          this.audio.currentTime = currentTime;
        }

        // Sync shuffle / repeat from persistent player
        if (typeof isShuffled === 'boolean') {
          this.isShuffled = isShuffled;
        }
        if (typeof repeatMode === 'number') {
          this.repeatMode = repeatMode;
        }
        this.updateButtonStates();
        
        // Update UI
        this.updatePlayButton();
        this.scheduleSaveState();
      }
    });
  }

  loadTracksFromData() {
    // Prefer Firebase data from window.__tracks (loaded by music-page.js)
    if (Array.isArray(window.__tracks) && window.__tracks.length > 0) {
      this.tracks = window.__tracks.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artistName || 'Unknown Artist',
        cover: track.artwork,
        src: track.audioUrl || this.getFallbackAudioUrl(track.id),
        duration: track.duration,
        likes: track.likes || 0,
        streams: track.streams || 0,
        originalData: track,
      }));

      this.originalTrackOrder = [...this.tracks];
      console.log('[AudioPlayer] Loaded', this.tracks.length, 'tracks from Firebase (window.__tracks)');
    } else if (this.dataManager) {
      const publishedTracks = this.dataManager.getPublishedTracks();
      this.tracks = publishedTracks.map(track => {
        const artist = this.dataManager.getArtist(track.artist);
        return {
          id: track.id,
          title: track.title,
          artist: artist?.name || track.artistName || 'Unknown Artist',
          cover: track.artwork,
          src: track.audioUrl || this.getFallbackAudioUrl(track.id),
          duration: track.duration,
          likes: track.likes || 0,
          streams: track.streams || 0,
          // Store original data for reference
          originalData: track
        };
      });
      
      this.originalTrackOrder = [...this.tracks];
      console.log('[AudioPlayer] Loaded', this.tracks.length, 'tracks from localStorage dataManager');
    } else {
      this.tracks = [];
      this.originalTrackOrder = [];
      console.log('[AudioPlayer] No tracks found - no Firebase data or dataManager available');
    }
  }

  getFallbackAudioUrl(trackId) {
    return ''
  }

  setupEventListeners() {
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    if (this.playBtn) this.playBtn.addEventListener("click", () => this.togglePlay(), { signal });
    if (this.nextBtn) this.nextBtn.addEventListener("click", () => this.nextTrack(), { signal });
    if (this.prevBtn) this.prevBtn.addEventListener("click", () => this.prevTrack(), { signal });
    if (this.seekBar) this.seekBar.addEventListener("input", (e) => this.seek(e), { signal });
    if (this.volumeControl) this.volumeControl.addEventListener("input", (e) => this.updateVolume(), { signal });
    
    // Repeat and Shuffle buttons
    if (this.repeatBtn) this.repeatBtn.addEventListener("click", () => this.toggleRepeat(), { signal });
    if (this.shuffleBtn) this.shuffleBtn.addEventListener("click", () => this.toggleShuffle(), { signal });
    if (this.likeBtn) this.likeBtn.addEventListener("click", () => this.toggleLike(), { signal });

    this.audio.addEventListener("timeupdate", () => this.updateProgress(), { signal });
    this.audio.addEventListener("loadedmetadata", () => this.updateDuration(), { signal });
    this.audio.addEventListener("ended", () => this.handleTrackEnd(), { signal });

    // Track card click handlers - updated for Spotify-style play button
    // On desktop: play button triggers playback
    // On mobile/touch: card tap navigates to detail page (handled by page-specific JS)
    const hasHover = window.matchMedia('(hover: hover)').matches;
    
    document.addEventListener('click', (e) => {
      const playBtn = e.target.closest('.track-play-btn');
      const trackCard = e.target.closest('.track-card');
      
      if (playBtn) {
        e.stopPropagation();
        const trackIndex = parseInt(playBtn.closest('.track-card').getAttribute('data-track'));
        this.currentTrackIndex = trackIndex;
        this.loadTrack(trackIndex);
        this.play();
      } else if (hasHover && trackCard && !e.target.closest('.track-play-btn') && !e.target.closest('.like-btn-mini') && !e.target.closest('.spotify-indicator') && !e.target.closest('.track-socials a')) {
        // On desktop (hover devices), clicking card area plays the track
        const trackIndex = parseInt(trackCard.getAttribute('data-track'));
        this.currentTrackIndex = trackIndex;
        this.loadTrack(trackIndex);
        this.play();
      }
      // On mobile/touch devices, card tap navigates to detail page (handled by music-page.js, home-page.js, music-data.js)
    }, { signal });

    // Floating player controls
    const floatingPlayBtn = document.getElementById("floatingPlayBtn");
    const floatingPrevBtn = document.getElementById("floatingPrevBtn");
    const floatingNextBtn = document.getElementById("floatingNextBtn");

    if (floatingPlayBtn) {
      floatingPlayBtn.addEventListener("click", () => this.togglePlay(), { signal });
    }
    if (floatingPrevBtn) {
      floatingPrevBtn.addEventListener("click", () => this.prevTrack(), { signal });
    }
    if (floatingNextBtn) {
      floatingNextBtn.addEventListener("click", () => this.nextTrack(), { signal });
    }
  }

  toggleRepeat() {
    this.repeatMode = (this.repeatMode + 1) % 3;
    this.updateButtonStates();
    this.scheduleSaveState();
    this.syncWithPersistentPlayer();
  }

  toggleShuffle() {
    this.isShuffled = !this.isShuffled;

    if (this.isShuffled) {
      // Store current order and shuffle
      this.originalTrackOrder = [...this.tracks];
      this.shuffleTracks();
      // Find current track in shuffled array
      const currentTrack = this.tracks[this.currentTrackIndex];
      this.currentTrackIndex = this.tracks.findIndex(track =>
        track.id === currentTrack.id
      );
    } else {
      // Restore original order
      const currentTrack = this.tracks[this.currentTrackIndex];
      this.tracks = [...this.originalTrackOrder];
      this.currentTrackIndex = this.tracks.findIndex(track =>
        track.id === currentTrack.id
      );
    }

    this.updateButtonStates();
  }

  shuffleTracks() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  toggleLike() {
    if (this.likeBtn) {
      const isLiked = this.likeBtn.classList.contains("liked");
      const currentTrack = this.tracks[this.currentTrackIndex];

      if (isLiked) {
        this.likeBtn.classList.remove("liked");
        this.likeBtn.innerHTML = '<i class="far fa-heart"></i>';
        
        // Only decrement likes for non-external tracks
        if (!currentTrack.isExternal) {
          this.decrementLikes();
        }
      } else {
        this.likeBtn.classList.add("liked");
        this.likeBtn.innerHTML = '<i class="fas fa-heart"></i>';
        
        // Only increment likes for non-external tracks
        if (!currentTrack.isExternal) {
          this.incrementLikes();
        }
      }
    }

    this.scheduleSaveState();
  }

  updatePlayButton() {
    if (this.playBtn) {
      this.playBtn.innerHTML = this.isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
      this.playBtn.classList.toggle("playing", this.isPlaying);
    }

    const floatingPlayBtn = document.getElementById("floatingPlayBtn");
    if (floatingPlayBtn) {
      floatingPlayBtn.innerHTML = this.isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    }
  }

  async incrementLikes() {
    const currentTrack = this.getCurrentOriginalTrack();
    if (currentTrack) {
      // Update local state
      currentTrack.likes = (currentTrack.likes || 0) + 1;
      
      // Also update Firestore
      try {
        const { incrementTrackLikes } = await import('./user-data.js');
        await incrementTrackLikes(currentTrack.id, 1);
      } catch (error) {
        console.error('[AudioPlayer] Error incrementing likes in Firestore:', error);
      }
    }
  }

  async decrementLikes() {
    const currentTrack = this.getCurrentOriginalTrack();
    if (currentTrack) {
      // Update local state
      currentTrack.likes = Math.max(0, (currentTrack.likes || 0) - 1);
      
      // Also update Firestore
      try {
        const { incrementTrackLikes } = await import('./user-data.js');
        await incrementTrackLikes(currentTrack.id, -1);
      } catch (error) {
        console.error('[AudioPlayer] Error decrementing likes in Firestore:', error);
      }
    }
  }

  getCurrentOriginalTrack() {
    const currentAudioTrack = this.tracks[this.currentTrackIndex];
    if (currentAudioTrack && currentAudioTrack.originalData) {
      return currentAudioTrack.originalData;
    }
    return null;
  }

  updateButtonStates() {
    // Update repeat button
    if (this.repeatBtn) {
      switch (this.repeatMode) {
        case 0: // No repeat
          this.repeatBtn.innerHTML = '<i class="fas fa-redo"></i>';
          this.repeatBtn.classList.remove("active");
          break;
        case 1: // Repeat all
          this.repeatBtn.innerHTML = '<i class="fas fa-redo"></i>';
          this.repeatBtn.classList.add("active");
          break;
        case 2: // Repeat one
          this.repeatBtn.innerHTML = '<i class="fas fa-redo"></i><span class="repeat-one">1</span>';
          this.repeatBtn.classList.add("active");
          break;
      }
    }

    // Update shuffle button
    if (this.shuffleBtn) {
      if (this.isShuffled) {
        this.shuffleBtn.classList.add("active");
      } else {
        this.shuffleBtn.classList.remove("active");
      }
    }
  }

  handleTrackEnd() {
    // Increment streams when track ends
    this.incrementStreams();

    switch (this.repeatMode) {
      case 2: // Repeat one
        if (this.isPlayingExternal && this.ytPlayer) {
          this.ytPlayer.seekTo(0);
          this.ytPlayer.playVideo();
        } else {
          this.audio.currentTime = 0;
          this.play();
        }
        break;
      case 1: // Repeat all
        this.nextTrack();
        break;
      default: // No repeat
        if (this.currentTrackIndex < this.tracks.length - 1) {
          this.nextTrack();
        } else {
          this.pause();
          if (!this.isPlayingExternal) {
            this.audio.currentTime = 0;
          } else if (this.ytPlayer) {
            this.ytPlayer.stopVideo();
          }
        }
        break;
    }
  }

  async incrementStreams() {
    const currentTrack = this.getCurrentOriginalTrack();
    if (currentTrack) {
      // Update local state
      currentTrack.streams = (currentTrack.streams || 0) + 1;
      
      // Also update Firestore
      try {
        const { incrementTrackStreams } = await import('./user-data.js');
        await incrementTrackStreams(currentTrack.id, 1);
      } catch (error) {
        console.error('[AudioPlayer] Error incrementing streams in Firestore:', error);
      }
    }
  }

  loadTrack(index) {
    if (index < 0 || index >= this.tracks.length) return;
    
    const track = this.tracks[index];
    
    // If it's an external track, don't load into HTML5 audio
    if (track.isExternal) {
      this.isPlayingExternal = true;
      this.externalTrackData = track.originalData;
    } else {
      this.isPlayingExternal = false;
      this.externalTrackData = null;
      this.audio.src = track.src;
    }
    
    // Update main player
    if (this.playerTitle) this.playerTitle.textContent = track.title;
    if (this.playerArtist) this.playerArtist.textContent = track.artist;
    if (this.playerCover) this.playerCover.src = track.cover;
    if (this.durationDisplay) this.durationDisplay.textContent = track.duration;

    // Update floating player
    const floatingTitle = document.getElementById("floatingTitle");
    const floatingArtist = document.getElementById("floatingArtist");
    const floatingCover = document.getElementById("floatingCover");
    
    if (floatingTitle) floatingTitle.textContent = track.title;
    if (floatingArtist) floatingArtist.textContent = track.artist;
    if (floatingCover) floatingCover.src = track.cover;

    // Reset like state for new track
    if (this.likeBtn) {
      this.likeBtn.classList.remove("liked");
      this.likeBtn.innerHTML = '<i class="far fa-heart"></i>';
    }

    // For external tracks, don't show like button since we can't save likes
    if (track.isExternal && this.likeBtn) {
      this.likeBtn.style.display = 'none';
    } else if (this.likeBtn) {
      this.likeBtn.style.display = 'flex';
    }

    // Show floating player
    const floatingPlayer = document.getElementById("floatingPlayer");
    if (floatingPlayer) {
      floatingPlayer.classList.add("active");
    }

    // Update active track card
    document.querySelectorAll('.track-card').forEach(card => {
      card.classList.remove('active');
    });
    const trackCards = document.querySelectorAll('.track-card');
    if (trackCards[index]) {
      trackCards[index].classList.add('active');
    }
    
    // Sync with persistent floating player
    this.syncWithPersistentPlayer();

    this.scheduleSaveState();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    // If playing external track with YouTube player
    if (this.isPlayingExternal && this.ytPlayer && this.externalTrackData?.platform === 'youtube') {
      this.ytPlayer.playVideo();
      this.isPlaying = true;
      this.updatePlayButton();
      this.scheduleSaveState();
      return;
    }

    // Regular audio playback
    this.audio.play().then(() => {
      this.isPlaying = true;
      if (this.playBtn) {
        this.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        this.playBtn.classList.add("playing");
      }

      const floatingPlayBtn = document.getElementById("floatingPlayBtn");
      if (floatingPlayBtn) {
        floatingPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
      }
      
      // Sync with persistent floating player
      this.syncWithPersistentPlayer();

      this.scheduleSaveState();
    }).catch(error => {
      console.error("Error playing audio:", error);
      // Fallback: try to load the track again
      this.loadTrack(this.currentTrackIndex);
      this.isPlaying = false;
      this.updatePlayButton();
      this.scheduleSaveState();
    });
  }

  pause() {
    // If playing external track with YouTube player
    if (this.isPlayingExternal && this.ytPlayer && this.externalTrackData?.platform === 'youtube') {
      this.ytPlayer.pauseVideo();
      this.isPlaying = false;
      this.updatePlayButton();
      this.scheduleSaveState();
      return;
    }

    // Regular audio pause
    this.audio.pause();
    this.isPlaying = false;
    if (this.playBtn) {
      this.playBtn.innerHTML = '<i class="fas fa-play"></i>';
      this.playBtn.classList.remove("playing");
    }

    const floatingPlayBtn = document.getElementById("floatingPlayBtn");
    if (floatingPlayBtn) {
      floatingPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
    
    // Sync with persistent floating player
    this.syncWithPersistentPlayer();
  }

  nextTrack() {
    if (this.tracks.length === 0) return;

    if (this.isShuffled && this.repeatMode !== 2) {
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * this.tracks.length);
      } while (nextIndex === this.currentTrackIndex && this.tracks.length > 1);
      
      this.currentTrackIndex = nextIndex;
    } else {
      this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    }
    
    // If current is external YouTube, destroy it
    if (this.isPlayingExternal && this.ytPlayer) {
      this.ytPlayer.destroy();
      this.ytPlayer = null;
      const playerContainer = document.getElementById('youtubePlayerContainer');
      if (playerContainer) playerContainer.remove();
    }
    
    this.loadTrack(this.currentTrackIndex);
    this.play();
  }

  prevTrack() {
    if (this.tracks.length === 0) return;

    if (!this.isPlayingExternal && this.audio.currentTime > 3) {
      // If more than 3 seconds into track, restart current track
      this.audio.currentTime = 0;
    } else {
      // Otherwise go to previous track
      if (this.isShuffled) {
        let prevIndex;
        do {
          prevIndex = Math.floor(Math.random() * this.tracks.length);
        } while (prevIndex === this.currentTrackIndex && this.tracks.length > 1);
        
        this.currentTrackIndex = prevIndex;
      } else {
        this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
      }
      
      // If current is external YouTube, destroy it
      if (this.isPlayingExternal && this.ytPlayer) {
        this.ytPlayer.destroy();
        this.ytPlayer = null;
        const playerContainer = document.getElementById('youtubePlayerContainer');
        if (playerContainer) playerContainer.remove();
      }
      
      this.loadTrack(this.currentTrackIndex);
      this.play();
    }
  }

  seek(e) {
    if (this.isPlayingExternal && this.ytPlayer) {
      // Seek in YouTube player
      const duration = this.ytPlayer.getDuration();
      const seekTime = (e.target.value / 100) * duration;
      this.ytPlayer.seekTo(seekTime);
    } else {
      const seekTime = (e.target.value / 100) * this.audio.duration;
      this.audio.currentTime = seekTime;
    }
  }

  updateProgress() {
    if (this.isPlayingExternal && this.ytPlayer) {
      // Update progress from YouTube player
      const currentTime = this.ytPlayer.getCurrentTime();
      const duration = this.ytPlayer.getDuration();
      if (duration) {
        const progress = (currentTime / duration) * 100;
        if (this.progressBar) this.progressBar.style.width = progress + "%";
        if (this.seekBar) this.seekBar.value = progress;
        if (this.currentTimeDisplay) this.currentTimeDisplay.textContent = this.formatTime(currentTime);
        
        // Update floating player progress
        const floatingProgressBar = document.getElementById("floatingProgressBar");
        if (floatingProgressBar) {
          floatingProgressBar.style.width = progress + "%";
        }
      }
    } else if (this.audio.duration) {
      const progress = (this.audio.currentTime / this.audio.duration) * 100;
      if (this.progressBar) this.progressBar.style.width = progress + "%";
      if (this.seekBar) this.seekBar.value = progress;
      if (this.currentTimeDisplay) this.currentTimeDisplay.textContent = this.formatTime(this.audio.currentTime);
      
      // Update floating player progress
      const floatingProgressBar = document.getElementById("floatingProgressBar");
      if (floatingProgressBar) {
        floatingProgressBar.style.width = progress + "%";
      }

      this.scheduleSaveState();
    }
  }

  updateDuration() {
    if (this.isPlayingExternal && this.ytPlayer) {
      const duration = this.ytPlayer.getDuration();
      if (this.durationDisplay && duration) {
        this.durationDisplay.textContent = this.formatTime(duration);
      }
    } else if (this.durationDisplay && this.audio.duration) {
      this.durationDisplay.textContent = this.formatTime(this.audio.duration);
    }
  }

  updateVolume() {
    if (this.volumeControl) {
      const volume = this.volumeControl.value / 100;
      
      // Update HTML5 audio volume
      this.audio.volume = volume;
      
      // Update YouTube player volume if playing external track
      if (this.isPlayingExternal && this.ytPlayer && this.externalTrackData?.platform === 'youtube') {
        this.ytPlayer.setVolume(this.volumeControl.value);
      }
      
      // Update volume icon based on volume level
      const volumeToggle = document.getElementById("volumeToggle");
      if (volumeToggle) {
        const volumeValue = this.volumeControl.value;
        if (volumeValue == 0) {
          volumeToggle.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else if (volumeValue < 50) {
          volumeToggle.innerHTML = '<i class="fas fa-volume-down"></i>';
        } else {
          volumeToggle.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
      }
    }
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  }

  // Load external track from URL (Spotify, SoundCloud, YouTube, etc.)
  loadExternalTrack(trackData) {
    const { url, title, artist, artwork, platform, isVideo } = trackData;

    // Create a temporary external track object
    const externalTrack = {
      id: `external_${Date.now()}`,
      title: title,
      artist: artist,
      cover: artwork,
      src: url,
      duration: '0:00',
      likes: 0,
      streams: 0,
      isExternal: true,
      platform: platform,
      isVideo: isVideo,
      originalData: trackData
    };

    // Add to tracks array
    this.tracks.push(externalTrack);
    this.currentTrackIndex = this.tracks.length - 1;

    // Update player UI
    if (this.playerTitle) this.playerTitle.textContent = title;
    if (this.playerArtist) this.playerArtist.textContent = artist;
    if (this.playerCover) this.playerCover.src = artwork;

    // Update floating player
    const floatingTitle = document.getElementById("floatingTitle");
    const floatingArtist = document.getElementById("floatingArtist");
    const floatingCover = document.getElementById("floatingCover");

    if (floatingTitle) floatingTitle.textContent = title;
    if (floatingArtist) floatingArtist.textContent = artist;
    if (floatingCover) floatingCover.src = artwork;

    // Show floating player
    const floatingPlayer = document.getElementById("floatingPlayer");
    if (floatingPlayer) {
      floatingPlayer.classList.add("active");
    }

    // For external tracks, we need to use platform-specific embeds or APIs
    if (platform === 'youtube' && isVideo) {
      // For YouTube videos, create an iframe player
      this.createYouTubePlayer(url, title);
    } else if (platform === 'youtube') {
      // For YouTube audio-only
      this.createYouTubePlayer(url, title, true);
    } else if (platform === 'spotify') {
      // For Spotify, we could use Spotify Web Playback SDK
      console.log('Spotify track loaded - requires Spotify Web Playback SDK for playback');
      this.showExternalPlatformMessage('Spotify');
    } else if (platform === 'soundcloud') {
      // For SoundCloud, we could use SoundCloud Widget API
      console.log('SoundCloud track loaded - requires SoundCloud Widget API for playback');
      this.showExternalPlatformMessage('SoundCloud');
    }

    // Store that we're playing an external track
    this.isPlayingExternal = true;
    this.externalTrackData = trackData;

    console.log('[AudioPlayer] External track loaded:', externalTrack);
  }

  // Create YouTube IFrame player
  createYouTubePlayer(url, title, audioOnly = false) {
    // Extract video ID
    let videoId = '';
    if (url.includes('youtu.be')) {
      videoId = url.split('/').pop().split('?')[0];
    } else {
      const match = url.match(/[?&]v=([^&]+)/);
      if (match) videoId = match[1];
    }

    if (!videoId) {
      console.error('[AudioPlayer] Could not extract YouTube video ID');
      return;
    }

    // Load YouTube IFrame API if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        this.initializeYouTubePlayer(videoId, title, audioOnly);
      };
    } else {
      this.initializeYouTubePlayer(videoId, title, audioOnly);
    }
  }

  // Initialize YouTube player
  initializeYouTubePlayer(videoId, title, audioOnly) {
    // Check if we already have a YouTube player container
    let playerContainer = document.getElementById('youtubePlayerContainer');
    if (!playerContainer) {
      playerContainer = document.createElement('div');
      playerContainer.id = 'youtubePlayerContainer';
      playerContainer.style.cssText = 'position: fixed; bottom: 80px; right: 20px; width: 320px; height: 180px; z-index: 9999; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);';
      document.body.appendChild(playerContainer);

      // Add close button
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '<i class="fas fa-times"></i>';
      closeBtn.style.cssText = 'position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; z-index: 10000;';
      closeBtn.onclick = () => {
        if (this.ytPlayer) {
          this.ytPlayer.destroy();
          this.ytPlayer = null;
        }
        this.isPlayingExternal = false;
        this.externalTrackData = null;
        playerContainer.remove();
      };
      playerContainer.appendChild(closeBtn);
    }

    // Create YouTube player
    this.ytPlayer = new YT.Player('youtubePlayerContainer', {
      height: audioOnly ? '60' : '180',
      width: '320',
      videoId: videoId,
      playerVars: {
        'autoplay': 1,
        'controls': 1,
        'disablekb': 0,
        'fs': 0,
        'modestbranding': 1
      },
      events: {
        'onReady': (event) => {
          event.target.playVideo();
          this.isPlaying = true;
          if (this.playBtn) {
            this.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            this.playBtn.classList.add("playing");
          }
          const floatingPlayBtn = document.getElementById("floatingPlayBtn");
          if (floatingPlayBtn) {
            floatingPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
          }
          console.log('[AudioPlayer] YouTube player ready and playing');
        },
        'onStateChange': (event) => {
          if (event.data === YT.PlayerState.ENDED) {
            // Video ended, handle next track
            this.handleTrackEnd();
          } else if (event.data === YT.PlayerState.PLAYING) {
            this.isPlaying = true;
            if (this.playBtn) {
              this.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
              this.playBtn.classList.add("playing");
            }
            const floatingPlayBtn = document.getElementById("floatingPlayBtn");
            if (floatingPlayBtn) {
              floatingPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
            }
          } else if (event.data === YT.PlayerState.PAUSED) {
            this.isPlaying = false;
            if (this.playBtn) {
              this.playBtn.innerHTML = '<i class="fas fa-play"></i>';
              this.playBtn.classList.remove("playing");
            }
            const floatingPlayBtn = document.getElementById("floatingPlayBtn");
            if (floatingPlayBtn) {
              floatingPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
          }
        }
      }
    });

    console.log('[AudioPlayer] YouTube player created for video:', videoId);
  }

  // Show message for external platforms that require SDK
  showExternalPlatformMessage(platform) {
    const message = document.createElement('div');
    message.style.cssText = 'position: fixed; bottom: 80px; right: 20px; background: rgba(0,0,0,0.9); color: white; padding: 15px 20px; border-radius: 12px; z-index: 9999; max-width: 300px;';
    message.innerHTML = `
      <p style="margin: 0 0 10px 0;">${platform} track loaded</p>
      <p style="margin: 0; font-size: 0.85rem; opacity: 0.8;">Full ${platform} integration requires their SDK. Opening in original platform...</p>
    `;
    document.body.appendChild(message);

    setTimeout(() => {
      message.remove();
    }, 4000);
  }

  // Sync with persistent floating player
  syncWithPersistentPlayer() {
    if (!window.persistentPlayer) return;
    
    const track = this.tracks[this.currentTrackIndex];
    if (!track) return;
    
    const trackData = {
      id: track.id,
      title: track.title,
      artistName: track.artist,
      artwork: track.cover,
      audioUrl: track.src,
      platformLinks: track.originalData?.platformLinks || {},
      originalData: track.originalData
    };
    
    // Update persistent player state
    window.persistentPlayer.currentTrack = trackData;
    window.persistentPlayer.currentPlatform = 'audio';
    window.persistentPlayer.updateUI('audio');
    window.persistentPlayer.isPlaying = this.isPlaying;
    window.persistentPlayer.updatePlayButton();
    
    // Sync current time if audio exists
    if (window.persistentPlayer.audio && this.audio) {
      window.persistentPlayer.audio.currentTime = this.audio.currentTime;
    }
    
    // Dispatch event for persistent player
    document.dispatchEvent(new CustomEvent('trackChanged', {
      detail: {
        track: trackData,
        isPlaying: this.isPlaying,
        currentTime: this.audio?.currentTime || 0,
        isShuffled: this.isShuffled,
        repeatMode: this.repeatMode
      }
    }));

    // Keep persistent player shuffle/repeat modes aligned with the main player
    window.persistentPlayer.isShuffled = this.isShuffled;
    window.persistentPlayer.repeatMode = ['none', 'all', 'one'][this.repeatMode] || 'none';
    if (typeof window.persistentPlayer.updateShuffleRepeatUI === 'function') {
      window.persistentPlayer.updateShuffleRepeatUI();
    }
    if (typeof window.persistentPlayer.saveState === 'function') {
      window.persistentPlayer.saveState();
    }
    
    // Also set playlist in persistent player
    if (this.tracks.length > 0 && window.persistentPlayer.playlist?.length !== this.tracks.length) {
      const playlist = this.tracks.map(t => ({
        id: t.id,
        title: t.title,
        artistName: t.artist,
        artwork: t.cover,
        audioUrl: t.src,
        platformLinks: t.originalData?.platformLinks || {},
        originalData: t.originalData
      }));
      window.persistentPlayer.setPlaylist(playlist, this.currentTrackIndex);
    }
  }
}

// Initialize player when DOM is ready and audio element exists
function initAudioPlayer() {
  // Make sure dataManager is available
  if (typeof window.dataManager === 'undefined') {
    console.warn('dataManager not found. Audio player will use default tracks.');
  }

  return;
  
  // Floating player close button
  const floatingClose = document.getElementById("floatingClose");
  if (floatingClose) {
    floatingClose.addEventListener("click", () => {
      const floatingPlayer = document.getElementById("floatingPlayer");
      if (floatingPlayer) {
        floatingPlayer.classList.remove("active");
      }
    });
  }
  
  // Volume toggle for mobile
  const volumeToggle = document.getElementById("volumeToggle");
  const volumeControlContainer = document.getElementById("volumeControlContainer");

  if (volumeToggle && volumeControlContainer) {
    volumeToggle.addEventListener("click", () => {
      // Toggle mute/unmute
      if (window.audioPlayer) {
        const currentVolume = window.audioPlayer.volumeControl.value;
        if (currentVolume > 0) {
          window.audioPlayer.previousVolume = currentVolume;
          window.audioPlayer.volumeControl.value = 0;
          window.audioPlayer.updateVolume();
        } else {
          window.audioPlayer.volumeControl.value = window.audioPlayer.previousVolume || 70;
          window.audioPlayer.updateVolume();
        }
      }
    });
  }

  // Listen for messages from external player
  window.addEventListener('message', (event) => {
    if (event.data.type === 'loadExternalTrack' && window.audioPlayer) {
      window.audioPlayer.loadExternalTrack(event.data.data);
    } else if (event.data.type === 'externalPlayerPlaying') {
      // External player is playing, store state
      localStorage.setItem('externalPlayerState', JSON.stringify(event.data.data));
      console.log('[AudioPlayer] External player state received:', event.data.data);
    }
  });

  // Check for stored external player state on page load
  const storedState = localStorage.getItem('externalPlayerState');
  if (storedState && window.audioPlayer) {
    try {
      const state = JSON.parse(storedState);
      // Only restore if it's recent (within 5 minutes)
      if (Date.now() - state.timestamp < 300000) {
        console.log('[AudioPlayer] Restoring external player state:', state);
        // Optionally auto-load the external track
        // window.audioPlayer.loadExternalTrack(state);
      }
    } catch (e) {
      console.error('[AudioPlayer] Error parsing stored state:', e);
    }
  }
}

document.addEventListener("DOMContentLoaded", initAudioPlayer);
document.addEventListener('includes:loaded', initAudioPlayer);
window.addEventListener('pageshow', initAudioPlayer);
