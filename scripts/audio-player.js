// Enhanced Audio Player with Data Integration
class AudioPlayer {
  constructor() {
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

    // Only initialize if audio element exists on the page
    if (!this.audio) return;

    this.isPlaying = false;
    this.currentTrackIndex = 0;
    this.isShuffled = false;
    this.repeatMode = 0; // 0: no repeat, 1: repeat all, 2: repeat one
    this.shuffleHistory = [];
    this.originalTrackOrder = [];

    // Use data from dataManager instead of hardcoded tracks
    this.tracks = [];
    this.dataManager = window.dataManager;

    this.init();
  }

  init() {
    this.loadTracksFromData();
    this.setupEventListeners();
    this.loadTrack(this.currentTrackIndex);
    this.updateVolume();
    this.updateButtonStates();

    // Listen for data updates
    window.addEventListener('dataUpdated', () => {
      this.loadTracksFromData();
      // If current track was deleted, reset to first track
      if (this.currentTrackIndex >= this.tracks.length) {
        this.currentTrackIndex = 0;
        this.loadTrack(this.currentTrackIndex);
      }
    });
  }

  loadTracksFromData() {
    if (this.dataManager) {
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
    } else {
      // Fallback to original tracks if dataManager not available
      this.tracks = this.getDefaultTracks();
      this.originalTrackOrder = [...this.tracks];
    }
  }

  getDefaultTracks() {
    return [
      {
        id: 'default_1',
        title: "Sunset Dreams",
        artist: "Sarah Miles",
        cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop",
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        duration: "3:45",
        likes: 2400,
        streams: 15200
      },
      {
        id: 'default_2',
        title: "City Lights",
        artist: "DJ Kato",
        cover: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=80&h=80&fit=crop",
        src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        duration: "4:20",
        likes: 8700,
        streams: 45800
      }
    ];
  }

  getFallbackAudioUrl(trackId) {
    // Provide fallback audio URLs based on track ID or use a default
    const defaultUrls = [
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
    ];
    const index = trackId ? parseInt(trackId.replace(/\D/g, '')) % defaultUrls.length : 0;
    return defaultUrls[index];
  }

  setupEventListeners() {
    if (this.playBtn) this.playBtn.addEventListener("click", () => this.togglePlay());
    if (this.nextBtn) this.nextBtn.addEventListener("click", () => this.nextTrack());
    if (this.prevBtn) this.prevBtn.addEventListener("click", () => this.prevTrack());
    if (this.seekBar) this.seekBar.addEventListener("input", (e) => this.seek(e));
    if (this.volumeControl) this.volumeControl.addEventListener("input", (e) => this.updateVolume());
    
    // Repeat and Shuffle buttons
    if (this.repeatBtn) this.repeatBtn.addEventListener("click", () => this.toggleRepeat());
    if (this.shuffleBtn) this.shuffleBtn.addEventListener("click", () => this.toggleShuffle());
    if (this.likeBtn) this.likeBtn.addEventListener("click", () => this.toggleLike());

    this.audio.addEventListener("timeupdate", () => this.updateProgress());
    this.audio.addEventListener("loadedmetadata", () => this.updateDuration());
    this.audio.addEventListener("ended", () => this.handleTrackEnd());

    // Track card click handlers - updated to use event delegation for dynamic content
    document.addEventListener('click', (e) => {
      const playBtn = e.target.closest('.play-btn-card');
      const trackCard = e.target.closest('.track-card');
      
      if (playBtn) {
        e.stopPropagation();
        const trackIndex = parseInt(playBtn.closest('.track-card').getAttribute('data-track'));
        this.currentTrackIndex = trackIndex;
        this.loadTrack(trackIndex);
        this.play();
      } else if (trackCard && !e.target.closest('.play-btn-card') && !e.target.closest('.overlay-btn')) {
        const trackIndex = parseInt(trackCard.getAttribute('data-track'));
        this.currentTrackIndex = trackIndex;
        this.loadTrack(trackIndex);
        this.play();
      }
    });

    // Floating player controls
    const floatingPlayBtn = document.getElementById("floatingPlayBtn");
    const floatingPrevBtn = document.getElementById("floatingPrevBtn");
    const floatingNextBtn = document.getElementById("floatingNextBtn");

    if (floatingPlayBtn) {
      floatingPlayBtn.addEventListener("click", () => this.togglePlay());
    }
    if (floatingPrevBtn) {
      floatingPrevBtn.addEventListener("click", () => this.prevTrack());
    }
    if (floatingNextBtn) {
      floatingNextBtn.addEventListener("click", () => this.nextTrack());
    }
  }

  toggleRepeat() {
    this.repeatMode = (this.repeatMode + 1) % 3;
    this.updateButtonStates();
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
      if (isLiked) {
        this.likeBtn.classList.remove("liked");
        this.likeBtn.innerHTML = '<i class="far fa-heart"></i>';
        this.decrementLikes();
      } else {
        this.likeBtn.classList.add("liked");
        this.likeBtn.innerHTML = '<i class="fas fa-heart"></i>';
        this.incrementLikes();
      }
    }
  }

  incrementLikes() {
    const currentTrack = this.getCurrentOriginalTrack();
    if (currentTrack && this.dataManager) {
      currentTrack.likes = (currentTrack.likes || 0) + 1;
      this.dataManager.saveTrack(currentTrack);
    }
  }

  decrementLikes() {
    const currentTrack = this.getCurrentOriginalTrack();
    if (currentTrack && this.dataManager) {
      currentTrack.likes = Math.max(0, (currentTrack.likes || 0) - 1);
      this.dataManager.saveTrack(currentTrack);
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
        this.audio.currentTime = 0;
        this.play();
        break;
      case 1: // Repeat all
        this.nextTrack();
        break;
      default: // No repeat
        if (this.currentTrackIndex < this.tracks.length - 1) {
          this.nextTrack();
        } else {
          this.pause();
          this.audio.currentTime = 0;
        }
        break;
    }
  }

  incrementStreams() {
    const currentTrack = this.getCurrentOriginalTrack();
    if (currentTrack && this.dataManager) {
      currentTrack.streams = (currentTrack.streams || 0) + 1;
      this.dataManager.saveTrack(currentTrack);
    }
  }

  loadTrack(index) {
    if (index < 0 || index >= this.tracks.length) return;
    
    const track = this.tracks[index];
    this.audio.src = track.src;
    
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
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
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
    }).catch(error => {
      console.error("Error playing audio:", error);
      // Fallback: try to load the track again
      this.loadTrack(this.currentTrackIndex);
    });
  }

  pause() {
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
    
    this.loadTrack(this.currentTrackIndex);
    this.play();
  }

  prevTrack() {
    if (this.tracks.length === 0) return;

    if (this.audio.currentTime > 3) {
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
      
      this.loadTrack(this.currentTrackIndex);
      this.play();
    }
  }

  seek(e) {
    const seekTime = (e.target.value / 100) * this.audio.duration;
    this.audio.currentTime = seekTime;
  }

  updateProgress() {
    if (this.audio.duration) {
      const progress = (this.audio.currentTime / this.audio.duration) * 100;
      if (this.progressBar) this.progressBar.style.width = progress + "%";
      if (this.seekBar) this.seekBar.value = progress;
      if (this.currentTimeDisplay) this.currentTimeDisplay.textContent = this.formatTime(this.audio.currentTime);
      
      // Update floating player progress
      const floatingProgressBar = document.getElementById("floatingProgressBar");
      if (floatingProgressBar) {
        floatingProgressBar.style.width = progress + "%";
      }
    }
  }

  updateDuration() {
    if (this.durationDisplay && this.audio.duration) {
      this.durationDisplay.textContent = this.formatTime(this.audio.duration);
    }
  }

  updateVolume() {
    if (this.volumeControl) {
      this.audio.volume = this.volumeControl.value / 100;
      
      // Update volume icon based on volume level
      const volumeToggle = document.getElementById("volumeToggle");
      if (volumeToggle) {
        const volume = this.volumeControl.value;
        if (volume == 0) {
          volumeToggle.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else if (volume < 50) {
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
}

// Initialize player when DOM is ready and audio element exists
document.addEventListener("DOMContentLoaded", () => {
  // Make sure dataManager is available
  if (typeof window.dataManager === 'undefined') {
    console.warn('dataManager not found. Audio player will use default tracks.');
  }

  if (document.getElementById("audioElement")) {
    window.audioPlayer = new AudioPlayer();
  }
  
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
      volumeControlContainer.classList.toggle("show");
    });
  }
});