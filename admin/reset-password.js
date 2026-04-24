import { auth } from '../scripts/firebase-init.js'
import {
    sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'

class ResetPassword {
    constructor() {
        this.init()
    }

    init() {
        this.setupEventListeners()
        this.prefillEmail()
    }

    setupEventListeners() {
        const resetForm = document.getElementById('resetPasswordForm')
        if (resetForm) {
            resetForm.addEventListener('submit', (e) => this.handlePasswordReset(e))
        }
    }

    prefillEmail() {
        // Get email from URL parameter if provided
        const urlParams = new URLSearchParams(window.location.search)
        const emailParam = urlParams.get('email')
        if (emailParam) {
            const emailInput = document.getElementById('resetEmail')
            if (emailInput) {
                emailInput.value = emailParam
            }
        }
    }

    async handlePasswordReset(e) {
        e.preventDefault()
        const email = (document.getElementById('resetEmail')?.value || '').trim()
        const emailGroup = document.getElementById('resetEmail')?.closest('.input-group')

        // Clear previous validation states
        emailGroup?.classList.remove('error', 'success')

        if (!email) {
            this.showNotification('Please enter your email address', 'error')
            emailGroup?.classList.add('error')
            return
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            this.showNotification('Please enter a valid email address.', 'error')
            emailGroup?.classList.add('error')
            return
        }

        emailGroup?.classList.add('success')

        this.showLoading(true, 'Sending reset link...')
        try {
            await sendPasswordResetEmail(auth, email)
            this.showNotification('Password reset email sent! Check your inbox.', 'success')
            
            // Redirect to login after 3 seconds
            setTimeout(() => {
                window.location.href = 'index.html'
            }, 3000)
        } catch (error) {
            console.error('Password reset error:', error)
            const msg = this.getAuthErrorMessage(error?.code) || 'Failed to send reset email'
            this.showNotification(msg, 'error')
            emailGroup?.classList.remove('success')
            emailGroup?.classList.add('error')
        } finally {
            this.showLoading(false)
        }
    }

    showLoading(isLoading, text = 'Sending reset link...') {
        const overlay = document.getElementById('loadingOverlay')
        const loadingText = document.getElementById('loadingText')
        const submitBtn = document.querySelector('.btn-login')
        
        if (overlay) {
            overlay.classList.toggle('active', isLoading)
        }
        if (loadingText) {
            loadingText.textContent = text
        }
        if (submitBtn) {
            submitBtn.disabled = Boolean(isLoading)
            submitBtn.innerHTML = isLoading
                ? '<i class="fas fa-spinner fa-spin"></i> Sending...'
                : '<i class="fas fa-paper-plane"></i> Send Reset Link'
        }
    }

    showNotification(message, type = 'info') {
        // Validate message - don't show empty notifications
        if (!message || (typeof message === 'string' && message.trim() === '')) {
            console.warn('Notification not shown: empty message')
            return
        }

        const notification = document.getElementById('notification')
        if (notification) {
            notification.textContent = message
            notification.className = `notification ${type} show`
            setTimeout(() => notification.classList.remove('show'), 3000)
            return
        }

        if (window.notifications) {
            window.notifications.show(message, type)
        } else {
            console.log(`[${type}] ${message}`)
        }
    }

    getAuthErrorMessage(code) {
        const map = {
            'auth/invalid-email': 'Invalid email address',
            'auth/user-not-found': 'No account found with this email',
            'auth/too-many-requests': 'Too many attempts. Please try again later',
            'auth/operation-not-allowed': 'This operation is not enabled',
        }
        return map[code] || null
    }
}

const resetPassword = new ResetPassword()
