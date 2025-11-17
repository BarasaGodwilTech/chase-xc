// Debugged Membership Payment System
class MembershipPaymentManager {
    constructor() {
        this.currentPlan = null;
        this.paymentMethod = null;
        this.isInitialized = false;
        this.paymentConfig = {
            mtn: {
                name: 'MTN Mobile Money',
                number: '+256 783 123 456',
                instructions: 'Send {amount} to {number}. Use "{reference}" as reference.'
            },
            airtel: {
                name: 'Airtel Money',
                number: '+256 756 123 456',
                instructions: 'Send {amount} to {number}. Use "{reference}" as reference.'
            },
            bank: {
                name: 'Bank Transfer',
                number: 'Centenary Bank - 3100045678',
                instructions: 'Transfer {amount} to:\nAccount: {number}\nName: Chase x Records\nReference: "{reference}"'
            },
            card: {
                name: 'Card Payment',
                number: 'Secure Gateway',
                instructions: 'You will be redirected to our secure payment gateway.'
            }
        };
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        console.log('🔄 Initializing Membership Payment Manager...');
        
        // Use DOMContentLoaded to ensure everything is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                console.log('📄 DOM fully loaded, setting up listeners');
                this.setupAllEventListeners();
            });
        } else {
            console.log('📄 DOM already loaded, setting up listeners immediately');
            this.setupAllEventListeners();
        }
        
        this.isInitialized = true;
    }

    setupAllEventListeners() {
        console.log('🔧 Setting up event listeners...');
        
        // Debug: Check if payment options exist
        const paymentOptions = document.querySelectorAll('.payment-option');
        console.log('💳 Found payment options:', paymentOptions.length);
        paymentOptions.forEach(option => {
            const method = option.getAttribute('data-method');
            console.log('   - Payment option:', method, option);
        });

        // Plan selection
        this.setupPlanSelection();
        
        // Payment method selection - FIXED APPROACH
        this.setupPaymentMethodSelection();
        
        // Modal controls
        this.setupModalControls();
        
        // Form submission
        this.setupFormSubmission();
        
        console.log('✅ Event listeners setup complete');
    }

    setupPlanSelection() {
        document.addEventListener('click', (e) => {
            const planButton = e.target.closest('.plan-select');
            if (planButton) {
                e.preventDefault();
                const plan = planButton.getAttribute('data-plan');
                const amount = parseInt(planButton.getAttribute('data-amount'));
                console.log('📋 Plan selected:', plan, amount);
                this.selectPlan(plan, amount);
            }
        });
    }

    setupPaymentMethodSelection() {
        // FIXED: Direct event listeners on each payment option
        document.addEventListener('click', (e) => {
            console.log('🖱️ Click event detected on:', e.target);
            
            // Check if click is on payment option or its children
            let paymentOption = e.target.closest('.payment-option');
            
            if (paymentOption) {
                console.log('🎯 Payment option clicked:', paymentOption);
                
                // Get the data-method attribute
                const method = paymentOption.getAttribute('data-method');
                console.log('📝 Data method attribute:', method);
                
                if (method) {
                    this.selectPaymentMethod(method);
                } else {
                    console.error('❌ No data-method attribute found on payment option');
                    console.log('🔍 Payment option attributes:', paymentOption.attributes);
                }
            }
        });
    }

    setupModalControls() {
        // Close modal button
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-close')) {
                e.preventDefault();
                this.hidePaymentModal();
            }
        });

        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.id === 'membershipModal') {
                this.hidePaymentModal();
            }
        });

        // Billing cycle change
        const billingCycle = document.getElementById('billingCycle');
        if (billingCycle) {
            billingCycle.addEventListener('change', (e) => {
                this.updatePlanDetails(e.target.value);
            });
        }
    }

    setupFormSubmission() {
        const form = document.getElementById('membershipForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.processMembershipPayment();
            });
        }
    }

    selectPlan(planType, amount) {
        console.log('🎯 Selecting plan:', planType);
        
        this.currentPlan = {
            type: planType,
            amount: amount,
            ...this.getPlanDetails(planType)
        };

        this.showPaymentModal();
        this.updateModalContent();
    }

    getPlanDetails(planType) {
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
        return plans[planType] || plans.monthly;
    }

    showPaymentModal() {
        const modal = document.getElementById('membershipModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            console.log('📱 Payment modal shown');
            
            // Debug: Check payment options in modal
            setTimeout(() => {
                const modalPaymentOptions = modal.querySelectorAll('.payment-option');
                console.log('💳 Payment options in modal:', modalPaymentOptions.length);
                modalPaymentOptions.forEach(option => {
                    const method = option.getAttribute('data-method');
                    console.log('   - Modal payment option:', method, option);
                });
            }, 100);
        } else {
            console.error('❌ Payment modal not found');
        }
    }

    hidePaymentModal() {
        const modal = document.getElementById('membershipModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
            this.resetForm();
            console.log('📱 Payment modal hidden');
        }
    }

    updateModalContent() {
        if (!this.currentPlan) return;

        this.updateElementText('selectedPlanName', this.currentPlan.name);
        this.updateElementText('selectedPlanPrice', `${this.currentPlan.price} / ${this.currentPlan.period}`);
        this.updateElementText('selectedPlanDescription', this.currentPlan.description);
        
        const billingCycle = document.getElementById('billingCycle');
        if (billingCycle) {
            billingCycle.value = this.currentPlan.type;
        }
    }

    updateElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }

    selectPaymentMethod(method) {
        console.log('🎯 Selecting payment method:', method);
        
        if (!method) {
            console.error('❌ No method provided to selectPaymentMethod');
            return;
        }
        
        this.paymentMethod = method;
        
        // Remove selected class from all payment options
        const allOptions = document.querySelectorAll('.payment-option');
        console.log('📝 Removing selected class from', allOptions.length, 'options');
        allOptions.forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        const selectedOption = document.querySelector(`.payment-option[data-method="${method}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
            console.log('✅ Payment method UI updated:', method);
        } else {
            console.error('❌ Payment option element not found for method:', method);
            console.log('🔍 Available payment options:');
            document.querySelectorAll('.payment-option').forEach(opt => {
                console.log('   -', opt.getAttribute('data-method'), opt);
            });
        }
        
        this.showPaymentInstructions(method);
    }

    showPaymentInstructions(method) {
        if (!this.currentPlan) {
            console.error('❌ No current plan selected');
            return;
        }

        const config = this.paymentConfig[method];
        if (!config) {
            console.error('❌ No config found for payment method:', method);
            return;
        }

        const reference = `MEM${Date.now().toString().slice(-6)}`;
        
        const instructions = config.instructions
            .replace('{amount}', `UGX ${this.formatNumber(this.currentPlan.amount)}`)
            .replace('{number}', config.number)
            .replace('{reference}', reference);

        this.updateElementText('instructionsTitle', `${config.name} Instructions`);
        this.updateElementText('instructionsText', instructions);
        
        const paymentInstructions = document.getElementById('paymentInstructions');
        if (paymentInstructions) {
            paymentInstructions.style.display = 'block';
        }

        const showTransactionInput = ['mtn', 'airtel', 'bank'].includes(method);
        const transactionInput = document.getElementById('transactionInput');
        if (transactionInput) {
            transactionInput.style.display = showTransactionInput ? 'block' : 'none';
        }

        this.currentPlan.reference = reference;
        
        console.log('📝 Payment instructions shown for:', method);
    }

    async processMembershipPayment() {
        console.log('🚀 Processing membership payment...');
        
        if (!this.validateForm()) {
            console.log('❌ Form validation failed');
            return;
        }

        const formData = new FormData(document.getElementById('membershipForm'));
        const userData = {
            fullName: formData.get('fullName'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            billingCycle: formData.get('billingCycle')
        };

        const submitBtn = document.querySelector('.submit-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<div class="spinner"></div> Processing Payment...';
        submitBtn.disabled = true;

        try {
            let paymentResult;

            if (this.paymentMethod === 'card') {
                console.log('💳 Processing card payment...');
                paymentResult = await this.processCardPayment();
            } else {
                console.log('📱 Processing mobile payment...');
                paymentResult = await this.processMobilePayment();
            }

            if (paymentResult.success) {
                console.log('✅ Payment successful');
                await this.completeMembershipRegistration(userData, paymentResult);
                this.showSuccessMessage();
            } else {
                throw new Error(paymentResult.error || 'Payment failed');
            }

        } catch (error) {
            console.error('❌ Payment error:', error);
            this.showMessage(`Payment failed: ${error.message}`, 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    async processCardPayment() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    transactionId: `CARD_${Date.now()}`,
                    gateway: 'flutterwave',
                    amount: this.currentPlan.amount
                });
            }, 2000);
        });
    }

    async processMobilePayment() {
        const transactionIdInput = document.getElementById('transactionId');
        const transactionId = transactionIdInput ? transactionIdInput.value.trim() : '';
        
        if (!transactionId) {
            throw new Error('Please enter your transaction ID');
        }

        return await this.verifyMobilePayment(transactionId);
    }

    async verifyMobilePayment(transactionId) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const isVerified = Math.random() > 0.2;
                
                if (isVerified) {
                    resolve({
                        success: true,
                        transactionId: transactionId,
                        method: this.paymentMethod,
                        amount: this.currentPlan.amount,
                        verifiedAt: new Date().toISOString()
                    });
                } else {
                    resolve({
                        success: false,
                        error: 'Payment not found or amount mismatch'
                    });
                }
            }, 3000);
        });
    }

    async completeMembershipRegistration(userData, paymentResult) {
        const membershipData = {
            ...userData,
            ...this.currentPlan,
            ...paymentResult,
            joinDate: new Date().toISOString(),
            status: 'active',
            membershipId: `MEM${Date.now().toString().slice(-8)}`
        };

        this.saveMembership(membershipData);
        await this.sendConfirmationEmail(membershipData);
        
        console.log('🎉 Membership registration completed');
    }

    saveMembership(membershipData) {
        const memberships = JSON.parse(localStorage.getItem('studioMemberships') || '[]');
        memberships.push(membershipData);
        localStorage.setItem('studioMemberships', JSON.stringify(memberships));
        
        console.log('💾 Membership saved to localStorage:', membershipData);
    }

    async sendConfirmationEmail(membershipData) {
        console.log('📧 Sending confirmation email to:', membershipData.email);
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('✅ Confirmation email sent');
                resolve(true);
            }, 1000);
        });
    }

    validateForm() {
        console.log('🔍 Validating form...');
        
        if (!this.paymentMethod) {
            this.showMessage('Please select a payment method', 'error');
            console.log('❌ No payment method selected');
            return false;
        }

        const requiredFields = [
            { id: 'fullName', name: 'Full Name' },
            { id: 'email', name: 'Email Address' },
            { id: 'phone', name: 'Phone Number' }
        ];

        for (let field of requiredFields) {
            const element = document.getElementById(field.id);
            if (element && !element.value.trim()) {
                this.showMessage(`Please fill in ${field.name}`, 'error');
                element.focus();
                console.log(`❌ Required field empty: ${field.name}`);
                return false;
            }
        }

        if (['mtn', 'airtel', 'bank'].includes(this.paymentMethod)) {
            const transactionId = document.getElementById('transactionId');
            if (transactionId && !transactionId.value.trim()) {
                this.showMessage('Please enter your transaction ID', 'error');
                transactionId.focus();
                console.log('❌ Transaction ID required');
                return false;
            }
        }

        console.log('✅ Form validation passed');
        return true;
    }

    resetForm() {
        const form = document.getElementById('membershipForm');
        if (form) form.reset();
        
        document.querySelectorAll('.payment-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        const paymentInstructions = document.getElementById('paymentInstructions');
        const transactionInput = document.getElementById('transactionInput');
        
        if (paymentInstructions) paymentInstructions.style.display = 'none';
        if (transactionInput) transactionInput.style.display = 'none';
        
        this.currentPlan = null;
        this.paymentMethod = null;
        
        console.log('🔄 Form reset');
    }

    showSuccessMessage() {
        const modalBody = document.querySelector('.modal-body');
        if (modalBody && this.currentPlan) {
            modalBody.innerHTML = `
                <div class="payment-success">
                    <i class="fas fa-check-circle"></i>
                    <h4>Welcome to Chase x Records!</h4>
                    <p>Your ${this.currentPlan.name} membership has been activated successfully.</p>
                    <p><strong>Membership ID:</strong> ${this.currentPlan.reference}</p>
                    <p>You will receive a confirmation email with all the details.</p>
                    <button class="btn btn-primary" id="successContinueBtn">
                        Start Your Journey
                    </button>
                </div>
            `;
            
            document.getElementById('successContinueBtn').addEventListener('click', () => {
                this.completeRegistration();
            });
            
            console.log('🎊 Success message shown');
        }
    }

    completeRegistration() {
        this.hidePaymentModal();
        this.showMessage('Welcome to the Chase x Records family! 🎵', 'success');
        console.log('🏁 Registration completed');
    }

    showMessage(message, type) {
        document.querySelectorAll('.toast-message').forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = `toast-message ${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? 'var(--primary)' : 'var(--accent)'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: var(--radius);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);
        
        console.log(`💬 ${type.toUpperCase()} message:`, message);
    }

    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
}

// Initialize with enhanced debugging
console.log('🚀 Loading Membership Payment Manager...');

let membershipPaymentManager;

function initializeMembershipPaymentManager() {
    console.log('🔍 Looking for membership elements...');
    
    const membershipSection = document.getElementById('membership');
    const membershipModal = document.getElementById('membershipModal');
    const paymentOptions = document.querySelectorAll('.payment-option');
    
    console.log('📋 Found elements:', {
        membershipSection: !!membershipSection,
        membershipModal: !!membershipModal,
        paymentOptions: paymentOptions.length
    });

    if (membershipSection || membershipModal) {
        membershipPaymentManager = new MembershipPaymentManager();
        console.log('✅ Membership Payment Manager initialized successfully');
        
        window.membershipPaymentManager = membershipPaymentManager;
    } else {
        console.log('⏳ Membership elements not found, waiting...');
        setTimeout(initializeMembershipPaymentManager, 500);
    }
}

// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMembershipPaymentManager);
} else {
    initializeMembershipPaymentManager();
}

// Test function
window.testPaymentSelection = function() {
    console.log('🧪 Testing payment selection...');
    const paymentOptions = document.querySelectorAll('.payment-option');
    console.log('💳 Available payment options:', paymentOptions.length);
    paymentOptions.forEach(option => {
        const method = option.getAttribute('data-method');
        console.log('   -', method, option);
    });
};

console.log('📜 membership-payments.js loaded successfully');