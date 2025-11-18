// Main JavaScript - Global Scripts & DOM Management

document.addEventListener("DOMContentLoaded", () => {
    initHeader()
    initNavigation()
    initSmoothScroll()
    initTestimonialCarousel()
    initContactForm()
    initTrackCards()
    setActiveNavLink()
    initMembership() // ADD THIS LINE
})

// Header Scroll Effect
function initHeader() {
    const header = document.getElementById("header")

    window.addEventListener("scroll", () => {
        if (window.scrollY > 100) {
            header.classList.add("scrolled")
        } else {
            header.classList.remove("scrolled")
        }
    })
}

// Mobile Navigation Toggle
function initNavigation() {
    const hamburger = document.getElementById("hamburger")
    const nav = document.getElementById("nav")
    const navLinks = document.querySelectorAll(".nav-link")

    if (hamburger) {
        hamburger.addEventListener("click", () => {
            hamburger.classList.toggle("active")
            nav.classList.toggle("active")
        })
    }

    navLinks.forEach((link) => {
        link.addEventListener("click", () => {
            if (hamburger) {
                hamburger.classList.remove("active")
                nav.classList.remove("active")
            }
        })
    })
}

// Set active navigation link based on current page
function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html'
    const navLinks = document.querySelectorAll('.nav-link')
    
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href')
        if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active')
        }
    })
}

// Smooth Scrolling for Navigation Links
function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]')

    links.forEach((link) => {
        link.addEventListener("click", function (e) {
            const targetId = this.getAttribute("href")
            if (targetId.startsWith('#')) {
                e.preventDefault()
                const target = document.querySelector(targetId)

                if (target) {
                    const headerHeight = 80
                    const targetPosition = target.offsetTop - headerHeight

                    window.scrollTo({
                        top: targetPosition,
                        behavior: "smooth",
                    })
                }
            }
        })
    })
}

// Testimonials Carousel
function initTestimonialCarousel() {
    const slides = document.querySelectorAll(".testimonial-slide")
    const dotsContainer = document.getElementById("carouselDots")
    const prevBtn = document.getElementById("prevTestimonial")
    const nextBtn = document.getElementById("nextTestimonial")

    if (slides.length === 0) return

    let currentSlide = 0

    // Create dots if container exists
    if (dotsContainer) {
        slides.forEach((_, index) => {
            const dot = document.createElement("div")
            dot.className = `carousel-dot ${index === 0 ? "active" : ""}`
            dot.addEventListener("click", () => goToSlide(index))
            dotsContainer.appendChild(dot)
        })
    }

    function showSlide(n) {
        slides.forEach((slide) => slide.classList.remove("active"))
        document.querySelectorAll(".carousel-dot").forEach((dot) => dot.classList.remove("active"))

        slides[n].classList.add("active")
        if (dotsContainer) {
            document.querySelectorAll(".carousel-dot")[n].classList.add("active")
        }
    }

    function goToSlide(n) {
        currentSlide = n
        showSlide(currentSlide)
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length
        showSlide(currentSlide)
    }

    function prevSlide() {
        currentSlide = (currentSlide - 1 + slides.length) % slides.length
        showSlide(currentSlide)
    }

    if (prevBtn) {
        prevBtn.addEventListener("click", prevSlide)
    }
    
    if (nextBtn) {
        nextBtn.addEventListener("click", nextSlide)
    }

    // Auto-rotate testimonials
    setInterval(nextSlide, 8000)

    showSlide(0)
}

// Contact Form Validation
function initContactForm() {
    const form = document.getElementById("contactForm")

    if (!form) return

    form.addEventListener("submit", (e) => {
        e.preventDefault()

        if (validateForm()) {
            // Show success message
            alert("Thank you for reaching out! We'll get back to you soon.")
            form.reset()
            clearErrors()
        }
    })
}

function validateForm() {
    const name = document.getElementById("name")
    const email = document.getElementById("email")
    const subject = document.getElementById("subject")
    const message = document.getElementById("message")

    let isValid = true

    // Clear previous errors
    clearErrors()

    // Validate Name
    if (name && name.value.trim() === "") {
        showError("name", "Name is required")
        isValid = false
    }

    // Validate Email
    if (email && email.value.trim() === "") {
        showError("email", "Email is required")
        isValid = false
    } else if (email && !isValidEmail(email.value)) {
        showError("email", "Please enter a valid email")
        isValid = false
    }

    // Validate Subject
    if (subject && subject.value === "") {
        showError("subject", "Please select a subject")
        isValid = false
    }

    // Validate Message
    if (message && message.value.trim() === "") {
        showError("message", "Message is required")
        isValid = false
    } else if (message && message.value.trim().length < 10) {
        showError("message", "Message must be at least 10 characters")
        isValid = false
    }

    return isValid
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

function showError(fieldId, errorMessage) {
    const field = document.getElementById(fieldId)
    const errorElement = document.getElementById(`${fieldId}Error`)
    const formGroup = field.closest(".form-group")

    formGroup.classList.add("error")
    errorElement.textContent = errorMessage
    errorElement.classList.add("show")
}

function clearErrors() {
    document.querySelectorAll(".form-group").forEach((group) => {
        group.classList.remove("error")
    })
    document.querySelectorAll(".error-message").forEach((msg) => {
        msg.classList.remove("show")
        msg.textContent = ""
    })
}

// Track Card Click - Play Track
function initTrackCards() {
    const trackCards = document.querySelectorAll(".track-card")

    trackCards.forEach((card) => {
        card.addEventListener("click", function () {
            const trackIndex = this.getAttribute("data-track")
            const audioPlayer = document.getElementById("audioPlayer")
            // Scroll to player if it exists on this page
            if (audioPlayer) {
                audioPlayer.scrollIntoView({ behavior: "smooth", block: "nearest" })
            }
        })
    })
}
// Membership functionality
document.addEventListener('DOMContentLoaded', function() {
    
    
    // Plan data
    const plans = {
        weekly: {
            name: 'Weekly Pass',
            price: 'UGX 150,000',
            period: 'week',
            description: '10 hours of studio time, basic mixing for 2 tracks'
        },
        monthly: {
            name: 'Monthly Pro',
            price: 'UGX 500,000',
            period: 'month',
            description: '50 hours of studio time, unlimited mixing sessions'
        },
        yearly: {
            name: 'Yearly Elite',
            price: 'UGX 5,000,000',
            period: 'year',
            description: '600 hours of studio time, unlimited mixing & mastering'
        }
    };
    
    // Event listeners
    planSelectButtons.forEach(button => {
        button.addEventListener('click', function() {
            const planType = this.getAttribute('data-plan');
            openMembershipModal(planType);
        });
    });
    
    // Payment option selection
    membershipModal.addEventListener('click', function(e) {
        if (e.target.classList.contains('payment-option')) {
            document.querySelectorAll('.payment-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            e.target.classList.add('selected');
        }
    });
    
    // Close modal
    membershipModal.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-close') || e.target.classList.contains('membership-modal')) {
            closeMembershipModal();
        }
    });
    
    // Form submission
    const subscriptionForm = document.getElementById('subscriptionForm');
    subscriptionForm.addEventListener('submit', function(e) {
        e.preventDefault();
        processSubscription();
    });
    
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && membershipModal.classList.contains('active')) {
            closeMembershipModal();
        }
    });
});

// === MUSIC FILTERS FUNCTIONALITY ===
class MusicFilters {
    constructor() {
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.trackCards = document.querySelectorAll('.track-card');
        this.musicGrid = document.getElementById('musicGrid');
        
        if (this.filterButtons.length > 0) {
            this.init();
        }
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.handleFilterClick(e);
            });
        });
    }
    
    handleFilterClick(e) {
        const button = e.currentTarget;
        const filter = button.dataset.filter;
        
        // Update active state
        this.filterButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
        
        // Filter tracks
        this.filterTracks(filter);
        
        // Add click animation
        this.animateButtonClick(button);
    }
    
    filterTracks(filter) {
        let visibleCount = 0;
        
        this.trackCards.forEach(card => {
            const category = card.dataset.category;
            const shouldShow = filter === 'all' || category === filter;
            
            if (shouldShow) {
                card.style.display = 'block';
                visibleCount++;
                
                // Add animation delay for staggered appearance
                setTimeout(() => {
                    card.classList.add('filter-visible');
                    card.classList.remove('filter-hidden');
                }, visibleCount * 50);
            } else {
                card.classList.add('filter-hidden');
                card.classList.remove('filter-visible');
                
                // Hide after animation
                setTimeout(() => {
                    card.style.display = 'none';
                }, 300);
            }
        });
        
        // Show message if no tracks found
        this.showNoResultsMessage(visibleCount === 0, filter);
    }
    
    animateButtonClick(button) {
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = '';
        }, 150);
    }
    
    showNoResultsMessage(show, filter) {
        // Remove existing message
        const existingMessage = this.musicGrid.querySelector('.no-results-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        if (show) {
            const message = document.createElement('div');
            message.className = 'no-results-message';
            message.innerHTML = `
                <div class="no-results-content">
                    <i class="fas fa-music"></i>
                    <h4>No ${this.getFilterDisplayName(filter)} Found</h4>
                    <p>Check back later for new ${this.getFilterDisplayName(filter).toLowerCase()} tracks</p>
                </div>
            `;
            this.musicGrid.appendChild(message);
        }
    }
    
    getFilterDisplayName(filter) {
        const names = {
            'all': 'Tracks',
            'new': 'New Releases',
            'popular': 'Popular Tracks',
            'trending': 'Trending Tracks'
        };
        return names[filter] || 'Tracks';
    }
}

// Initialize music filters when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize music filters
    new MusicFilters();
});