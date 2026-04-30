// Main JavaScript - Global Scripts & DOM Management

function initApp() {
    initHeader()
    initNavigation()
    initSmoothScroll()
    initTestimonialCarousel()
    initContactForm()
    initTrackCards()
    setActiveNavLink()
    initMembership()
    initFooterCtaRotator()
    initServicesHero()
    initHomeHero()
    initContactHero()
    initMusicHero()
    initVideoAutoplay()
    initClipboardSupport()
    initSocialLinks()
}

document.addEventListener("DOMContentLoaded", () => {
    // If the page uses partial includes, wait for them so header elements exist.
    // Otherwise run immediately.
    if (document.querySelector('[data-include]')) return
    initApp()
})

document.addEventListener('includes:loaded', () => {
    initApp()
})

// Header Scroll Effect
function initHeader() {
    const header = document.getElementById("header")
    let lastScrollY = window.scrollY
    let ticking = false

    if (!header) return

    window.addEventListener("scroll", () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const currentScrollY = window.scrollY

                // Add/remove scrolled class for background effect
                if (currentScrollY > 100) {
                    header.classList.add("scrolled")
                } else {
                    header.classList.remove("scrolled")
                }

                // Hide header when scrolling down, show when scrolling up
                if (currentScrollY > lastScrollY && currentScrollY > 100) {
                    header.classList.add("hidden")
                } else if (currentScrollY < lastScrollY) {
                    header.classList.remove("hidden")
                }

                lastScrollY = currentScrollY
                ticking = false
            })
            ticking = true
        }
    })
}

// Mobile Navigation Toggle
function initNavigation() {
    const hamburger = document.getElementById("hamburger")
    const nav = document.getElementById("nav")
    const navLinks = document.querySelectorAll(".nav-link")
    const profileBtn = document.getElementById("profileBtn")
    const profileDropdown = document.getElementById("profileDropdown")
    const mobileNavOverlay = document.getElementById("mobileNavOverlay")

    if (hamburger) {
        hamburger.addEventListener("click", () => {
            const isActive = hamburger.classList.toggle("active")
            if (nav) nav.classList.toggle("active")
            if (mobileNavOverlay) mobileNavOverlay.classList.toggle("active", isActive)
            
            // Close profile dropdown when opening mobile menu
            if (profileDropdown) {
                profileDropdown.classList.remove("active")
            }

            // Prevent body scroll when menu is open
            document.body.style.overflow = isActive ? 'hidden' : ''
            
            // Add ARIA attributes for accessibility
            hamburger.setAttribute("aria-expanded", isActive)
            if (nav) {
                nav.setAttribute("aria-hidden", !isActive)
            }
        })
    }

    navLinks.forEach((link) => {
        link.addEventListener("click", () => {
            closeMobileMenu()
        })
    })

    // Handle profile button click on mobile
    if (profileBtn) {
        profileBtn.addEventListener("click", (e) => {
            // Let auth.js own the actual profile behavior (navigate on mobile, dropdown on desktop).
            // Here we only manage the mobile menu container.
            e.stopPropagation()

            // On mobile, if nav is open, close it first
            if (nav && nav.classList.contains("active")) {
                closeMobileMenu()
            }
        })
    }

    // Close mobile menu when clicking overlay
    if (mobileNavOverlay) {
        mobileNavOverlay.addEventListener("click", closeMobileMenu)
    }

    // Close mobile menu when clicking outside
    document.addEventListener("click", (e) => {
        if (hamburger && nav && nav.classList.contains("active")) {
            if (!nav.contains(e.target) && !hamburger.contains(e.target)) {
                closeMobileMenu()
            }
        }
    })

    // Close mobile menu on Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === 'Escape' && nav && nav.classList.contains("active")) {
            closeMobileMenu()
        }
    })

    // Add touch gesture support for swipe to close
    if (nav) {
        let touchStartX = 0
        let touchEndX = 0

        nav.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX
        })

        nav.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX
            handleSwipe()
        })

        function handleSwipe() {
            // Swipe right to close (from left edge of screen)
            if (touchEndX - touchStartX > 100 && touchStartX < 50) {
                closeMobileMenu()
            }
        }
    }

    // Helper function to close mobile menu
    function closeMobileMenu() {
        if (hamburger) {
            hamburger.classList.remove("active")
            hamburger.setAttribute("aria-expanded", "false")
        }
        if (nav) {
            nav.classList.remove("active")
            nav.setAttribute("aria-hidden", "true")
        }
        if (mobileNavOverlay) {
            mobileNavOverlay.classList.remove("active")
        }
        document.body.style.overflow = ''
    }
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
            if (window.notifications) {
                window.notifications.show("Thank you for reaching out! We'll get back to you soon.", 'success')
            } else {
                console.log("Thank you for reaching out! We'll get back to you soon.")
            }
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

    if (!field || !errorElement) return

    const formGroup = field.closest(".form-group")
    if (!formGroup) return

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

// Track Card Click - Redirect to Spotify or Play Track
function initTrackCards() {
    const trackCards = document.querySelectorAll(".track-card")

    trackCards.forEach((card) => {
        card.addEventListener("click", function () {
            const spotifyUrl = this.getAttribute("data-spotify-url")
            
            // If Spotify URL exists, redirect to Spotify
            if (spotifyUrl && spotifyUrl.trim() !== '') {
                window.open(spotifyUrl, '_blank')
                return
            }
            
            // Otherwise, use the regular audio player
            const trackIndex = this.getAttribute("data-track")
            const audioPlayer = document.getElementById("audioPlayer")
            // Scroll to player if it exists on this page
            if (audioPlayer) {
                audioPlayer.scrollIntoView({ behavior: "smooth", block: "nearest" })
            }
        })
    })
}

// Global function to update plan cards from config (called from config-loader)
window.updatePlanCardsFromConfig = function(config) {
    if (!config || !config.plans) return
    
    const weeklyPrice = config.plans.weekly?.price || 0
    const monthlyPrice = config.plans.monthly?.price || 0
    const yearlyPrice = config.plans.yearly?.price || 0
    
    // Update weekly plan
    if (config.plans.weekly) {
        const weeklyPriceEl = document.getElementById('weekly-plan-price')
        const weeklyBtn = document.getElementById('weekly-plan-btn')
        if (weeklyPriceEl) weeklyPriceEl.textContent = `UGX ${weeklyPrice.toLocaleString()}`
        if (weeklyBtn) weeklyBtn.setAttribute('data-amount', weeklyPrice)
    }
    
    // Update monthly plan
    if (config.plans.monthly) {
        const monthlyPriceEl = document.getElementById('monthly-plan-price')
        const monthlyBtn = document.getElementById('monthly-plan-btn')
        const monthlySavingsEl = document.getElementById('monthly-plan-savings')
        
        if (monthlyPriceEl) monthlyPriceEl.textContent = `UGX ${monthlyPrice.toLocaleString()}`
        if (monthlyBtn) monthlyBtn.setAttribute('data-amount', monthlyPrice)
        
        // Calculate monthly savings: (weekly × 4) - monthly
        const weeklyMonthlyEquivalent = weeklyPrice * 4
        const monthlySavings = weeklyMonthlyEquivalent - monthlyPrice
        if (monthlySavingsEl && monthlySavings > 0) {
            monthlySavingsEl.textContent = `Save UGX ${monthlySavings.toLocaleString()}`
            monthlySavingsEl.style.display = 'block'
        } else if (monthlySavingsEl) {
            monthlySavingsEl.style.display = 'none'
        }
    }
    
    // Update yearly plan
    if (config.plans.yearly) {
        const yearlyPriceEl = document.getElementById('yearly-plan-price')
        const yearlyBtn = document.getElementById('yearly-plan-btn')
        const yearlySavingsEl = document.getElementById('yearly-plan-savings')
        
        if (yearlyPriceEl) yearlyPriceEl.textContent = `UGX ${yearlyPrice.toLocaleString()}`
        if (yearlyBtn) yearlyBtn.setAttribute('data-amount', yearlyPrice)
        
        // Calculate yearly savings: (monthly × 12) - yearly
        const monthlyYearlyEquivalent = monthlyPrice * 12
        const yearlySavings = monthlyYearlyEquivalent - yearlyPrice
        if (yearlySavingsEl && yearlySavings > 0) {
            yearlySavingsEl.textContent = `Save UGX ${yearlySavings.toLocaleString()}`
            yearlySavingsEl.style.display = 'block'
        } else if (yearlySavingsEl) {
            yearlySavingsEl.style.display = 'none'
        }
    }
}

// Global function to update service prices from config
window.updateServicePricesFromConfig = function(config) {
    if (!config || !config.services) return
    
    const services = config.services
    
    // Update production price
    if (services.production) {
        const el = document.getElementById('production-price')
        if (el) el.textContent = `UGX ${services.production.toLocaleString()}`
    }
    
    // Update mixing price
    if (services.mixing) {
        const el = document.getElementById('mixing-price')
        if (el) el.textContent = `UGX ${services.mixing.toLocaleString()}`
    }
    
    // Update mastering price
    if (services.mastering) {
        const el = document.getElementById('mastering-price')
        if (el) el.textContent = `UGX ${services.mastering.toLocaleString()}`
    }
    
    // Update vocal price
    if (services.vocal) {
        const el = document.getElementById('vocal-price')
        if (el) el.textContent = `UGX ${services.vocal.toLocaleString()}`
    }
    
    // Update Music Lessons hourly rate (use lesson-specific field first, fallback to general)
    if (services.lessonHourlyRate) {
        const el = document.getElementById('hourly-rate')
        if (el) el.textContent = `UGX ${services.lessonHourlyRate.toLocaleString()}`
    } else if (services.hourlyRate) {
        const el = document.getElementById('hourly-rate')
        if (el) el.textContent = `UGX ${services.hourlyRate.toLocaleString()}`
    }
    
    // Update Music Lessons package price (use lesson-specific field first, fallback to general)
    if (services.lessonPackagePrice) {
        const el = document.getElementById('package-price')
        if (el) el.textContent = `UGX ${services.lessonPackagePrice.toLocaleString()}`
    } else if (services.packagePrice) {
        const el = document.getElementById('package-price')
        if (el) el.textContent = `UGX ${services.packagePrice.toLocaleString()}`
    }
    
    // Update songwriting price
    if (services.songwriting) {
        const el = document.getElementById('songwriting-price')
        if (el) el.textContent = `UGX ${services.songwriting.toLocaleString()}`
    }
    
    // Update restoration price
    if (services.restoration) {
        const el = document.getElementById('restoration-price')
        if (el) el.textContent = `UGX ${services.restoration.toLocaleString()}`
    }
    
    // Update session musician price (range)
    if (services.sessionMusicianMin && services.sessionMusicianMax) {
        const el = document.getElementById('session-musician-price')
        if (el) el.textContent = `UGX ${services.sessionMusicianMin.toLocaleString()}-${services.sessionMusicianMax.toLocaleString()}`
    }
}

// Global function to update budget tiers from config
window.updateBudgetTiersFromConfig = function(config) {
    if (!config || !config.budgetTiers) return
    
    const tiers = config.budgetTiers
    
    // Update standard budget
    if (tiers.standard) {
        const el = document.getElementById('budget-standard')
        if (el) {
            el.textContent = `UGX ${tiers.standard.toLocaleString()} - Standard`
            el.setAttribute('value', tiers.standard)
        }
    }
    
    // Update classic budget
    if (tiers.classic) {
        const el = document.getElementById('budget-classic')
        if (el) {
            el.textContent = `UGX ${tiers.classic.toLocaleString()} - Classic`
            el.setAttribute('value', tiers.classic)
        }
    }
    
    // Update premium budget
    if (tiers.premium) {
        const el = document.getElementById('budget-premium')
        if (el) {
            el.textContent = `UGX ${tiers.premium.toLocaleString()} - Premium`
            el.setAttribute('value', tiers.premium)
        }
    }
    
    // Update deluxe budget
    if (tiers.deluxe) {
        const el = document.getElementById('budget-deluxe')
        if (el) {
            el.textContent = `UGX ${tiers.deluxe.toLocaleString()} - Deluxe`
            el.setAttribute('value', tiers.deluxe)
        }
    }
}

// Global function to update billing cycle options from config
window.updateBillingCycleOptionsFromConfig = function(config) {
    if (!config || !config.plans) return
    
    const plans = config.plans
    
    // Update weekly option
    if (plans.weekly) {
        const el = document.getElementById('billing-weekly')
        if (el) {
            el.textContent = `Weekly - UGX ${plans.weekly.price.toLocaleString()}`
        }
    }
    
    // Update monthly option
    if (plans.monthly) {
        const el = document.getElementById('billing-monthly')
        if (el) {
            el.textContent = `Monthly - UGX ${plans.monthly.price.toLocaleString()}`
        }
    }
    
    // Update yearly option
    if (plans.yearly) {
        const el = document.getElementById('billing-yearly')
        if (el) {
            el.textContent = `Yearly - UGX ${plans.yearly.price.toLocaleString()}`
        }
    }
}

function initMembership() {
    const membershipModal = document.getElementById('membershipModal')
    const planSelectButtons = document.querySelectorAll('.plan-select')
    const membershipForm = document.getElementById('membershipForm')

    if (!membershipModal || planSelectButtons.length === 0 || !membershipForm) return

    window.__membershipModalController = 'main'

    const selectedPlanName = document.getElementById('selectedPlanName')
    const selectedPlanPrice = document.getElementById('selectedPlanPrice')
    const selectedPlanDescription = document.getElementById('selectedPlanDescription')
    const billingCycle = document.getElementById('billingCycle')
    const paymentInstructions = document.getElementById('paymentInstructions')
    const instructionsTitle = document.getElementById('instructionsTitle')
    const instructionsText = document.getElementById('instructionsText')
    const transactionInput = document.getElementById('transactionInput')
    const transactionId = document.getElementById('transactionId')

    function prefillContactFields() {
        const fullNameEl = document.getElementById('fullName')
        const emailEl = document.getElementById('email')
        const phoneEl = document.getElementById('phone')

        const user = window.userAuth?.getCurrentUser?.() || null
        if (!user) return

        let cachedProfile = null
        try {
            const raw = localStorage.getItem(`userProfile_${user.uid}`)
            cachedProfile = raw ? JSON.parse(raw) : null
        } catch (_) {
            cachedProfile = null
        }

        const displayName = cachedProfile?.displayName || user.displayName || ''
        const email = cachedProfile?.email || user.email || ''
        const phone = cachedProfile?.phone || user.phoneNumber || ''

        if (fullNameEl && !fullNameEl.value.trim() && displayName) fullNameEl.value = displayName
        if (emailEl && !emailEl.value.trim() && email) emailEl.value = email
        if (phoneEl && !phoneEl.value.trim() && phone) phoneEl.value = phone
    }

    // Load plans from Firebase config
    const plans = {
        weekly: {
            name: 'Weekly Pass',
            price: 'UGX 150,000', // Default fallback
            period: 'week',
            description: '10 hours of studio time, basic mixing for 2 tracks' // Default fallback
        },
        monthly: {
            name: 'Monthly Pro',
            price: 'UGX 500,000', // Default fallback
            period: 'month',
            description: '50 hours of studio time, unlimited mixing sessions' // Default fallback
        },
        yearly: {
            name: 'Yearly Elite',
            price: 'UGX 5,000,000', // Default fallback
            period: 'year',
            description: '600 hours of studio time, unlimited mixing & mastering' // Default fallback
        }
    }

    // Try to load from Firebase config if available
    if (window.studioConfig && window.studioConfig.plans) {
        if (window.studioConfig.plans.weekly) {
            plans.weekly.price = `UGX ${window.studioConfig.plans.weekly.price.toLocaleString()}`
            plans.weekly.description = window.studioConfig.plans.weekly.description
        }
        if (window.studioConfig.plans.monthly) {
            plans.monthly.price = `UGX ${window.studioConfig.plans.monthly.price.toLocaleString()}`
            plans.monthly.description = window.studioConfig.plans.monthly.description
        }
        if (window.studioConfig.plans.yearly) {
            plans.yearly.price = `UGX ${window.studioConfig.plans.yearly.price.toLocaleString()}`
            plans.yearly.description = window.studioConfig.plans.yearly.description
        }
    }

    // Listen for settings updates
    window.addEventListener('settingsUpdated', (event) => {
        const config = event.detail
        if (config && config.plans) {
            if (config.plans.weekly) {
                plans.weekly.price = `UGX ${config.plans.weekly.price.toLocaleString()}`
                plans.weekly.description = config.plans.weekly.description
            }
            if (config.plans.monthly) {
                plans.monthly.price = `UGX ${config.plans.monthly.price.toLocaleString()}`
                plans.monthly.description = config.plans.monthly.description
            }
            if (config.plans.yearly) {
                plans.yearly.price = `UGX ${config.plans.yearly.price.toLocaleString()}`
                plans.yearly.description = config.plans.yearly.description
            }
        }
        // Update homepage plan cards
        updateHomepagePlanCards(config)
    })

    // Function to update homepage plan cards from config
    function updateHomepagePlanCards(config) {
        if (!config || !config.plans) return
        
        // Update weekly plan
        if (config.plans.weekly) {
            const weeklyPriceEl = document.getElementById('weekly-plan-price')
            const weeklyBtn = document.getElementById('weekly-plan-btn')
            if (weeklyPriceEl) weeklyPriceEl.textContent = `UGX ${config.plans.weekly.price.toLocaleString()}`
            if (weeklyBtn) weeklyBtn.setAttribute('data-amount', config.plans.weekly.price)
        }
        
        // Update monthly plan
        if (config.plans.monthly) {
            const monthlyPriceEl = document.getElementById('monthly-plan-price')
            const monthlyBtn = document.getElementById('monthly-plan-btn')
            if (monthlyPriceEl) monthlyPriceEl.textContent = `UGX ${config.plans.monthly.price.toLocaleString()}`
            if (monthlyBtn) monthlyBtn.setAttribute('data-amount', config.plans.monthly.price)
        }
        
        // Update yearly plan
        if (config.plans.yearly) {
            const yearlyPriceEl = document.getElementById('yearly-plan-price')
            const yearlyBtn = document.getElementById('yearly-plan-btn')
            if (yearlyPriceEl) yearlyPriceEl.textContent = `UGX ${config.plans.yearly.price.toLocaleString()}`
            if (yearlyBtn) yearlyBtn.setAttribute('data-amount', config.plans.yearly.price)
        }
    }

    // Initial update when config is available
    if (window.studioConfig && window.studioConfig.plans) {
        updateHomepagePlanCards(window.studioConfig)
    }

    function renderSelectedPlan(planType, { openModal } = { openModal: false }) {
        // Always use latest config if available, otherwise fall back to local plans
        let plan
        if (window.studioConfig && window.studioConfig.plans && window.studioConfig.plans[planType]) {
            const configPlan = window.studioConfig.plans[planType]
            plan = {
                name: plans[planType]?.name || plans.monthly.name,
                price: `UGX ${configPlan.price.toLocaleString()}`,
                period: plans[planType]?.period || plans.monthly.period,
                description: configPlan.description || plans[planType]?.description || plans.monthly.description
            }
        } else {
            plan = plans[planType] || plans.monthly
        }

        if (selectedPlanName) selectedPlanName.textContent = `${plan.name} Plan`
        if (selectedPlanPrice) selectedPlanPrice.textContent = `${plan.price} / ${plan.period}`
        if (selectedPlanDescription) selectedPlanDescription.textContent = plan.description
        if (billingCycle) billingCycle.value = planType

        const method = getSelectedPaymentMethod()
        if (method) {
            const amountText = (selectedPlanPrice?.textContent || '').split('/')[0].trim() || 'the amount'
            updatePaymentInstructions(method, amountText)
        }

        if (openModal) {
            prefillContactFields()
            membershipModal.classList.add('active')
            document.body.style.overflow = 'hidden'
        }
    }

    function openMembershipModal(planType) {
        // Check if user is authenticated
        if (window.userAuth && !window.userAuth.isLoggedIn()) {
            console.log('User not authenticated, redirecting to login');
            
            // Store the current URL for redirect after login
            const currentUrl = window.location.href;
            window.userAuth.setRedirectUrl(currentUrl);
            
            // Show clear message about why redirect is happening
            showAuthRedirectMessage();
            
            // Redirect to auth page after showing message
            setTimeout(() => {
                window.location.href = 'auth.html';
            }, 2500);
            
            return;
        }
        
        renderSelectedPlan(planType, { openModal: true })
    }

    function showAuthRedirectMessage() {
        // Create a more prominent toast notification
        const toast = document.createElement('div');
        toast.className = 'auth-redirect-toast';
        toast.innerHTML = `
            <div class="auth-redirect-content">
                <div class="auth-redirect-icon">
                    <i class="fas fa-lock"></i>
                </div>
                <div class="auth-redirect-text">
                    <h4>Authentication Required</h4>
                    <p>Please sign in to select a membership plan</p>
                    <p class="auth-redirect-subtitle">You'll be redirected to the login page...</p>
                </div>
                <div class="auth-redirect-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
            </div>
        `;
        
        // Add styles for the toast
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1rem;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            animation: slideInRight 0.5s ease, pulse 2s infinite;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        `;
        
        // Add internal styles
        const style = document.createElement('style');
        style.textContent = `
            .auth-redirect-content {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            .auth-redirect-icon {
                font-size: 1.5rem;
                opacity: 0.9;
            }
            .auth-redirect-text h4 {
                margin: 0 0 0.25rem 0;
                font-size: 1.1rem;
                font-weight: 600;
            }
            .auth-redirect-text p {
                margin: 0.25rem 0;
                font-size: 0.9rem;
                opacity: 0.9;
            }
            .auth-redirect-subtitle {
                font-size: 0.8rem !important;
                opacity: 0.7 !important;
                font-style: italic;
            }
            .auth-redirect-spinner {
                font-size: 1.2rem;
                opacity: 0.8;
            }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.02); }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(toast);
        
        // Remove toast after redirect time
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
            if (style.parentNode) {
                style.remove();
            }
        }, 2500);
    }

    window.openMembershipModal = openMembershipModal

    if (billingCycle) {
        billingCycle.addEventListener('change', function () {
            renderSelectedPlan(this.value || 'monthly')
        })
    }

    function closeMembershipModal() {
        membershipModal.classList.remove('active')
        document.body.style.overflow = ''

        membershipModal.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'))
        if (paymentInstructions) paymentInstructions.style.display = 'none'
        if (transactionInput) transactionInput.style.display = 'none'
        if (transactionId) transactionId.value = ''
    }

    function updatePaymentInstructions(method, amountText) {
        if (!paymentInstructions || !instructionsTitle || !instructionsText) return

        paymentInstructions.style.display = 'block'

        const textByMethod = {
            mtn: {
                title: 'MTN Mobile Money',
                text: `Send ${amountText} to the studio MTN number. Enter the transaction ID below after payment.`
            },
            airtel: {
                title: 'Airtel Money',
                text: `Send ${amountText} to the studio Airtel number. Enter the reference ID below after payment.`
            },
            card: {
                title: 'Card Payment',
                text: `Card payments are not yet automated. Please contact the studio to complete payment for ${amountText}.`
            },
            bank: {
                title: 'Bank Transfer',
                text: `Transfer ${amountText} to the studio bank account. Enter the transfer reference below.`
            }
        }

        const content = textByMethod[method] || { title: 'Payment', text: '' }
        instructionsTitle.textContent = content.title
        instructionsText.textContent = content.text

        const needsReference = method === 'mtn' || method === 'airtel' || method === 'bank'
        if (transactionInput) transactionInput.style.display = needsReference ? 'block' : 'none'
        if (transactionId) transactionId.required = needsReference
    }

    function getSelectedPaymentMethod() {
        const selected = membershipModal.querySelector('.payment-option.selected')
        return selected ? selected.getAttribute('data-method') : null
    }

    function processSubscription() {
        const fullName = document.getElementById('fullName')?.value?.trim()
        const email = document.getElementById('email')?.value?.trim()
        const phone = document.getElementById('phone')?.value?.trim()
        const cycle = billingCycle?.value || 'monthly'
        const method = getSelectedPaymentMethod()
        const ref = transactionId?.value?.trim()

        if (!fullName || !email || !phone) {
            if (window.notifications) {
                window.notifications.show('Please fill in all required fields.', 'error')
            } else {
                console.error('Please fill in all required fields.')
            }
            return
        }

        if (!method) {
            if (window.notifications) {
                window.notifications.show('Please select a payment method.', 'error')
            } else {
                console.error('Please select a payment method.')
            }
            return
        }

        const needsReference = method === 'mtn' || method === 'airtel' || method === 'bank'
        if (needsReference && !ref) {
            if (window.notifications) {
                window.notifications.show('Please enter your Transaction ID / Reference.', 'error')
            } else {
                console.error('Please enter your Transaction ID / Reference.')
            }
            return
        }

        const record = {
            id: `membership_${Date.now()}`,
            fullName,
            email,
            phone,
            billingCycle: cycle,
            paymentMethod: method,
            transactionId: ref || null,
            timestamp: new Date().toISOString(),
            status: 'pending'
        }

        const existing = JSON.parse(localStorage.getItem('membershipSubscriptions') || '[]')
        existing.push(record)
        localStorage.setItem('membershipSubscriptions', JSON.stringify(existing))

        if (window.notifications) {
            window.notifications.show('Subscription submitted! We will confirm your payment shortly.', 'success')
        } else {
            console.log('Subscription submitted! We will confirm your payment shortly.')
        }
        membershipForm.reset()
        closeMembershipModal()
    }

    planSelectButtons.forEach(button => {
        button.addEventListener('click', function () {
            const planType = this.getAttribute('data-plan')
            openMembershipModal(planType)
        })
    })

    membershipModal.addEventListener('click', function (e) {
        const option = e.target.closest('.payment-option')
        if (option) {
            membershipModal.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'))
            option.classList.add('selected')

            const amountText = (selectedPlanPrice?.textContent || '').split('/')[0].trim() || 'the amount'
            updatePaymentInstructions(option.getAttribute('data-method'), amountText)
            return
        }

        if (e.target.classList.contains('modal-close') || e.target.classList.contains('membership-modal')) {
            closeMembershipModal()
        }
    })

    membershipForm.addEventListener('submit', function (e) {
        e.preventDefault()
        processSubscription()
    })

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && membershipModal.classList.contains('active')) {
            closeMembershipModal()
        }
    })
}

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

// Initialize music filters when DOM is ready (but not on music page)
document.addEventListener('DOMContentLoaded', () => {
    // Don't initialize on music page - music-page.js handles it
    if (!window.location.pathname.includes('music.html')) {
        // Initialize music filters
        new MusicFilters();
        
        // Initialize music search
        new MusicSearch();
    }
});

// === MUSIC SEARCH FUNCTIONALITY ===
class MusicSearch {
    constructor() {
        this.searchInput = document.getElementById('musicSearch');
        this.searchClear = document.getElementById('searchClear');
        this.searchFilterToggle = document.getElementById('searchFilterToggle');
        this.searchFilters = document.getElementById('searchFilters');
        this.resultsCount = document.getElementById('resultsCount');
        this.trackCards = document.querySelectorAll('.track-card');
        this.musicGrid = document.getElementById('musicGrid');
        this.sortBy = document.getElementById('sortBy');
        this.genreFilter = document.getElementById('genreFilter');
        this.durationFilter = document.getElementById('durationFilter');
        
        this.allTracks = Array.from(this.trackCards);
        this.currentSearchTerm = '';
        
        if (this.searchInput) {
            this.init();
        }
    }
    
    init() {
        this.setupEventListeners();
        this.updateResultsCount(this.allTracks.length);
    }
    
    setupEventListeners() {
        // Search input events
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
        
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch(e.target.value);
            }
        });
        
        // Clear search
        this.searchClear.addEventListener('click', () => {
            this.clearSearch();
        });
        
        // Filter toggle
        this.searchFilterToggle.addEventListener('click', () => {
            this.toggleFilters();
        });
        
        // Filter changes
        this.sortBy.addEventListener('change', () => {
            this.applyFilters();
        });
        
        this.genreFilter.addEventListener('change', () => {
            this.applyFilters();
        });
        
        this.durationFilter.addEventListener('change', () => {
            this.applyFilters();
        });
        
        // Close filters when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-filters') && !e.target.closest('.search-filter-toggle')) {
                this.searchFilters.classList.remove('show');
                this.searchFilterToggle.classList.remove('active');
            }
        });
    }
    
    handleSearch(searchTerm) {
        this.currentSearchTerm = searchTerm.toLowerCase().trim();
        
        // Show/hide clear button
        if (this.currentSearchTerm) {
            this.searchClear.classList.add('show');
        } else {
            this.searchClear.classList.remove('show');
        }
        
        this.applyFilters();
    }
    
    applyFilters() {
        let filteredTracks = [...this.allTracks];
        
        // Apply search filter
        if (this.currentSearchTerm) {
            filteredTracks = filteredTracks.filter(card => {
                const title = card.querySelector('.track-title').textContent.toLowerCase();
                const artist = card.querySelector('.track-artist').textContent.toLowerCase();
                const genre = card.querySelector('.track-genre').textContent.toLowerCase();
                
                return title.includes(this.currentSearchTerm) || 
                       artist.includes(this.currentSearchTerm) || 
                       genre.includes(this.currentSearchTerm);
            });
            
            // Highlight search terms
            this.highlightSearchTerms(filteredTracks);
        }
        
        // Apply genre filter
        const genreValue = this.genreFilter.value;
        if (genreValue !== 'all') {
            filteredTracks = filteredTracks.filter(card => {
                const genre = card.querySelector('.track-genre').textContent.toLowerCase();
                return genre.includes(genreValue);
            });
        }
        
        // Apply duration filter
        const durationValue = this.durationFilter.value;
        if (durationValue !== 'all') {
            filteredTracks = filteredTracks.filter(card => {
                const durationText = card.querySelector('.track-duration').textContent;
                const minutes = parseInt(durationText.split(':')[0]);
                
                switch (durationValue) {
                    case 'short': return minutes < 3;
                    case 'medium': return minutes >= 3 && minutes <= 5;
                    case 'long': return minutes > 5;
                    default: return true;
                }
            });
        }
        
        // Apply sorting
        this.sortTracks(filteredTracks);
        
        // Update display
        this.displayFilteredTracks(filteredTracks);
        this.updateResultsCount(filteredTracks.length);
    }
    
    sortTracks(tracks) {
        const sortValue = this.sortBy.value;
        
        tracks.sort((a, b) => {
            switch (sortValue) {
                case 'newest':
                    return this.getReleaseDate(b) - this.getReleaseDate(a);
                case 'oldest':
                    return this.getReleaseDate(a) - this.getReleaseDate(b);
                case 'popular':
                    return this.getPopularity(b) - this.getPopularity(a);
                case 'duration':
                    return this.getDuration(b) - this.getDuration(a);
                default: // relevance
                    return 0;
            }
        });
    }
    
    getReleaseDate(card) {
        const dateText = card.querySelector('.release-date').textContent;
        const match = dateText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})/);
        if (match) {
            const month = match[1];
            const year = match[2];
            return new Date(`${month} 1, ${year}`).getTime();
        }
        return 0;
    }
    
    getPopularity(card) {
        const stats = card.querySelector('.track-stats');
        if (stats) {
            const playText = stats.querySelector('.stat:nth-child(1) span').textContent;
            return parseInt(playText.replace('K', '000').replace('.', ''));
        }
        return 0;
    }
    
    getDuration(card) {
        const durationText = card.querySelector('.track-duration').textContent;
        const [minutes, seconds] = durationText.split(':').map(Number);
        return minutes * 60 + seconds;
    }
    
    displayFilteredTracks(tracks) {
        // Remove existing no results message
        const existingMessage = this.musicGrid.querySelector('.no-search-results');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // Hide all tracks first
        this.allTracks.forEach(card => {
            card.style.display = 'none';
            card.classList.remove('filter-visible');
            card.classList.add('filter-hidden');
        });
        
        // Show filtered tracks with animation
        if (tracks.length === 0) {
            this.showNoResultsMessage();
        } else {
            tracks.forEach((card, index) => {
                card.style.display = 'block';
                card.classList.remove('filter-hidden');
                card.classList.add('filter-visible');
            });
        }
    }
    
    highlightSearchTerms(tracks) {
        // Remove existing highlights
        this.allTracks.forEach(card => {
            const title = card.querySelector('.track-title');
            const artist = card.querySelector('.track-artist');
            const genre = card.querySelector('.track-genre');
            
            this.removeHighlights(title);
            this.removeHighlights(artist);
            this.removeHighlights(genre);
        });
        
        // Apply highlights to filtered tracks
        if (this.currentSearchTerm) {
            tracks.forEach(card => {
                const title = card.querySelector('.track-title');
                const artist = card.querySelector('.track-artist');
                const genre = card.querySelector('.track-genre');
                
                this.applyHighlight(title, this.currentSearchTerm);
                this.applyHighlight(artist, this.currentSearchTerm);
                this.applyHighlight(genre, this.currentSearchTerm);
            });
        }
    }
    
    applyHighlight(element, searchTerm) {
        const text = element.textContent;
        const regex = new RegExp(`(${this.escapeRegex(searchTerm)})`, 'gi');
        const highlighted = text.replace(regex, '<span class="search-highlight">$1</span>');
        element.innerHTML = highlighted;
    }
    
    removeHighlights(element) {
        element.innerHTML = element.textContent;
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    showNoResultsMessage() {
        const message = document.createElement('div');
        message.className = 'no-search-results';
        message.innerHTML = `
            <div class="no-search-results-content">
                <i class="fas fa-search"></i>
                <h4>No tracks found</h4>
                <p>Try adjusting your search or filters</p>
            </div>
        `;
        this.musicGrid.appendChild(message);
    }
    
    updateResultsCount(count) {
        this.resultsCount.textContent = `${count} track${count !== 1 ? 's' : ''}`;
    }
    
    clearSearch() {
        this.searchInput.value = '';
        this.currentSearchTerm = '';
        this.searchClear.classList.remove('show');
        this.removeHighlightsFromAll();
        this.applyFilters();
    }
    
    removeHighlightsFromAll() {
        this.allTracks.forEach(card => {
            const title = card.querySelector('.track-title');
            const artist = card.querySelector('.track-artist');
            const genre = card.querySelector('.track-genre');
            
            this.removeHighlights(title);
            this.removeHighlights(artist);
            this.removeHighlights(genre);
        });
    }
    
    toggleFilters() {
        this.searchFilters.classList.toggle('show');
        this.searchFilterToggle.classList.toggle('active');
    }
}

function initFooterCtaRotator() {
    const root = document.querySelector('[data-footer-cta-rotator]')
    if (!root) return

    const copy = root.querySelector('.footer-cta-copy')
    const title = root.querySelector('.footer-cta-title')
    const text = root.querySelector('.footer-cta-text')

    if (!copy || !title || !text) return

    const items = [
        {
            titleHtml: 'Don’t Miss A<br><span>Beat!</span>',
            text: 'Don’t miss out on the latest music news, exclusive offers and promotions, and new releases by signing up for our newsletter. Stay in the loop with the freshest music and be the first to know about upcoming events, artist spotlights, and more. Sign up now and never miss a beat!'
        },
        {
            titleHtml: 'New Drops<br><span>Weekly</span>',
            text: 'Get fresh releases, behind-the-scenes studio moments, and exclusive early previews—delivered straight to your inbox.'
        },
        {
            titleHtml: 'Studio Deals<br><span>Inside</span>',
            text: 'Be the first to hear about limited-time recording packages, mixing discounts, and special offers for artists.'
        },
        {
            titleHtml: 'Events &<br><span>Sessions</span>',
            text: 'Stay updated on upcoming events, artist spotlights, and sessions happening at Chase x Records.'
        }
    ]

    let index = 0
    let timer = null

    function setItem(i) {
        const item = items[i]
        title.innerHTML = item.titleHtml
        text.textContent = item.text
    }

    function swapNext() {
        copy.classList.add('is-swapping')

        window.setTimeout(() => {
            index = (index + 1) % items.length
            setItem(index)
            copy.style.transform = 'translateY(18px)'
            copy.classList.remove('is-swapping')

            window.requestAnimationFrame(() => {
                window.setTimeout(() => {
                    copy.style.transform = ''
                }, 16)
            })
        }, 300)
    }

    setItem(index)

    timer = window.setInterval(swapNext, 7000)

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (timer) window.clearInterval(timer)
            timer = null
            return
        }

        if (!timer) timer = window.setInterval(swapNext, 7000)
    })
}

function initServicesHero() {
    const hero = document.querySelector('[data-services-hero]')
    if (!hero) return

    const imageWrapper = hero.querySelector('.services-hero-image-wrapper')
    const floats = hero.querySelectorAll('.services-hero-float')
    const image = hero.querySelector('.services-hero-image')

    if (!imageWrapper) return

    let mouseX = 0
    let mouseY = 0
    let currentX = 0
    let currentY = 0

    // Track mouse movement
    document.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        mouseX = (e.clientX - centerX) / rect.width
        mouseY = (e.clientY - centerY) / rect.height
    })

    // Smooth parallax animation
    function animate() {
        // Smooth interpolation
        currentX += (mouseX - currentX) * 0.05
        currentY += (mouseY - currentY) * 0.05

        // Apply parallax to image
        if (image) {
            const imageX = currentX * 20
            const imageY = currentY * 20
            image.style.transform = `translate(${imageX}px, ${imageY}px) rotateX(${currentY * 5}deg) rotateY(${currentX * -5}deg)`
        }

        // Apply parallax to floating elements with different speeds
        floats.forEach((float, index) => {
            const speed = 1 + (index * 0.5)
            const floatX = currentX * 30 * speed
            const floatY = currentY * 30 * speed
            float.style.transform = `translate(${floatX}px, ${floatY}px)`
        })

        requestAnimationFrame(animate)
    }

    animate()

    // Add hover tilt effect to image wrapper
    if (imageWrapper) {
        imageWrapper.addEventListener('mouseenter', () => {
            imageWrapper.style.transition = 'transform 0.3s ease'
        })

        imageWrapper.addEventListener('mouseleave', () => {
            imageWrapper.style.transition = 'transform 0.5s ease'
            if (image) {
                image.style.transform = 'translate(0, 0) rotateX(0) rotateY(0)'
            }
            floats.forEach(float => {
                float.style.transform = 'translate(0, 0)'
            })
            mouseX = 0
            mouseY = 0
            currentX = 0
            currentY = 0
        })
    }

    // Pause animations when tab is not visible
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Reset transforms when hidden
            if (image) {
                image.style.transform = 'translate(0, 0) rotateX(0) rotateY(0)'
            }
            floats.forEach(float => {
                float.style.transform = 'translate(0, 0)'
            })
        }
    })
}

function initHomeHero() {
    const hero = document.querySelector('[data-home-hero]')
    if (!hero) return

    const floats = hero.querySelectorAll('.home-hero-float')
    const embedCards = hero.querySelectorAll('.home-hero-embed-card')

    let mouseX = 0
    let mouseY = 0
    let currentX = 0
    let currentY = 0

    // Track mouse movement
    document.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        mouseX = (e.clientX - centerX) / rect.width
        mouseY = (e.clientY - centerY) / rect.height
    })

    // Smooth parallax animation
    function animate() {
        // Smooth interpolation
        currentX += (mouseX - currentX) * 0.05
        currentY += (mouseY - currentY) * 0.05

        // Apply parallax to floating elements with different speeds
        floats.forEach((float, index) => {
            const speed = 1 + (index * 0.5)
            const floatX = currentX * 30 * speed
            const floatY = currentY * 30 * speed
            float.style.transform = `translate(${floatX}px, ${floatY}px)`
        })

        // Apply subtle parallax to embed cards
        embedCards.forEach((card, index) => {
            const speed = 0.5 + (index * 0.25)
            const cardX = currentX * 10 * speed
            const cardY = currentY * 10 * speed
            card.style.transform = `translate(${cardX}px, ${cardY}px)`
        })

        requestAnimationFrame(animate)
    }

    animate()

    // Pause animations when tab is not visible
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            floats.forEach(float => {
                float.style.transform = 'translate(0, 0)'
            })
            embedCards.forEach(card => {
                card.style.transform = 'translate(0, 0)'
            })
        }
    })
}

function initContactHero() {
    const hero = document.querySelector('[data-contact-hero]')
    if (!hero) return

    const iconCircles = hero.querySelectorAll('.contact-hero-icon-circle')

    let mouseX = 0
    let mouseY = 0
    let currentX = 0
    let currentY = 0

    // Track mouse movement
    document.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        mouseX = (e.clientX - centerX) / rect.width
        mouseY = (e.clientY - centerY) / rect.height
    })

    // Smooth parallax animation
    function animate() {
        // Smooth interpolation
        currentX += (mouseX - currentX) * 0.05
        currentY += (mouseY - currentY) * 0.05

        // Apply parallax to icon circles with different speeds
        iconCircles.forEach((circle, index) => {
            const speed = 1 + (index * 0.5)
            const circleX = currentX * 30 * speed
            const circleY = currentY * 30 * speed
            circle.style.transform = `translate(${circleX}px, ${circleY}px)`
        })

        requestAnimationFrame(animate)
    }

    animate()

    // Pause animations when tab is not visible
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            iconCircles.forEach(circle => {
                circle.style.transform = 'translate(0, 0)'
            })
        }
    })
}

function initMusicHero() {
    const hero = document.querySelector('[data-music-hero]')
    if (!hero) return

    const floats = hero.querySelectorAll('.music-hero-float')
    const embedCard = hero.querySelector('.music-hero-embed-card')

    let mouseX = 0
    let mouseY = 0
    let currentX = 0
    let currentY = 0

    // Track mouse movement
    document.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        mouseX = (e.clientX - centerX) / rect.width
        mouseY = (e.clientY - centerY) / rect.height
    })

    // Smooth parallax animation
    function animate() {
        // Smooth interpolation
        currentX += (mouseX - currentX) * 0.05
        currentY += (mouseY - currentY) * 0.05

        // Apply parallax to floating elements with different speeds
        floats.forEach((float, index) => {
            const speed = 1 + (index * 0.5)
            const floatX = currentX * 30 * speed
            const floatY = currentY * 30 * speed
            float.style.transform = `translate(${floatX}px, ${floatY}px)`
        })

        // Apply subtle parallax to embed card
        if (embedCard) {
            const cardX = currentX * 10
            const cardY = currentY * 10
            embedCard.style.transform = `translate(${cardX}px, ${cardY}px)`
        }

        requestAnimationFrame(animate)
    }

    animate()

    // Pause animations when tab is not visible
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            floats.forEach(float => {
                float.style.transform = 'translate(0, 0)'
            })
            if (embedCard) {
                embedCard.style.transform = 'translate(0, 0)'
            }
        }
    })
}

// Force video autoplay for GitHub Pages
function initVideoAutoplay() {
    const videos = document.querySelectorAll('video[autoplay]')
    
    videos.forEach(video => {
        // Check if video has sequence data
        const sequenceData = video.getAttribute('data-video-sequence')
        
        if (sequenceData) {
            // Handle sequential video playback
            initVideoSequence(video)
        } else {
            // Handle single video playback
            initSingleVideo(video)
        }
    })
}

function initSingleVideo(video) {
    const playPromise = video.play()
    
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.log('Video autoplay prevented, attempting to enable:', error)
            video.muted = true
            video.setAttribute('playsinline', '')
            
            setTimeout(() => {
                video.play().catch(e => console.log('Video still not playing:', e))
            }, 1000)
        })
    }
    
    // Ensure video loops
    video.addEventListener('ended', () => {
        video.play().catch(e => console.log('Video replay failed:', e))
    })
}

function initVideoSequence(video) {
    const sequence = JSON.parse(video.getAttribute('data-video-sequence'))
    let currentIndex = parseInt(video.getAttribute('data-current-segment')) || 0
    let hasEndedListenerTriggered = false
    
    console.log('Video sequence initialized:', sequence)
    
    function playSegment(index) {
        hasEndedListenerTriggered = false
        
        if (index >= sequence.length) {
            // Loop back to first segment
            index = 0
        }
        
        currentIndex = index
        video.setAttribute('data-current-segment', currentIndex)
        console.log('Playing segment:', currentIndex, sequence[currentIndex])
        
        video.src = sequence[currentIndex]
        video.load()
        
        video.play().catch(error => {
            console.log('Video segment autoplay prevented:', error)
            video.muted = true
            video.setAttribute('playsinline', '')
            video.play().catch(e => console.log('Video segment still not playing:', e))
        })
    }
    
    // Play first segment
    playSegment(currentIndex)
    
    // When segment ends, play next one
    video.addEventListener('ended', () => {
        if (!hasEndedListenerTriggered) {
            hasEndedListenerTriggered = true
            console.log('Video segment ended (ended event), playing next:', currentIndex + 1)
            playSegment(currentIndex + 1)
        }
    })
    
    // Fallback: use timeupdate to detect when video is near end
    video.addEventListener('timeupdate', () => {
        if (video.duration > 0 && !hasEndedListenerTriggered) {
            const timeRemaining = video.duration - video.currentTime
            // Trigger when 0.3 seconds remaining
            if (timeRemaining <= 0.3) {
                hasEndedListenerTriggered = true
                console.log('Video near end (timeupdate), playing next:', currentIndex + 1)
                playSegment(currentIndex + 1)
            }
        }
    })
    
    // Also use loadedmetadata to ensure video is ready
    video.addEventListener('loadedmetadata', () => {
        console.log('Video metadata loaded, duration:', video.duration)
    })
    
    // Handle errors
    video.addEventListener('error', (e) => {
        console.log('Video segment error:', e, video.error)
        hasEndedListenerTriggered = false
        // Try next segment on error
        playSegment(currentIndex + 1)
    })
}

// Global Clipboard Support - Works across all devices and browsers
function initClipboardSupport() {
    // Add clipboard support to all text inputs and textareas
    const textInputs = document.querySelectorAll('input[type="text"], input[type="url"], input[type="email"], input[type="tel"], input[type="search"], textarea');

    textInputs.forEach(input => {
        // Ensure paste works with clipboard API
        input.addEventListener('paste', (e) => {
            // Let the default behavior happen
            // This ensures compatibility across all browsers
            setTimeout(() => {
                // Trigger any custom handling if needed
                const eventType = new Event('input', { bubbles: true });
                input.dispatchEvent(eventType);
            }, 0);
        });

        // Add support for Ctrl+V / Cmd+V explicitly
        input.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                // The paste will be handled by the browser
                // This event is just for any additional logic if needed
            }
        });

        // Handle context menu paste for mobile devices
        input.addEventListener('focus', () => {
            // Ensure input is ready for paste on mobile
            input.setAttribute('autocomplete', 'off');
        });
    });

    // Add global clipboard error handling
    window.addEventListener('error', (e) => {
        if (e.message && e.message.includes('clipboard')) {
            console.warn('Clipboard access error:', e);
        }
    });

    // Add support for copy to clipboard functionality
    window.copyToClipboard = async function(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    return true;
                } catch (err) {
                    document.body.removeChild(textArea);
                    console.error('Fallback copy failed:', err);
                    return false;
                }
            }
        } catch (err) {
            console.error('Clipboard copy failed:', err);
            return false;
        }
    };

    // Add support for paste from clipboard functionality
    window.pasteFromClipboard = async function() {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const text = await navigator.clipboard.readText();
                return text;
            } else {
                // Fallback - prompt user to paste
                console.warn('Clipboard read not supported, user must paste manually');
                return null;
            }
        } catch (err) {
            console.error('Clipboard paste failed:', err);
            return null;
        }
    };

    console.log('Clipboard support initialized for', textInputs.length, 'inputs');
}