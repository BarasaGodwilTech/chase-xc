import { auth } from '../scripts/firebase-init.js'
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
import { db } from '../scripts/firebase-init.js'
import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'

class AdminAuth {
    constructor() {
        this._bound = false
        this.isAuthenticated = false
        this.isAdmin = false
        this.currentUser = null
        this.adminProfile = null
        this.init()
    }

    init() {
        this.setupEventListeners()
        this.bindAuthListener()
    }

    setupEventListeners() {
        if (this._bound) return
        this._bound = true

        const loginForm = document.getElementById('loginForm')
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleEmailLogin(e))
        }

        const googleBtn = document.getElementById('googleSignInBtn')
        if (googleBtn) {
            googleBtn.addEventListener('click', () => this.handleGoogleLogin())
        }

        const passwordToggle = document.getElementById('passwordToggle')
        if (passwordToggle) {
            passwordToggle.addEventListener('click', () => this.togglePasswordVisibility())
        }

        const logoutBtn = document.getElementById('logoutBtn')
        if (logoutBtn) {
            logoutBtn.addEventListener(
                'click',
                async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.stopImmediatePropagation()

                    let ok = false
                    if (window.notifications && window.notifications.confirm) {
                        ok = await window.notifications.confirm(
                            'Are you sure you want to logout?',
                            'Logout',
                            'warning'
                        )
                    } else {
                        ok = confirm('Are you sure you want to logout?')
                    }

                    if (!ok) return
                    await this.handleLogout()
                },
                true
            )
        }
    }

    bindAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            this.currentUser = user || null
            this.isAuthenticated = Boolean(user)

            const path = window.location.pathname
            const onLogin = path.includes('/admin/') && (path.endsWith('/admin/') || path.includes('admin/index.html'))
            const onDashboard = path.includes('admin/dashboard.html')
            if (onLogin && user) {
                this.showLoading(true, 'Verifying access...')
                if (window.notifications && typeof window.notifications.show === 'function') {
                    window.notifications.show('Verifying admin access…', 'info', null, 1800)
                }
            }

            if (onDashboard) {
                document.body?.classList.add('auth-pending')
                if (user) {
                    this.showLoading(true, 'Verifying access...')
                }
            }

            if (!user) {
                this.isAdmin = false
                this.adminProfile = null

                if (onLogin) {
                    this.showLoading(false)
                }

                if (onDashboard) {
                    this.showLoading(false)
                }

                window.dispatchEvent(new Event('adminAuthState'))
                await this.applyRedirects()
                return
            }

            let adminInfo = await this.fetchAdminProfile(user.uid)
            
            // Auto-create admin record for super admin if it doesn't exist (bootstrap)
            if (!adminInfo && user.email === 'barasagodwil@gmail.com') {
                console.log('Creating admin record for super admin:', user.email)
                adminInfo = await this.createAdminRecord(user)
            }
            
            // Check for pending admin invite and create admin record
            if (!adminInfo) {
                const invite = await this.fetchAdminInvite(user.email)
                if (invite) {
                    console.log('Creating admin record from invite for:', user.email)
                    adminInfo = await this.createAdminRecordFromInvite(user, invite)
                }
            }

            this.isAdmin = Boolean(adminInfo)
            this.adminProfile = adminInfo

            window.dispatchEvent(new Event('adminAuthState'))
            await this.applyRedirects()
            this.updateAdminHeaderUI()

            if (onLogin) {
                this.showLoading(false)
            }

            if (onDashboard && this.isAdmin) {
                document.body?.classList.remove('auth-pending')
                this.showLoading(false)
            }
        })
    }

    withTimeout(promise, ms, label = 'Request') {
        let timeoutId
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
        })
        return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId))
    }

    async fetchAdminProfile(uid) {
        try {
            const ref = doc(db, 'admins', uid)
            const snap = await this.withTimeout(getDoc(ref), 8000, 'Admin profile lookup')
            if (!snap.exists()) return null
            return { id: snap.id, ...snap.data() }
        } catch (e) {
            console.error('Failed to fetch admin profile:', e)
            if ((e?.message || '').toLowerCase().includes('timed out')) {
                this.showNotification('Verification is taking too long. Please check your connection and try again.', 'error')
                return null
            }
            const code = e?.code || ''
            if (code === 'permission-denied' || code === 'missing-or-insufficient-permissions') {
                this.showNotification('Unable to verify admin access (permissions). Please contact support.', 'error')
            } else {
                this.showNotification('Unable to verify admin access. Please try again.', 'error')
            }
            return null
        }
    }

    async fetchAdminInvite(email) {
        try {
            const ref = doc(db, 'adminInvites', email)
            const snap = await this.withTimeout(getDoc(ref), 8000, 'Admin invite lookup')
            if (!snap.exists()) return null
            return { id: snap.id, ...snap.data() }
        } catch (e) {
            console.error('Failed to fetch admin invite:', e)
            return null
        }
    }

    async applyRedirects() {
        const path = window.location.pathname
        const onLogin = path.includes('/admin/') && (path.endsWith('/admin/') || path.includes('admin/index.html'))
        const onDashboard = path.includes('admin/dashboard.html')

        if (onLogin) {
            if (this.isAuthenticated && this.isAdmin) {
                if (window.notifications && typeof window.notifications.show === 'function') {
                    window.notifications.show('Login successful. Redirecting…', 'success', 'Welcome', 1800)
                }
                this.showLoading(true, 'Redirecting to dashboard...')
                await new Promise((r) => setTimeout(r, 200))
                window.location.href = 'dashboard.html'
                return
            }

            if (this.isAuthenticated && !this.isAdmin) {
                const message = 'Access denied. Your account is not invited as an admin.'
                if (window.notifications && typeof window.notifications.show === 'function') {
                    window.notifications.show(message, 'error', 'Not authorized', 5000)
                }

                // Important: do not block awaiting a modal while the loading overlay is active
                // (can deadlock on some devices).
                this.showLoading(false)

                // Always provide an inline fallback that lasts longer on the login page.
                // This ensures the user is informed even if the modal/toast fails to render.
                const inline = document.getElementById('notification')
                if (inline) {
                    inline.textContent = message
                    inline.className = 'notification error show'
                    setTimeout(() => inline.classList.remove('show'), 8000)
                }

                if (window.notifications && typeof window.notifications.alert === 'function') {
                    window.notifications.alert(message, 'Not authorized', 'warning')
                } else {
                    this.showNotification(message, 'error')
                }

                try {
                    await signOut(auth)
                } catch (e) {
                    console.error('Failed to sign out unauthorized user:', e)
                } finally {
                    this.showLoading(false)
                }
            }
            return
        }

        if (onDashboard) {
            if (!this.isAuthenticated) {
                window.location.href = 'index.html'
                return
            }
            if (!this.isAdmin) {
                const message = 'Access denied. Your account is not invited as an admin.'
                if (window.notifications && typeof window.notifications.show === 'function') {
                    window.notifications.show(message, 'error', 'Not authorized', 5000)
                }

                this.showLoading(false)
                document.body?.classList.remove('auth-pending')

                if (window.notifications && typeof window.notifications.alert === 'function') {
                    window.notifications.alert(message, 'Not authorized', 'warning')
                } else {
                    this.showNotification(message, 'error')
                }

                setTimeout(() => {
                    window.location.href = 'index.html'
                }, 300)
            }
        }
    }

    updateAdminHeaderUI() {
        const nameEl = document.getElementById('userName')
        const roleEl = document.getElementById('userRole')
        if (!nameEl || !roleEl) return

        const email = this.currentUser?.email || ''
        const label = this.adminProfile?.role || 'admin'
        nameEl.textContent = this.adminProfile?.name || email || 'Admin'
        roleEl.textContent = label
    }

    async handleEmailLogin(e) {
        e.preventDefault()

        const email = (document.getElementById('email')?.value || '').trim()
        const password = document.getElementById('password')?.value || ''
        const emailGroup = document.getElementById('email')?.closest('.input-group')
        const passwordGroup = document.getElementById('password')?.closest('.input-group')

        // Clear previous validation states
        emailGroup?.classList.remove('error', 'success')
        passwordGroup?.classList.remove('error', 'success')

        if (!email || !password) {
            this.showNotification('Email and password are required.', 'error')
            if (!email) emailGroup?.classList.add('error')
            if (!password) passwordGroup?.classList.add('error')
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
        passwordGroup?.classList.add('success')

        this.showLoading(true, 'Signing in...')
        if (window.notifications && typeof window.notifications.show === 'function') {
            window.notifications.show('Signing in…', 'info', null, 1200)
        }
        try {
            await signInWithEmailAndPassword(auth, email, password)
        } catch (error) {
            console.error('Admin email login error:', error)
            if (error?.code === 'auth/user-not-found') {
                const invite = await this.fetchAdminInvite(email)
                if (invite) {
                    const message = 'You have an admin invite for this email. Please sign in with Google using the invited email address, or create an account first and then sign in.'
                    if (window.notifications && typeof window.notifications.alert === 'function') {
                        await window.notifications.alert(message, 'Invite found', 'info')
                    } else {
                        this.showNotification(message, 'info')
                    }
                } else {
                    this.showNotification(this.getAuthErrorMessage(error?.code) || 'Login failed', 'error')
                }
            } else {
                this.showNotification(this.getAuthErrorMessage(error?.code) || 'Login failed', 'error')
            }
            passwordGroup?.classList.remove('success')
            passwordGroup?.classList.add('error')
        } finally {
            this.showLoading(false)
        }
    }

    async handleGoogleLogin() {
        this.showLoading(true, 'Opening Google sign-in...')
        if (window.notifications && typeof window.notifications.show === 'function') {
            window.notifications.show('Opening Google sign-in…', 'info', null, 1600)
        }
        try {
            const provider = new GoogleAuthProvider()
            await signInWithPopup(auth, provider)

            this.showLoading(true, 'Verifying access...')
            if (window.notifications && typeof window.notifications.show === 'function') {
                window.notifications.show('Verifying admin access…', 'info', null, 2400)
            }
        } catch (error) {
            console.error('Admin Google login error:', error)
            this.showNotification(this.getAuthErrorMessage(error?.code) || 'Google sign-in failed', 'error')
            this.showLoading(false)
        } finally {
            // Keep the loading overlay visible after successful sign-in.
            // Access verification + redirects are handled in onAuthStateChanged.
        }
    }

    async handleLogout() {
        try {
            await signOut(auth)
        } catch (error) {
            console.error('Admin logout error:', error)
        } finally {
            window.location.href = 'index.html'
        }
    }

    togglePasswordVisibility() {
        const passwordInput = document.getElementById('password')
        const toggleIcon = document.getElementById('passwordToggle')?.querySelector('i')
        if (!passwordInput || !toggleIcon) return

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text'
            toggleIcon.className = 'fas fa-eye-slash'
        } else {
            passwordInput.type = 'password'
            toggleIcon.className = 'fas fa-eye'
        }
    }

    showLoading(isLoading, text = 'Signing in...') {
        const overlay = document.getElementById('loadingOverlay')
        const loadingText = document.getElementById('loadingText')
        const submitBtn = document.querySelector('.btn-login')
        const googleBtn = document.getElementById('googleSignInBtn')
        
        if (overlay) {
            overlay.classList.toggle('active', isLoading)
        }
        if (loadingText) {
            loadingText.textContent = text
        }
        if (submitBtn) {
            submitBtn.disabled = Boolean(isLoading)
            submitBtn.innerHTML = isLoading
                ? '<i class="fas fa-spinner fa-spin"></i> Signing In...'
                : '<i class="fas fa-sign-in-alt"></i> Sign In'
        }
        if (googleBtn) {
            googleBtn.disabled = Boolean(isLoading)
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
            'auth/user-disabled': 'This account has been disabled',
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/too-many-requests': 'Too many attempts. Please try again later',
            'auth/popup-closed-by-user': 'Sign-in was cancelled',
            'auth/popup-blocked': 'Popup was blocked by your browser. Please allow popups and try again.',
            'auth/cancelled-popup-request': 'Another sign-in attempt is in progress. Please try again.',
            'auth/network-request-failed': 'Network error. Check your connection and try again.',
            'auth/operation-not-allowed': 'This sign-in method is not enabled',
            'auth/invalid-credential': 'Invalid email or password',
            'auth/email-already-in-use': 'This email is already in use',
            'auth/weak-password': 'Password should be at least 6 characters'
        }
        return map[code] || null
    }

    hasPermission() {
        return this.isAdmin
    }

    getCurrentUser() {
        if (!this.currentUser) return null
        return {
            uid: this.currentUser.uid,
            email: this.currentUser.email,
            username: this.adminProfile?.name || this.currentUser.email,
            role: this.adminProfile?.role || 'admin'
        }
    }

    isLoggedIn() {
        return this.isAuthenticated && this.isAdmin
    }
}

const adminAuth = new AdminAuth()
window.adminAuth = adminAuth