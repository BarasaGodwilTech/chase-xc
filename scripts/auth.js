import { auth } from './firebase-init.js'
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'

class UserAuth {
    constructor() {
        this.currentUser = null;
        this.redirectUrl = null;
        this.init();
    }

    init() {
        // Listen for auth state changes
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
            
            // Update profile UI based on auth state
            this.updateProfileUI();
            
            // If user is logged in and there's a redirect URL, redirect them
            if (user && this.redirectUrl) {
                const redirectTarget = this.redirectUrl;
                this.redirectUrl = null;
                window.location.href = redirectTarget;
            }
        });

        // Check if there's a redirect URL stored from previous attempt
        const storedRedirect = sessionStorage.getItem('authRedirectUrl');
        if (storedRedirect) {
            this.redirectUrl = storedRedirect;
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Signup form
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleSignup(e));
        }

        // Toggle between login and signup
        const showSignupBtn = document.getElementById('showSignup');
        if (showSignupBtn) {
            showSignupBtn.addEventListener('click', () => this.toggleAuthMode('signup'));
        }

        const showLoginBtn = document.getElementById('showLogin');
        if (showLoginBtn) {
            showLoginBtn.addEventListener('click', () => this.toggleAuthMode('login'));
        }

        // Google sign-in (login form)
        const googleSignInBtn = document.getElementById('googleSignIn');
        if (googleSignInBtn) {
            googleSignInBtn.addEventListener('click', () => this.handleGoogleSignIn());
        }

        // Google sign-up (signup form)
        const googleSignUpBtn = document.getElementById('googleSignUp');
        if (googleSignUpBtn) {
            googleSignUpBtn.addEventListener('click', () => this.handleGoogleSignIn());
        }

        // Password reset
        const forgotPasswordBtn = document.getElementById('forgotPassword');
        if (forgotPasswordBtn) {
            forgotPasswordBtn.addEventListener('click', () => this.handlePasswordReset());
        }

        // Logout
        const logoutBtn = document.getElementById('userLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Password visibility toggle
        const passwordToggles = document.querySelectorAll('.password-toggle');
        passwordToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => this.togglePasswordVisibility(e));
        });

        // Profile dropdown toggle - wait for includes to load
        const setupProfileBtn = () => {
            const profileBtn = document.getElementById('profileBtn');
            if (profileBtn) {
                profileBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleProfileDropdown();
                });
            }
        };

        // Try immediately, then wait for includes:loaded event
        setupProfileBtn();
        document.addEventListener('includes:loaded', setupProfileBtn);

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            this.closeProfileDropdown();
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe')?.checked || false;

        this.showLoading('login');

        try {
            await signInWithEmailAndPassword(auth, email, password);
            
            // Set persistence based on remember me
            if (rememberMe) {
                // User will stay logged in
            }

            this.showNotification('Login successful!', 'success');
            
            // Redirect after short delay
            setTimeout(() => {
                this.handleRedirect();
            }, 1000);
            
        } catch (error) {
            this.showNotification(this.getErrorMessage(error.code), 'error');
        } finally {
            this.hideLoading('login');
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;

        // Validate passwords match
        if (password !== confirmPassword) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }

        // Validate password strength
        if (password.length < 6) {
            this.showNotification('Password must be at least 6 characters', 'error');
            return;
        }

        this.showLoading('signup');

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            // Update user profile with display name
            if (userCredential.user) {
                await userCredential.user.updateProfile({ displayName: name });
            }

            this.showNotification('Account created successfully!', 'success');
            
            // Redirect after short delay
            setTimeout(() => {
                this.handleRedirect();
            }, 1000);
            
        } catch (error) {
            this.showNotification(this.getErrorMessage(error.code), 'error');
        } finally {
            this.hideLoading('signup');
        }
    }

    async handleGoogleSignIn() {
        const provider = new GoogleAuthProvider();
        
        try {
            await signInWithPopup(auth, provider);
            this.showNotification('Google sign-in successful!', 'success');
            
            setTimeout(() => {
                this.handleRedirect();
            }, 1000);
            
        } catch (error) {
            this.showNotification(this.getErrorMessage(error.code), 'error');
        }
    }

    async handlePasswordReset() {
        const email = document.getElementById('loginEmail')?.value || 
                     document.getElementById('signupEmail')?.value;

        if (!email) {
            this.showNotification('Please enter your email address first', 'error');
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            this.showNotification('Password reset email sent! Check your inbox.', 'success');
        } catch (error) {
            this.showNotification(this.getErrorMessage(error.code), 'error');
        }
    }

    async handleLogout() {
        try {
            await signOut(auth);
            this.showNotification('Logged out successfully', 'success');
            
            // Redirect to home
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
            
        } catch (error) {
            this.showNotification('Error logging out', 'error');
        }
    }

    toggleAuthMode(mode) {
        const loginContainer = document.getElementById('loginContainer');
        const signupContainer = document.getElementById('signupContainer');
        const pageTitle = document.getElementById('authPageTitle');

        if (mode === 'signup') {
            loginContainer.style.display = 'none';
            signupContainer.style.display = 'block';
            pageTitle.textContent = 'Create Account';
        } else {
            loginContainer.style.display = 'block';
            signupContainer.style.display = 'none';
            pageTitle.textContent = 'Sign In';
        }
    }

    togglePasswordVisibility(e) {
        const toggle = e.currentTarget;
        const input = toggle.previousElementSibling;
        const icon = toggle.querySelector('i');

        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    // Store redirect URL before sending to login
    setRedirectUrl(url) {
        this.redirectUrl = url;
        sessionStorage.setItem('authRedirectUrl', url);
    }

    // Handle redirect after login
    handleRedirect() {
        // Check if there's a stored redirect URL
        const redirectUrl = sessionStorage.getItem('authRedirectUrl');
        
        if (redirectUrl) {
            sessionStorage.removeItem('authRedirectUrl');
            window.location.href = redirectUrl;
        } else {
            // Default redirect to home
            window.location.href = 'index.html';
        }
    }

    // Check if user is logged in
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Require authentication - redirect to login if not authenticated
    requireAuth(redirectUrl = null) {
        if (!this.isLoggedIn()) {
            const currentUrl = redirectUrl || window.location.href;
            this.setRedirectUrl(currentUrl);
            window.location.href = 'auth.html';
            return false;
        }
        return true;
    }

    showLoading(formType) {
        const btn = formType === 'login' 
            ? document.querySelector('#loginForm .submit-btn')
            : document.querySelector('#signupForm .submit-btn');
        
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            btn.disabled = true;
        }
    }

    hideLoading(formType) {
        const btn = formType === 'login' 
            ? document.querySelector('#loginForm .submit-btn')
            : document.querySelector('#signupForm .submit-btn');
        
        if (btn) {
            btn.innerHTML = formType === 'login' 
                ? '<i class="fas fa-sign-in-alt"></i> Sign In'
                : '<i class="fas fa-user-plus"></i> Create Account';
            btn.disabled = false;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('authNotification');
        if (notification) {
            notification.textContent = message;
            notification.className = `auth-notification ${type} show`;
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        } else {
            alert(message);
        }
    }

    getErrorMessage(errorCode) {
        const errorMessages = {
            'auth/invalid-email': 'Invalid email address',
            'auth/user-disabled': 'This account has been disabled',
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/email-already-in-use': 'An account with this email already exists',
            'auth/weak-password': 'Password is too weak',
            'auth/too-many-requests': 'Too many attempts. Please try again later',
            'auth/popup-closed-by-user': 'Sign-in was cancelled',
            'auth/operation-not-allowed': 'This sign-in method is not enabled'
        };

        return errorMessages[errorCode] || 'An error occurred. Please try again.';
    }

    toggleProfileDropdown() {
        // If user is not logged in, redirect directly to auth.html
        if (!this.currentUser) {
            window.location.href = 'auth.html';
            return;
        }

        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) {
            dropdown.classList.toggle('active');
        }
    }

    closeProfileDropdown() {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) {
            dropdown.classList.remove('active');
        }
    }

    updateProfileUI() {
        const dropdown = document.getElementById('profileDropdown');
        if (!dropdown) return;

        if (this.currentUser) {
            // User is logged in - show profile menu
            const displayName = this.currentUser.displayName || 'User';
            const email = this.currentUser.email;

            dropdown.innerHTML = `
                <div class="profile-user-info">
                    <div class="profile-user-name">${displayName}</div>
                    <div class="profile-user-email">${email}</div>
                </div>
                <a href="#" class="profile-menu-item" id="profileMenu">
                    <i class="fas fa-user"></i>
                    <span>My Profile</span>
                </a>
                <a href="#" class="profile-menu-item" id="membershipMenu">
                    <i class="fas fa-crown"></i>
                    <span>My Membership</span>
                </a>
                <a href="#" class="profile-menu-item" id="settingsMenu">
                    <i class="fas fa-cog"></i>
                    <span>Settings</span>
                </a>
                <div class="profile-divider"></div>
                <button class="profile-menu-item" id="userLogoutBtn">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Sign Out</span>
                </button>
            `;

            // Add event listener for logout button
            const logoutBtn = document.getElementById('userLogoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => this.handleLogout());
            }
        } else {
            // User is not logged in - show only Sign In option
            dropdown.innerHTML = `
                <a href="auth.html" class="profile-menu-item">
                    <i class="fas fa-sign-in-alt"></i>
                    <span>Sign In</span>
                </a>
            `;
        }
    }
}

// Initialize authentication
const userAuth = new UserAuth();

// Make it available globally
window.userAuth = userAuth;

// Export for module usage
export { userAuth };
