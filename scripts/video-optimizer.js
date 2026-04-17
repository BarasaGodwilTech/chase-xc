/**
 * Video Optimizer - Ensures instant playback and smooth streaming
 * Handles preloading, buffering, and seamless video segment transitions
 */
class VideoOptimizer {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.segments = options.segments || [];
    this.currentSegment = 0;
    this.preloadedSegments = new Map();
    this.bufferThreshold = options.bufferThreshold || 30; // Buffer 30 seconds ahead
    this.preloadAhead = options.preloadAhead || 2; // Preload 2 segments ahead
    this.isInitialized = false;
    
    // Network quality detection
    this.connectionType = 'unknown';
    this.detectNetworkQuality();
    
    // Listen for network changes
    if (navigator.connection) {
      navigator.connection.addEventListener('change', () => this.detectNetworkQuality());
    }
    
    this.init();
  }

  detectNetworkQuality() {
    if (navigator.connection) {
      const conn = navigator.connection;
      this.connectionType = conn.effectiveType || 'unknown';
      
      // Adjust buffering based on connection quality
      if (this.connectionType === 'slow-2g' || this.connectionType === '2g') {
        this.bufferThreshold = 60; // More buffer for slow connections
        this.preloadAhead = 3; // Preload more segments
      } else if (this.connectionType === '3g') {
        this.bufferThreshold = 45;
        this.preloadAhead = 2;
      } else {
        this.bufferThreshold = 30;
        this.preloadAhead = 2;
      }
      
      console.log('[VideoOptimizer] Network quality:', this.connectionType, 'Buffer threshold:', this.bufferThreshold);
    }
  }

  async init() {
    if (!this.video) {
      console.error('[VideoOptimizer] No video element provided');
      return;
    }

    // Set optimal video attributes for instant playback
    this.video.preload = 'auto';
    this.video.buffered = true;
    
    // Enable hardware acceleration
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('webkit-playsinline', '');
    
    // Set up event listeners for buffer management
    this.setupBufferListeners();
    
    // Start preloading segments
    if (this.segments.length > 0) {
      await this.preloadAllSegments();
    }
    
    this.isInitialized = true;
    console.log('[VideoOptimizer] Initialized with', this.segments.length, 'segments');
  }

  setupBufferListeners() {
    // Monitor buffer levels
    this.video.addEventListener('progress', () => {
      this.checkBufferLevel();
    });

    // Handle waiting state (buffering)
    this.video.addEventListener('waiting', () => {
      console.log('[VideoOptimizer] Buffering...');
      this.handleBufferUnderrun();
    });

    // Handle canplay - ready to play
    this.video.addEventListener('canplay', () => {
      console.log('[VideoOptimizer] Ready to play');
    });

    // Handle segment end for seamless transition
    this.video.addEventListener('ended', () => {
      this.playNextSegment();
    });

    // Handle stalling
    this.video.addEventListener('stalled', () => {
      console.log('[VideoOptimizer] Playback stalled, attempting recovery');
      this.handleStall();
    });
  }

  async preloadAllSegments() {
    console.log('[VideoOptimizer] Starting preload of', this.segments.length, 'segments');
    
    const preloadPromises = this.segments.map((segment, index) => 
      this.preloadSegment(segment, index)
    );
    
    try {
      await Promise.all(preloadPromises);
      console.log('[VideoOptimizer] All segments preloaded successfully');
    } catch (error) {
      console.error('[VideoOptimizer] Error preloading segments:', error);
    }
  }

  async preloadSegment(segmentUrl, index) {
    if (this.preloadedSegments.has(segmentUrl)) {
      return this.preloadedSegments.get(segmentUrl);
    }

    try {
      // Create a temporary video element for preloading
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'auto';
      tempVideo.muted = true;
      tempVideo.style.display = 'none';
      
      const source = document.createElement('source');
      source.src = segmentUrl;
      source.type = 'video/mp4';
      tempVideo.appendChild(source);
      
      document.body.appendChild(tempVideo);
      
      // Wait for the video to load enough data
      await new Promise((resolve, reject) => {
        tempVideo.addEventListener('canplaythrough', () => {
          console.log('[VideoOptimizer] Segment', index, 'preloaded:', segmentUrl);
          document.body.removeChild(tempVideo);
          resolve();
        }, { once: true });
        
        tempVideo.addEventListener('error', (e) => {
          document.body.removeChild(tempVideo);
          reject(new Error(`Failed to preload segment ${index}: ${e.message}`));
        }, { once: true });
        
        // Timeout after 30 seconds
        setTimeout(() => {
          if (document.body.contains(tempVideo)) {
            document.body.removeChild(tempVideo);
            reject(new Error(`Timeout preloading segment ${index}`));
          }
        }, 30000);
      });
      
      this.preloadedSegments.set(segmentUrl, true);
      return true;
    } catch (error) {
      console.error('[VideoOptimizer] Preload error for segment', index, ':', error);
      return false;
    }
  }

  checkBufferLevel() {
    if (!this.video.duration) return;
    
    const buffered = this.video.buffered;
    if (buffered.length > 0) {
      const bufferedEnd = buffered.end(buffered.length - 1);
      const currentTime = this.video.currentTime;
      const bufferAhead = bufferedEnd - currentTime;
      
      // If buffer is running low, trigger preload of next segment
      if (bufferAhead < this.bufferThreshold && this.segments.length > 0) {
        const nextIndex = (this.currentSegment + 1) % this.segments.length;
        this.preloadSegment(this.segments[nextIndex], nextIndex);
      }
    }
  }

  handleBufferUnderrun() {
    // Try to preload more aggressively
    if (this.segments.length > 0) {
      const nextIndex = (this.currentSegment + 1) % this.segments.length;
      this.preloadSegment(this.segments[nextIndex], nextIndex);
      
      // Preload additional segments if needed
      for (let i = 1; i <= this.preloadAhead; i++) {
        const futureIndex = (this.currentSegment + i) % this.segments.length;
        this.preloadSegment(this.segments[futureIndex], futureIndex);
      }
    }
  }

  handleStall() {
    // Attempt to recover by seeking slightly back
    if (this.video.currentTime > 1) {
      const recoverTime = this.video.currentTime - 0.5;
      this.video.currentTime = recoverTime;
      this.video.play();
    }
  }

  playNextSegment() {
    if (this.segments.length === 0) return;
    
    this.currentSegment = (this.currentSegment + 1) % this.segments.length;
    const nextSegment = this.segments[this.currentSegment];
    
    // Store current playback position for seamless transition
    const wasPlaying = !this.video.paused;
    const currentTime = this.video.currentTime;
    
    // Change source
    this.video.src = nextSegment;
    this.video.load();
    
    // Resume playback
    if (wasPlaying) {
      this.video.play().catch(err => {
        console.error('[VideoOptimizer] Error playing next segment:', err);
      });
    }
    
    console.log('[VideoOptimizer] Switched to segment', this.currentSegment);
  }

  forcePreload(index) {
    if (index >= 0 && index < this.segments.length) {
      this.preloadSegment(this.segments[index], index);
    }
  }

  getBufferHealth() {
    const buffered = this.video.buffered;
    if (buffered.length === 0) return 0;
    
    const bufferedEnd = buffered.end(buffered.length - 1);
    const bufferAhead = bufferedEnd - this.video.currentTime;
    
    return {
      bufferAhead: bufferAhead,
      isHealthy: bufferAhead >= this.bufferThreshold,
      connectionType: this.connectionType
    };
  }
}

/**
 * Optimizer for single background videos
 */
class BackgroundVideoOptimizer {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.options = {
      preloadTime: options.preloadTime || 5, // Preload 5 seconds before needed
      retryAttempts: options.retryAttempts || 3,
      ...options
    };
    
    this.init();
  }

  init() {
    if (!this.video) return;
    
    // Set optimal attributes
    this.video.preload = 'auto';
    this.video.muted = true;
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('webkit-playsinline', '');
    
    // Add buffer management
    this.setupOptimizations();
    
    // Start playback with optimal settings
    this.startOptimizedPlayback();
  }

  setupOptimizations() {
    // Preload metadata immediately
    this.video.load();
    
    // Set up buffer monitoring
    this.video.addEventListener('progress', () => {
      this.ensureBuffer();
    });
    
    // Handle playback errors with retry
    this.video.addEventListener('error', () => {
      this.handlePlaybackError();
    });
    
    // Ensure smooth looping
    this.video.addEventListener('ended', () => {
      this.video.currentTime = 0;
      this.video.play();
    });
  }

  async startOptimizedPlayback() {
    // Wait for enough buffer before starting
    await this.waitForBuffer(this.options.preloadTime);
    
    // Start playback
    try {
      await this.video.play();
      console.log('[BackgroundVideoOptimizer] Playback started successfully');
    } catch (error) {
      console.error('[BackgroundVideoOptimizer] Playback error:', error);
      // Retry
      this.retryPlayback();
    }
  }

  waitForBuffer(seconds) {
    return new Promise((resolve) => {
      const checkBuffer = () => {
        const buffered = this.video.buffered;
        if (buffered.length > 0) {
          const bufferedEnd = buffered.end(buffered.length - 1);
          if (bufferedEnd >= seconds) {
            resolve();
            return;
          }
        }
        
        // Check again in 100ms
        setTimeout(checkBuffer, 100);
      };
      
      checkBuffer();
    });
  }

  ensureBuffer() {
    const buffered = this.video.buffered;
    if (buffered.length > 0) {
      const bufferedEnd = buffered.end(buffered.length - 1);
      const duration = this.video.duration;
      
      // If buffer is less than 80% of video, it might need attention
      if (duration > 0 && bufferedEnd < duration * 0.8) {
        // The browser should handle this, but we can log it
        console.log('[BackgroundVideoOptimizer] Buffer at', 
          Math.round((bufferedEnd / duration) * 100), '%');
      }
    }
  }

  handlePlaybackError() {
    console.error('[BackgroundVideoOptimizer] Playback error, retrying...');
    this.retryPlayback();
  }

  retryPlayback() {
    let attempts = 0;
    const retry = () => {
      attempts++;
      if (attempts <= this.options.retryAttempts) {
        this.video.load();
        this.video.play().catch(() => {
          setTimeout(retry, 1000);
        });
      }
    };
    
    retry();
  }
}

// Auto-initialize videos with data attributes
document.addEventListener('DOMContentLoaded', () => {
  // Initialize hero video sequence
  const heroVideo = document.querySelector('.home-hero-bg-video');
  if (heroVideo && heroVideo.dataset.videoSequence) {
    try {
      const segments = JSON.parse(heroVideo.dataset.videoSequence);
      window.heroVideoOptimizer = new VideoOptimizer(heroVideo, {
        segments: segments,
        bufferThreshold: 30,
        preloadAhead: 2
      });
    } catch (e) {
      console.error('[VideoOptimizer] Error parsing video sequence:', e);
    }
  }
  
  // Initialize background videos
  const backgroundVideos = document.querySelectorAll('video[autoplay][muted]');
  backgroundVideos.forEach(video => {
    if (!video.dataset.videoSequence) {
      new BackgroundVideoOptimizer(video);
    }
  });
  
  console.log('[VideoOptimizer] All videos initialized');
});
