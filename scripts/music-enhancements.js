/**
 * Music Page UI/UX Enhancements
 * Provides interactive features for improved user experience
 */

(function() {
    'use strict';

    // ============================================
    // PARTICLE BACKGROUND
    // ============================================
    class ParticleBackground {
        constructor(container, options = {}) {
            this.container = container;
            this.particleCount = options.particleCount || 30;
            this.particles = [];
            this.init();
        }

        init() {
            if (!this.container) return;
            
            for (let i = 0; i < this.particleCount; i++) {
                this.createParticle(i);
            }
        }

        createParticle(index) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            // Random position and animation
            const startX = Math.random() * 100;
            const delay = Math.random() * 8;
            const duration = 6 + Math.random() * 4;
            const size = 2 + Math.random() * 4;
            
            particle.style.cssText = `
                left: ${startX}%;
                width: ${size}px;
                height: ${size}px;
                animation-delay: ${delay}s;
                animation-duration: ${duration}s;
            `;
            
            // Random color variation
            const colors = ['#00d4ff', '#a855f7', '#ec4899'];
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];
            
            this.container.appendChild(particle);
            this.particles.push(particle);
        }

        destroy() {
            this.particles.forEach(p => p.remove());
            this.particles = [];
        }
    }

    // ============================================
    // WAVEFORM VISUALIZATION
    // ============================================
    class WaveformVisualization {
        constructor(container, options = {}) {
            this.container = container;
            this.barCount = options.barCount || 20;
            this.bars = [];
            this.isPlaying = false;
            this.animationFrame = null;
            this.init();
        }

        init() {
            if (!this.container) return;
            
            // Create waveform bars
            for (let i = 0; i < this.barCount; i++) {
                const bar = document.createElement('div');
                bar.className = 'waveform-bar';
                bar.style.height = `${Math.random() * 20 + 5}px`;
                bar.style.animationDelay = `${i * 0.05}s`;
                this.container.appendChild(bar);
                this.bars.push(bar);
            }
        }

        animate() {
            if (!this.isPlaying) return;
            
            this.bars.forEach((bar, i) => {
                const height = 5 + Math.sin(Date.now() * 0.01 + i * 0.5) * 15 + Math.random() * 10;
                bar.style.height = `${height}px`;
            });
            
            this.animationFrame = requestAnimationFrame(() => this.animate());
        }

        start() {
            this.isPlaying = true;
            this.bars.forEach(bar => bar.classList.add('active'));
            this.animate();
        }

        stop() {
            this.isPlaying = false;
            this.bars.forEach(bar => bar.classList.remove('active'));
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
            }
            // Reset to default height
            this.bars.forEach(bar => {
                bar.style.height = '20px';
            });
        }

        destroy() {
            this.stop();
            this.bars.forEach(b => b.remove());
            this.bars = [];
        }
    }

    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================
    class KeyboardShortcuts {
        constructor(audioPlayer) {
            this.audioPlayer = audioPlayer;
            this.hintTimeout = null;
            this.hintElement = null;
            this.init();
        }

        init() {
            // Create hint element
            this.hintElement = document.createElement('div');
            this.hintElement.className = 'keyboard-shortcuts-hint';
            this.hintElement.innerHTML = `
                <span>Shortcuts:</span>
                <kbd>Space</kbd> Play/Pause
                <kbd>Arrow</kbd> Seek
            `;
            document.body.appendChild(this.hintElement);

            // Show hint on first interaction
            document.addEventListener('keydown', (e) => {
                if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                    this.showHint();
                }
            }, { once: true });

            // Keyboard event listeners
            document.addEventListener('keydown', (e) => this.handleKeydown(e));
        }

        handleKeydown(e) {
            // Don't trigger if user is typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.seek(-5);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.seek(5);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.adjustVolume(0.1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.adjustVolume(-0.1);
                    break;
                case 'KeyM':
                    e.preventDefault();
                    this.toggleMute();
                    break;
                case 'KeyN':
                    e.preventDefault();
                    this.nextTrack();
                    break;
                case 'KeyP':
                    e.preventDefault();
                    this.prevTrack();
                    break;
            }
        }

        togglePlay() {
            if (window.persistentPlayer && typeof window.persistentPlayer.togglePlay === 'function') {
                window.persistentPlayer.togglePlay();
                return;
            }
            const playBtn = document.getElementById('flpPlayBtn') || document.getElementById('floatingPlayBtn');
            if (playBtn) playBtn.click();
        }

        seek(seconds) {
            const audio = window.persistentPlayer?.audio;
            if (audio && audio.duration) {
                audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
            }
        }

        adjustVolume(delta) {
            const audio = window.persistentPlayer?.audio;
            if (audio) {
                audio.volume = Math.max(0, Math.min(1, audio.volume + delta));
            }
        }

        toggleMute() {
            const audio = window.persistentPlayer?.audio;
            if (audio) {
                audio.muted = !audio.muted;
            }
        }

        nextTrack() {
            const nextBtn = document.getElementById('nextBtn') || document.getElementById('floatingNextBtn');
            if (nextBtn) nextBtn.click();
        }

        prevTrack() {
            const prevBtn = document.getElementById('prevBtn') || document.getElementById('floatingPrevBtn');
            if (prevBtn) prevBtn.click();
        }

        showHint() {
            this.hintElement.classList.add('visible');
            
            if (this.hintTimeout) {
                clearTimeout(this.hintTimeout);
            }
            
            this.hintTimeout = setTimeout(() => {
                this.hintElement.classList.remove('visible');
            }, 5000);
        }

        destroy() {
            if (this.hintTimeout) {
                clearTimeout(this.hintTimeout);
            }
            if (this.hintElement) {
                this.hintElement.remove();
            }
        }
    }

    // ============================================
    // LOADING SKELETON MANAGER
    // ============================================
    class LoadingSkeletonManager {
        constructor() {
            this.skeletonContainer = document.getElementById('loadingSkeletons');
            this.gridContainer = document.getElementById('musicGrid');
        }

        show() {
            if (this.skeletonContainer) {
                this.skeletonContainer.classList.remove('hidden');
            }
            if (this.gridContainer) {
                this.gridContainer.style.opacity = '0';
            }
        }

        hide() {
            if (this.skeletonContainer) {
                this.skeletonContainer.classList.add('hidden');
            }
            if (this.gridContainer) {
                this.gridContainer.style.opacity = '1';
                this.gridContainer.style.transition = 'opacity 0.3s ease';
            }
        }
    }

    // ============================================
    // SEARCH UX ENHANCEMENTS
    // ============================================
    class SearchEnhancements {
        constructor() {
            this.searchInput = document.getElementById('musicSearch');
            this.clearBtn = document.getElementById('searchClear');
            this.filterToggle = document.getElementById('searchFilterToggle');
            this.filtersContainer = document.getElementById('searchFilters');
            this.init();
        }

        init() {
            if (!this.searchInput) return;

            // Clear button visibility
            this.searchInput.addEventListener('input', () => {
                if (this.clearBtn) {
                    if (this.searchInput.value.length > 0) {
                        this.clearBtn.classList.add('visible');
                    } else {
                        this.clearBtn.classList.remove('visible');
                    }
                }
            });

            // Clear button click
            if (this.clearBtn) {
                this.clearBtn.addEventListener('click', () => {
                    this.searchInput.value = '';
                    this.clearBtn.classList.remove('visible');
                    this.searchInput.dispatchEvent(new Event('input'));
                    this.searchInput.focus();
                });
            }

            // Filter toggle
            if (this.filterToggle && this.filtersContainer) {
                this.filterToggle.addEventListener('click', () => {
                    this.filtersContainer.classList.toggle('show');
                    this.filterToggle.classList.toggle('active');
                });
            }

            // Keyboard shortcut for search
            document.addEventListener('keydown', (e) => {
                if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    this.searchInput.focus();
                }
                if (e.key === 'Escape' && document.activeElement === this.searchInput) {
                    this.searchInput.blur();
                    if (this.filtersContainer) {
                        this.filtersContainer.classList.remove('active');
                    }
                }
            });
        }
    }

    // ============================================
    // NEWSLETTER FORM
    // ============================================
    class NewsletterForm {
        constructor() {
            this.form = document.querySelector('.newsletter-form');
            this.input = document.getElementById('newsletterEmail');
            this.button = document.getElementById('newsletterSubmit');
            this.init();
        }

        init() {
            if (!this.form || !this.input || !this.button) return;

            this.button.addEventListener('click', async (e) => {
                e.preventDefault();
                
                const email = this.input.value.trim();
                
                if (!this.validateEmail(email)) {
                    this.showError('Please enter a valid email address');
                    return;
                }

                this.setLoading(true);
                
                // Simulate API call (replace with actual implementation)
                try {
                    await this.submitEmail(email);
                    this.showSuccess();
                    this.input.value = '';
                } catch (error) {
                    this.showError('Something went wrong. Please try again.');
                } finally {
                    this.setLoading(false);
                }
            });
        }

        validateEmail(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        }

        setLoading(loading) {
            this.button.disabled = loading;
            const span = this.button.querySelector('span');
            if (span) {
                span.textContent = loading ? 'Subscribing...' : 'Subscribe';
            }
            const icon = this.button.querySelector('i');
            if (icon) {
                icon.className = loading ? 'fas fa-spinner fa-spin' : 'fas fa-paper-plane';
            }
        }

        async submitEmail(email) {
            // TODO: Replace with actual API call
            return new Promise((resolve) => {
                setTimeout(resolve, 1500);
            });
        }

        showSuccess() {
            this.showMessage('Thanks for subscribing!', 'success');
        }

        showError(message) {
            this.showMessage(message, 'error');
        }

        showMessage(message, type) {
            // Remove existing message
            const existing = this.form.querySelector('.newsletter-message');
            if (existing) existing.remove();

            const msg = document.createElement('div');
            msg.className = `newsletter-message newsletter-message-${type}`;
            msg.textContent = message;
            msg.style.cssText = `
                margin-top: 1rem;
                padding: 0.75rem 1rem;
                border-radius: 8px;
                font-size: 0.9rem;
                text-align: center;
                background: ${type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
                color: ${type === 'success' ? '#10b981' : '#ef4444'};
                animation: slideIn 0.3s ease;
            `;
            this.form.appendChild(msg);

            setTimeout(() => {
                msg.style.opacity = '0';
                setTimeout(() => msg.remove(), 300);
            }, 4000);
        }
    }

    // ============================================
    // TRACK CARD INTERACTIONS
    // ============================================
    class TrackCardEnhancements {
        constructor() {
            this.init();
        }

        init() {
            // Use event delegation for dynamically loaded cards
            document.addEventListener('click', (e) => {
                const target = (e && e.target instanceof Element)
                    ? e.target
                    : (Array.isArray(e?.composedPath?.()) ? e.composedPath().find((n) => n instanceof Element) : null)

                if (!target) return
                // Like button
                const likeBtn = target.closest('.like-btn-mini');
                if (likeBtn) {
                    this.handleLike(likeBtn);
                }

                // Play button ripple effect
                const playBtn = target.closest('.play-btn-overlay');
                if (playBtn) {
                    this.addRippleEffect(playBtn);
                }
            });

            // Add hover sound effect (optional)
            document.addEventListener('mouseenter', (e) => {
                const target = (e && e.target instanceof Element)
                    ? e.target
                    : (Array.isArray(e?.composedPath?.()) ? e.composedPath().find((n) => n instanceof Element) : null)
                const card = target ? target.closest('.track-card') : null;
                if (card && !card.dataset.soundPlayed) {
                    // Could add subtle hover sound here
                    card.dataset.soundPlayed = 'true';
                }
            }, true);

            document.addEventListener('mouseleave', (e) => {
                const target = (e && e.target instanceof Element)
                    ? e.target
                    : (Array.isArray(e?.composedPath?.()) ? e.composedPath().find((n) => n instanceof Element) : null)
                const card = target ? target.closest('.track-card') : null;
                if (card) {
                    delete card.dataset.soundPlayed;
                }
            }, true);
        }

        handleLike(btn) {
            const icon = btn.querySelector('i');
            
            if (icon.classList.contains('far')) {
                // Like
                icon.classList.remove('far');
                icon.classList.add('fas');
                btn.classList.add('liked');
            } else {
                // Unlike
                icon.classList.remove('fas');
                icon.classList.add('far');
                btn.classList.remove('liked');
            }
        }

        addRippleEffect(btn) {
            btn.style.position = 'relative';
            btn.style.overflow = 'hidden';
            
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.3);
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;
            
            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = '50%';
            ripple.style.top = '50%';
            ripple.style.marginLeft = -size / 2 + 'px';
            ripple.style.marginTop = -size / 2 + 'px';
            
            btn.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        }
    }

    // ============================================
    // SMOOTH SCROLL
    // ============================================
    class SmoothScroll {
        constructor() {
            this.init();
        }

        init() {
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', (e) => {
                    const href = anchor.getAttribute('href');
                    if (href === '#') return;
                    
                    e.preventDefault();
                    const target = document.querySelector(href);
                    
                    if (target) {
                        const headerOffset = 80;
                        const elementPosition = target.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                        window.scrollTo({
                            top: offsetPosition,
                            behavior: 'smooth'
                        });
                    }
                });
            });
        }
    }

    // ============================================
    // AUDIO PLAYER SYNC
    // ============================================
    class AudioPlayerSync {
        constructor() {
            this.audio = null;
            this.playerWaveform = null;
            this.floatingWaveform = null;
            this.playerCover = document.querySelector('.player-cover');
            this.init();
        }

        init() {
            if (!this.audio) return;

            // Initialize waveforms
            const playerWaveformContainer = document.getElementById('playerWaveform');
            const floatingWaveformContainer = document.getElementById('floatingWaveform');
            
            if (playerWaveformContainer) {
                this.playerWaveform = new WaveformVisualization(playerWaveformContainer, { barCount: 30 });
            }
            
            if (floatingWaveformContainer) {
                // Floating waveform is simpler - just a progress indicator
            }

            // Audio events
            this.audio.addEventListener('play', () => this.onPlay());
            this.audio.addEventListener('pause', () => this.onPause());
            this.audio.addEventListener('ended', () => this.onEnded());

            // Update floating player time display
            this.audio.addEventListener('timeupdate', () => this.updateTimeDisplay());
        }

        onPlay() {
            if (this.playerWaveform) {
                this.playerWaveform.start();
            }
            if (this.playerCover) {
                this.playerCover.classList.add('playing');
            }
        }

        onPause() {
            if (this.playerWaveform) {
                this.playerWaveform.stop();
            }
            if (this.playerCover) {
                this.playerCover.classList.remove('playing');
            }
        }

        onEnded() {
            this.onPause();
        }

        updateTimeDisplay() {
            const currentTime = document.getElementById('floatingCurrentTime');
            const duration = document.getElementById('floatingDuration');
            
            if (currentTime && this.audio.currentTime) {
                currentTime.textContent = this.formatTime(this.audio.currentTime);
            }
            
            if (duration && this.audio.duration) {
                duration.textContent = this.formatTime(this.audio.duration);
            }
        }

        formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // ============================================
    // INITIALIZE ALL ENHANCEMENTS
    // ============================================
    class MusicEnhancements {
        constructor() {
            this.particles = null;
            this.keyboardShortcuts = null;
            this.loadingSkeleton = null;
            this.search = null;
            this.newsletter = null;
            this.trackCards = null;
            this.smoothScroll = null;
            this.audioSync = null;
        }

        init() {
            // Initialize particle background
            const particleContainer = document.getElementById('heroParticles');
            if (particleContainer) {
                this.particles = new ParticleBackground(particleContainer);
            }

            // Initialize keyboard shortcuts
            this.keyboardShortcuts = new KeyboardShortcuts(null);

            // Initialize loading skeleton manager
            this.loadingSkeleton = new LoadingSkeletonManager();

            // Initialize search enhancements
            this.search = new SearchEnhancements();

            // Initialize newsletter form
            this.newsletter = new NewsletterForm();

            // Initialize track card enhancements
            this.trackCards = new TrackCardEnhancements();

            // Initialize smooth scroll
            this.smoothScroll = new SmoothScroll();

            // Initialize audio player sync
            this.audioSync = new AudioPlayerSync();

            // Hide loading skeleton when content is loaded
            this.setupContentLoadedHandler();

            console.log('[MusicEnhancements] Initialized');
        }

        setupContentLoadedHandler() {
            // Listen for when music grid is populated
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.target.id === 'musicGrid' && mutation.addedNodes.length > 0) {
                        this.loadingSkeleton.hide();
                    }
                });
            });

            const musicGrid = document.getElementById('musicGrid');
            if (musicGrid) {
                observer.observe(musicGrid, { childList: true });
            }

            // Also listen for custom events from music-page.js
            document.addEventListener('music:loaded', () => {
                this.loadingSkeleton.hide();
            });

            // Fallback: hide after timeout
            setTimeout(() => {
                this.loadingSkeleton.hide();
            }, 5000);
        }

        destroy() {
            if (this.particles) this.particles.destroy();
            if (this.keyboardShortcuts) this.keyboardShortcuts.destroy();
            if (this.playerWaveform) this.playerWaveform.destroy();
        }
    }

    // Initialize when DOM is ready
    function initEnhancements() {
        if (document.querySelector('[data-include]')) {
            // Wait for includes to load
            document.addEventListener('includes:loaded', () => {
                window.musicEnhancements = new MusicEnhancements();
                window.musicEnhancements.init();
            });
        } else {
            window.musicEnhancements = new MusicEnhancements();
            window.musicEnhancements.init();
        }
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEnhancements);
    } else {
        initEnhancements();
    }

    // Expose classes for external use
    window.MusicEnhancementsClasses = {
        ParticleBackground,
        WaveformVisualization,
        KeyboardShortcuts,
        LoadingSkeletonManager,
        SearchEnhancements,
        NewsletterForm,
        TrackCardEnhancements,
        SmoothScroll,
        AudioPlayerSync
    };

})();
