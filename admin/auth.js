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
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault()
                this.handleLogout()
            })
        }
    }

    bindAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            this.currentUser = user || null
            this.isAuthenticated = Boolean(user)

            if (!user) {
                this.isAdmin = false
                this.adminProfile = null
                this.applyRedirects()
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

            this.applyRedirects()
            this.updateAdminHeaderUI()
        })
    }

    async fetchAdminProfile(uid) {
        try {
            const ref = doc(db, 'admins', uid)
            const snap = await getDoc(ref)
            if (!snap.exists()) return null
            return { id: snap.id, ...snap.data() }
        } catch (e) {
            console.error('Failed to fetch admin profile:', e)
            return null
        }
    }

    async createAdminRecord(user) {
        try {
            const adminData = {
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                role: 'super_admin',
                createdAt: new Date().toISOString(),
                createdBy: user.uid
            }
            await setDoc(doc(db, 'admins', user.uid), adminData)
            console.log('Admin record created successfully:', adminData)
            return { id: user.uid, ...adminData }
        } catch (e) {
            console.error('Failed to create admin record:', e)
            return null
        }
    }

    async fetchAdminInvite(email) {
        try {
            const ref = doc(db, 'adminInvites', email)
            const snap = await getDoc(ref)
            if (!snap.exists()) return null
            return { id: snap.id, ...snap.data() }
        } catch (e) {
            console.error('Failed to fetch admin invite:', e)
            return null
        }
    }

    async createAdminRecordFromInvite(user, invite) {
        try {
            const adminData = {
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                role: invite.role || 'admin',
                createdAt: new Date().toISOString(),
                createdBy: invite.createdBy,
                invitedBy: invite.createdBy
            }
            await setDoc(doc(db, 'admins', user.uid), adminData)
            
            // Remove the invite after creating admin record
            await deleteDoc(doc(db, 'adminInvites', user.email))
            
            console.log('Admin record created from invite successfully:', adminData)
            return { id: user.uid, ...adminData }
        } catch (e) {
            console.error('Failed to create admin record from invite:', e)
            return null
        }
    }

    applyRedirects() {
        const path = window.location.pathname
        const onLogin = path.includes('/admin/') && (path.endsWith('/admin/') || path.includes('admin/index.html'))
        const onDashboard = path.includes('admin/dashboard.html')

        if (onLogin) {
            if (this.isAuthenticated && this.isAdmin) {
                window.location.href = 'dashboard.html'
            }
            return
        }

        if (onDashboard) {
            if (!this.isAuthenticated) {
                window.location.href = 'index.html'
                return
            }
            if (!this.isAdmin) {
                this.showNotification('Access denied: your account is not an admin.', 'error')
                setTimeout(() => {
                    window.location.href = 'index.html'
                }, 700)
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

        this.showLoading(true)
        try {
            await signInWithEmailAndPassword(auth, email, password)
        } catch (error) {
            console.error('Admin email login error:', error)
            this.showNotification(this.getAuthErrorMessage(error?.code) || 'Login failed', 'error')
            passwordGroup?.classList.remove('success')
            passwordGroup?.classList.add('error')
        } finally {
            this.showLoading(false)
        }
    }

    async handleGoogleLogin() {
        this.showLoading(true)
        try {
            const provider = new GoogleAuthProvider()
            await signInWithPopup(auth, provider)
        } catch (error) {
            console.error('Admin Google login error:', error)
            this.showNotification(this.getAuthErrorMessage(error?.code) || 'Google sign-in failed', 'error')
        } finally {
            this.showLoading(false)
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