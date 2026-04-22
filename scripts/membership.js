import { auth } from './firebase-init.js'
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
import { initSettings, getConfig } from './config-loader.js'
import { db } from './firebase-init.js'
import { collection, addDoc, query, where, onSnapshot, orderBy, getDocs, doc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'

class MembershipManager {
    constructor() {
        this.currentUser = null;
        this.currentPlan = null;
        this.init();
    }

    async init() {
        // Initialize settings first to ensure config is loaded
        await initSettings();
        
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                this.loadMembershipData();
                this.setupEventListeners();
            } else {
                window.location.href = 'auth.html';
            }
        });
    }

    loadMembershipData() {
        if (!this.currentUser) return;

        // Load membership data from localStorage
        const membershipData = localStorage.getItem(`membership_${this.currentUser.uid}`);
        this.currentPlan = membershipData ? JSON.parse(membershipData) : {
            plan: 'free',
            status: 'active',
            startDate: new Date().toISOString(),
            usage: {
                studioHours: { used: 0, total: 0 },
                mixingSessions: { used: 0, total: 0 },
                masteringTracks: { used: 0, total: 0 }
            }
        };

        this.updateUI();
        this.loadBillingHistoryFromFirestore();
        this.loadPaymentMethods();
    }

    updateUI() {
        if (!this.currentPlan) return;

        // Update current plan display
        const planConfig = this.getPlanConfig(this.currentPlan.plan);
        
        const currentPlanName = document.getElementById('currentPlanName');
        const currentPlanDescription = document.getElementById('currentPlanDescription');
        const currentPlanIcon = document.getElementById('currentPlanIcon');
        const currentMembershipBadge = document.getElementById('currentMembershipBadge');
        const currentPlanFeatures = document.getElementById('currentPlanFeatures');

        if (currentPlanName) currentPlanName.textContent = planConfig.name;
        if (currentPlanDescription) currentPlanDescription.textContent = planConfig.description;
        if (currentPlanIcon) currentPlanIcon.className = planConfig.icon;
        if (currentMembershipBadge) {
            currentMembershipBadge.innerHTML = `<i class="${planConfig.icon}"></i> ${planConfig.name}`;
        }
        if (currentPlanFeatures) {
            currentPlanFeatures.innerHTML = planConfig.features.map(f => 
                `<li><i class="fas fa-check-circle"></i> ${f}</li>`
            ).join('');
        }

        // Update usage stats
        this.updateUsageStats();

        // Update billing date
        const nextBillingDate = document.getElementById('nextBillingDate');
        if (nextBillingDate) {
            if (this.currentPlan.plan === 'free') {
                nextBillingDate.textContent = 'N/A';
            } else {
                const startDate = new Date(this.currentPlan.startDate);
                const period = this.getPlanPeriod(this.currentPlan.plan);
                const nextDate = new Date(startDate);
                
                if (period === 'week') {
                    nextDate.setDate(nextDate.getDate() + 7);
                } else if (period === 'month') {
                    nextDate.setMonth(nextDate.getMonth() + 1);
                } else if (period === 'year') {
                    nextDate.setFullYear(nextDate.getFullYear() + 1);
                }
                
                nextBillingDate.textContent = nextDate.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            }
        }

        // Update plan prices from config if available
        this.updatePlanPrices();
    }

    getPlanConfig(plan) {
        const config = getConfig();
        const planData = config.plans?.[plan];
        
        const configs = {
            free: {
                name: 'Free Plan',
                description: 'Basic access to studio features',
                icon: 'fas fa-user',
                features: [
                    'Browse music library',
                    'Create playlists',
                    'Basic streaming',
                    'Community access'
                ]
            },
            weekly: {
                name: 'Weekly Pass',
                description: planData?.description || '10 hours of studio time per week',
                icon: 'fas fa-calendar-week',
                features: [
                    '10 hours studio time',
                    'Basic mixing (2 tracks)',
                    'Equipment rental',
                    'Engineer assistance'
                ]
            },
            monthly: {
                name: 'Monthly Pro',
                description: planData?.description || '50 hours of studio time per month',
                icon: 'fas fa-crown',
                features: [
                    '50 hours studio time',
                    'Unlimited mixing',
                    'Premium equipment',
                    'Dedicated engineer',
                    'Mastering (5 tracks)',
                    'Vocal tuning (4 sessions)'
                ]
            },
            yearly: {
                name: 'Yearly Elite',
                description: planData?.description || '600 hours of studio time per year',
                icon: 'fas fa-gem',
                features: [
                    '600 hours studio time',
                    'Unlimited mixing & mastering',
                    'VIP equipment priority',
                    'Personal producer sessions',
                    'Unlimited vocal tuning',
                    '2 free music videos'
                ]
            }
        };
        return configs[plan] || configs.free;
    }

    getPlanPeriod(plan) {
        const periods = {
            weekly: 'week',
            monthly: 'month',
            yearly: 'year'
        };
        return periods[plan] || 'month';
    }

    getPlanLimits(plan) {
        const limits = {
            free: {
                studioHours: 0,
                mixingSessions: 0,
                masteringTracks: 0
            },
            weekly: {
                studioHours: 10,
                mixingSessions: 2,
                masteringTracks: 0
            },
            monthly: {
                studioHours: 50,
                mixingSessions: 999,
                masteringTracks: 5
            },
            yearly: {
                studioHours: 600,
                mixingSessions: 999,
                masteringTracks: 999
            }
        };
        return limits[plan] || limits.free;
    }

    updateUsageStats() {
        const limits = this.getPlanLimits(this.currentPlan.plan);
        const usage = this.currentPlan.usage;

        // Update studio hours
        const studioHoursUsed = document.getElementById('studioHoursUsed');
        const studioHoursProgress = document.getElementById('studioHoursProgress');
        if (studioHoursUsed) {
            const total = limits.studioHours || 0;
            studioHoursUsed.textContent = total > 0 ? `${usage.studioHours.used} / ${total}` : 'Unlimited';
        }
        if (studioHoursProgress) {
            const percentage = limits.studioHours > 0 ? (usage.studioHours.used / limits.studioHours) * 100 : 0;
            studioHoursProgress.style.width = `${Math.min(percentage, 100)}%`;
        }

        // Update mixing sessions
        const mixingSessionsUsed = document.getElementById('mixingSessionsUsed');
        const mixingSessionsProgress = document.getElementById('mixingSessionsProgress');
        if (mixingSessionsUsed) {
            const total = limits.mixingSessions || 0;
            mixingSessionsUsed.textContent = total > 0 ? `${usage.mixingSessions.used} / ${total}` : 'Unlimited';
        }
        if (mixingSessionsProgress) {
            const percentage = limits.mixingSessions > 0 ? (usage.mixingSessions.used / limits.mixingSessions) * 100 : 0;
            mixingSessionsProgress.style.width = `${Math.min(percentage, 100)}%`;
        }

        // Update mastering tracks
        const masteringTracksUsed = document.getElementById('masteringTracksUsed');
        const masteringTracksProgress = document.getElementById('masteringTracksProgress');
        if (masteringTracksUsed) {
            const total = limits.masteringTracks || 0;
            masteringTracksUsed.textContent = total > 0 ? `${usage.masteringTracks.used} / ${total}` : 'Unlimited';
        }
        if (masteringTracksProgress) {
            const percentage = limits.masteringTracks > 0 ? (usage.masteringTracks.used / limits.masteringTracks) * 100 : 0;
            masteringTracksProgress.style.width = `${Math.min(percentage, 100)}%`;
        }
    }

    updatePlanPrices() {
        const config = getConfig();
        if (config && config.plans) {
            const weeklyPrice = document.getElementById('weeklyPrice');
            const monthlyPrice = document.getElementById('monthlyPrice');
            const yearlyPrice = document.getElementById('yearlyPrice');

            if (weeklyPrice && config.plans.weekly) {
                weeklyPrice.textContent = `UGX ${config.plans.weekly.price.toLocaleString()}`;
            }
            if (monthlyPrice && config.plans.monthly) {
                monthlyPrice.textContent = `UGX ${config.plans.monthly.price.toLocaleString()}`;
            }
            if (yearlyPrice && config.plans.yearly) {
                yearlyPrice.textContent = `UGX ${config.plans.yearly.price.toLocaleString()}`;
            }
        }
    }

    loadBillingHistoryFromFirestore() {
        const billingHistoryBody = document.getElementById('billingHistoryBody');
        if (!billingHistoryBody || !this.currentUser) return;

        // Set up real-time listener for user's payments
        const paymentsQuery = query(
            collection(db, 'payments'),
            where('userId', '==', this.currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        this.paymentsUnsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
            const payments = [];
            snapshot.forEach(doc => {
                payments.push({ id: doc.id, ...doc.data() });
            });

            // Update membership status if payment is verified
            const verifiedPayment = payments.find(p => p.status === 'verified' && this.currentPlan.status === 'pending');
            if (verifiedPayment) {
                this.currentPlan.status = 'active';
                localStorage.setItem(`membership_${this.currentUser.uid}`, JSON.stringify(this.currentPlan));
                this.updateUI();
                this.showNotification('Your membership has been activated!', 'success');
            }

            if (payments.length === 0) {
                billingHistoryBody.innerHTML = `
                    <tr class="no-billing">
                        <td colspan="5">
                            <div class="empty-state">
                                <i class="fas fa-receipt"></i>
                                <p>No billing history yet</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            billingHistoryBody.innerHTML = payments.map(item => `
                <tr>
                    <td>${new Date(item.createdAt).toLocaleDateString()}</td>
                    <td>${item.description}</td>
                    <td>UGX ${item.amount.toLocaleString()}</td>
                    <td><span class="status-${item.status}">${item.status}</span></td>
                    <td><button class="btn-text"><i class="fas fa-download"></i></button></td>
                </tr>
            `).join('');
        }, (error) => {
            console.error('Error loading billing history:', error);
            // Fallback to localStorage if Firestore fails
            this.loadBillingHistoryFromLocalStorage();
        });
    }

    loadBillingHistoryFromLocalStorage() {
        const billingHistoryBody = document.getElementById('billingHistoryBody');
        if (!billingHistoryBody) return;

        const billingHistory = JSON.parse(localStorage.getItem(`billingHistory_${this.currentUser.uid}`) || '[]');

        if (billingHistory.length === 0) {
            billingHistoryBody.innerHTML = `
                <tr class="no-billing">
                    <td colspan="5">
                        <div class="empty-state">
                            <i class="fas fa-receipt"></i>
                            <p>No billing history yet</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        billingHistoryBody.innerHTML = billingHistory.map(item => `
            <tr>
                <td>${new Date(item.date).toLocaleDateString()}</td>
                <td>${item.description}</td>
                <td>UGX ${item.amount.toLocaleString()}</td>
                <td><span class="status-${item.status}">${item.status}</span></td>
                <td><button class="btn-text"><i class="fas fa-download"></i></button></td>
            </tr>
        `).join('');
    }

    loadPaymentMethods() {
        const paymentMethodsList = document.getElementById('paymentMethodsList');
        if (!paymentMethodsList) return;

        const paymentMethods = JSON.parse(localStorage.getItem(`paymentMethods_${this.currentUser.uid}`) || '[]');

        if (paymentMethods.length === 0) {
            // Show default unconfigured methods
            return;
        }

        paymentMethodsList.innerHTML = paymentMethods.map(method => `
            <div class="payment-method-card">
                <div class="payment-method-icon">
                    <i class="${method.icon}"></i>
                </div>
                <div class="payment-method-info">
                    <h4>${method.name}</h4>
                    <p>${method.details}</p>
                </div>
                <button class="btn-text">Manage</button>
            </div>
        `).join('');
    }

    setupEventListeners() {
        // Upgrade button
        const upgradeMembershipBtn = document.getElementById('upgradeMembershipBtn');
        if (upgradeMembershipBtn) {
            upgradeMembershipBtn.addEventListener('click', () => {
                document.getElementById('availablePlansSection')?.scrollIntoView({ behavior: 'smooth' });
            });
        }

        // Plan selection buttons
        const selectPlanBtns = document.querySelectorAll('.select-plan-btn');
        selectPlanBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const plan = e.currentTarget.dataset.plan;
                this.openUpgradeModal(plan);
            });
        });

        // Upgrade modal
        const closeUpgradeModal = document.getElementById('closeUpgradeModal');
        const upgradeModal = document.getElementById('upgradeModal');
        const upgradeForm = document.getElementById('upgradeForm');

        if (closeUpgradeModal) {
            closeUpgradeModal.addEventListener('click', () => this.closeUpgradeModal());
        }

        if (upgradeModal) {
            upgradeModal.addEventListener('click', (e) => {
                if (e.target === upgradeModal) {
                    this.closeUpgradeModal();
                }
            });
        }

        if (upgradeForm) {
            upgradeForm.addEventListener('submit', (e) => this.handleUpgrade(e));
        }

        // Payment method selection
        const paymentMethodSelect = document.getElementById('upgradePaymentMethod');
        if (paymentMethodSelect) {
            paymentMethodSelect.addEventListener('change', (e) => {
                this.updatePaymentInstructions(e.target.value);
            });
        }

        // Cancel subscription
        const cancelSubscriptionBtn = document.getElementById('cancelSubscriptionBtn');
        if (cancelSubscriptionBtn) {
            cancelSubscriptionBtn.addEventListener('click', () => this.handleCancelSubscription());
        }

        // Add payment method
        const addPaymentMethodBtn = document.getElementById('addPaymentMethodBtn');
        if (addPaymentMethodBtn) {
            addPaymentMethodBtn.addEventListener('click', () => this.showNotification('Payment method setup coming soon', 'info'));
        }

        // Close modal on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeUpgradeModal();
            }
        });

        // Listen for config updates
        window.addEventListener('settingsUpdated', (event) => {
            const config = event.detail;
            this.updatePlanPrices();
            this.updateUI(); // Re-render plan descriptions when config changes
        });
    }

    openUpgradeModal(plan) {
        const modal = document.getElementById('upgradeModal');
        const selectedPlanName = document.getElementById('selectedPlanName');
        const selectedPlanPrice = document.getElementById('selectedPlanPrice');
        const planConfig = this.getPlanConfig(plan);

        if (selectedPlanName) selectedPlanName.textContent = planConfig.name;

        let price = 'UGX 0';
        if (window.studioConfig && window.studioConfig.plans && window.studioConfig.plans[plan]) {
            price = `UGX ${window.studioConfig.plans[plan].price.toLocaleString()}`;
        }
        
        if (selectedPlanPrice) {
            const period = this.getPlanPeriod(plan);
            selectedPlanPrice.textContent = `${price} / ${period}`;
        }

        // Store selected plan
        this.selectedPlan = plan;

        if (modal) modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeUpgradeModal() {
        const modal = document.getElementById('upgradeModal');
        if (modal) modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Reset form
        const upgradeForm = document.getElementById('upgradeForm');
        if (upgradeForm) upgradeForm.reset();
        
        const paymentInfo = document.getElementById('paymentInfo');
        const transactionIdGroup = document.getElementById('transactionIdGroup');
        if (paymentInfo) paymentInfo.style.display = 'none';
        if (transactionIdGroup) transactionIdGroup.style.display = 'none';
    }

    updatePaymentInstructions(method) {
        const paymentInfo = document.getElementById('paymentInfo');
        const paymentInstructions = document.getElementById('paymentInstructions');
        const transactionIdGroup = document.getElementById('transactionIdGroup');

        if (!method) {
            if (paymentInfo) paymentInfo.style.display = 'none';
            if (transactionIdGroup) transactionIdGroup.style.display = 'none';
            return;
        }

        const instructions = {
            mtn: 'Send payment to MTN number: +256 700 000 000. Enter the transaction ID below.',
            airtel: 'Send payment to Airtel number: +256 700 000 000. Enter the reference ID below.',
            bank: 'Transfer to bank account: Chase x Records, Account: 0000000000. Enter the reference below.'
        };

        if (paymentInfo && paymentInstructions) {
            paymentInstructions.textContent = instructions[method] || '';
            paymentInfo.style.display = 'block';
        }

        if (transactionIdGroup) {
            transactionIdGroup.style.display = 'block';
        }
    }

    async handleUpgrade(e) {
        e.preventDefault();

        const phone = document.getElementById('upgradePhone').value.trim();
        const paymentMethod = document.getElementById('upgradePaymentMethod').value;
        const transactionId = document.getElementById('transactionId').value.trim();

        if (!phone || !paymentMethod) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        if (paymentMethod !== 'card' && !transactionId) {
            this.showNotification('Please enter the transaction ID', 'error');
            return;
        }

        const config = getConfig();
        const price = config?.plans?.[this.selectedPlan]?.price || 0;

        // Save payment to Firestore
        try {
            const paymentData = {
                userId: this.currentUser.uid,
                userEmail: this.currentUser.email,
                userName: this.currentUser.displayName || 'User',
                plan: this.selectedPlan,
                amount: price,
                paymentMethod: paymentMethod,
                phoneNumber: phone,
                transactionId: transactionId,
                status: 'pending',
                description: `${this.selectedPlan.charAt(0).toUpperCase() + this.selectedPlan.slice(1)} Plan`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await addDoc(collection(db, 'payments'), paymentData);

            // Update local membership (will be fully activated when admin confirms)
            this.currentPlan = {
                plan: this.selectedPlan,
                status: 'pending', // Pending until admin confirms payment
                startDate: new Date().toISOString(),
                paymentMethod: paymentMethod,
                phone: phone,
                transactionId: transactionId,
                usage: {
                    studioHours: { used: 0, total: this.getPlanLimits(this.selectedPlan).studioHours },
                    mixingSessions: { used: 0, total: this.getPlanLimits(this.selectedPlan).mixingSessions },
                    masteringTracks: { used: 0, total: this.getPlanLimits(this.selectedPlan).masteringTracks }
                }
            };

            localStorage.setItem(`membership_${this.currentUser.uid}`, JSON.stringify(this.currentPlan));

            this.updateUI();
            this.closeUpgradeModal();
            this.showNotification('Payment submitted! We will verify and activate your membership shortly.', 'success');
        } catch (error) {
            console.error('Error submitting payment:', error);
            this.showNotification('Error submitting payment. Please try again.', 'error');
        }
    }

    handleCancelSubscription() {
        if (this.currentPlan.plan === 'free') {
            this.showNotification('You are already on the free plan', 'info');
            return;
        }

        if (confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
            this.currentPlan.plan = 'free';
            this.currentPlan.status = 'cancelled';
            this.currentPlan.usage = {
                studioHours: { used: 0, total: 0 },
                mixingSessions: { used: 0, total: 0 },
                masteringTracks: { used: 0, total: 0 }
            };

            localStorage.setItem(`membership_${this.currentUser.uid}`, JSON.stringify(this.currentPlan));
            this.updateUI();
            this.showNotification('Subscription cancelled. You will revert to the free plan at the end of your billing period.', 'success');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#00d4ff'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            z-index: 3000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize membership page
document.addEventListener('DOMContentLoaded', () => {
    new MembershipManager();
});

// Add notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
