// Savings and Targets Management with Payment Integration
class SavingsManager {
    constructor() {
        this.savingsGoals = JSON.parse(localStorage.getItem('savingsGoals')) || []
        this.currentGoalData = null
        this.init()
    }

    init() {
        this.setupEventListeners()
        this.renderGoals()
        this.updateDashboard()
        this.setupPaymentModal()
    }

    setupEventListeners() {
        const form = document.getElementById('savingsForm')
        if (form) {
            form.addEventListener('submit', (e) => this.createGoal(e))
        }
    }

    setupPaymentModal() {
        // Payment method selection
        document.querySelectorAll('.payment-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.payment-option').forEach(opt => 
                    opt.classList.remove('selected')
                )
                option.classList.add('selected')
                
                const method = option.getAttribute('data-method')
                this.showPaymentInstructions(method)
            })
        })

        // Confirm payment
        document.getElementById('confirmPayment')?.addEventListener('click', () => {
            this.processPayment()
        })

        // Close modal
        document.querySelector('.modal-close')?.addEventListener('click', () => {
            this.hidePaymentModal()
        })

        // Close modal when clicking outside
        document.getElementById('paymentModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'paymentModal') {
                this.hidePaymentModal()
            }
        })
    }

    createGoal(e) {
        e.preventDefault()
        
        const formData = new FormData(e.target)
        const currentAmount = parseInt(formData.get('currentAmount'))
        
        if (currentAmount > 0) {
            // Store goal data and show payment modal
            this.currentGoalData = {
                projectName: formData.get('projectName'),
                targetAmount: parseInt(formData.get('targetAmount')),
                currentAmount: currentAmount,
                targetDate: formData.get('targetDate'),
                serviceType: formData.get('serviceType'),
                createdAt: new Date().toISOString(),
                completed: false,
                isAdditional: false
            }
            
            this.showPaymentModal()
        } else {
            // Create goal without payment
            this.saveGoal({
                projectName: formData.get('projectName'),
                targetAmount: parseInt(formData.get('targetAmount')),
                currentAmount: 0,
                targetDate: formData.get('targetDate'),
                serviceType: formData.get('serviceType'),
                createdAt: new Date().toISOString(),
                completed: false
            })
            
            e.target.reset()
            this.showMessage('Savings goal created successfully!', 'success')
        }
    }

    showPaymentModal() {
        if (!this.currentGoalData) return

        const modal = document.getElementById('paymentModal')
        document.getElementById('paymentProjectName').textContent = this.currentGoalData.projectName
        document.getElementById('paymentAmount').textContent = this.formatNumber(this.currentGoalData.currentAmount)
        document.getElementById('paymentService').textContent = this.getServiceName(this.currentGoalData.serviceType)
        
        modal.style.display = 'flex'
        
        // Reset payment form
        document.querySelectorAll('.payment-option').forEach(opt => 
            opt.classList.remove('selected')
        )
        document.getElementById('paymentInstructions').style.display = 'none'
        document.getElementById('transactionId').value = ''
    }

    hidePaymentModal() {
        document.getElementById('paymentModal').style.display = 'none'
        this.currentGoalData = null
    }

    showPaymentInstructions(method) {
        const instructions = document.getElementById('paymentInstructions')
        const instructionsText = document.getElementById('instructionsText')
        
        const methodInstructions = {
            mtn: `Send UGX ${this.formatNumber(this.currentGoalData.currentAmount)} to MTN Mobile Money number 0783 123 456. Use your project name as reference.`,
            airtel: `Send UGX ${this.formatNumber(this.currentGoalData.currentAmount)} to Airtel Money number 0756 123 456. Use your project name as reference.`,
            bank: `Transfer UGX ${this.formatNumber(this.currentGoalData.currentAmount)} to:\nBank: Centenary Bank\nAccount: 3100045678\nName: Chase x Records\nUse your project name as reference.`,
            card: `You will be redirected to our secure payment gateway to complete your card payment of UGX ${this.formatNumber(this.currentGoalData.currentAmount)}.`
        }
        
        instructionsText.textContent = methodInstructions[method] || 'Please complete the payment using your selected method.'
        instructions.style.display = 'block'
    }

    processPayment() {
    const transactionId = document.getElementById('transactionId').value.trim();
    
    if (!transactionId) {
        this.showMessage('Please enter a transaction ID/reference', 'error');
        return;
    }

    // Show processing state
    const confirmBtn = document.getElementById('confirmPayment');
    confirmBtn.innerHTML = '<div class="spinner"></div> Processing...';
    confirmBtn.disabled = true;

    // Store payment in waiting state
    const waitingPayment = {
        id: `payment_${Date.now()}`,
        projectName: this.currentGoalData.projectName,
        amount: this.currentGoalData.currentAmount,
        transactionId: transactionId,
        timestamp: new Date().toISOString(),
        status: 'waiting_verification'
    };

    // Save to "server" (localStorage for demo)
    this.saveWaitingPayment(waitingPayment);

    // Start verification polling
    this.startPaymentVerification(waitingPayment.id);
}

saveWaitingPayment(payment) {
    const waitingPayments = JSON.parse(localStorage.getItem('waitingUserPayments') || '[]');
    waitingPayments.push(payment);
    localStorage.setItem('waitingUserPayments', JSON.stringify(waitingPayments));
}

startPaymentVerification(paymentId) {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes (5-second intervals)
    
    const checkInterval = setInterval(() => {
        attempts++;
        const confirmation = this.checkPaymentConfirmation(paymentId);
        
        if (confirmation) {
            clearInterval(checkInterval);
            this.handleVerificationResult(confirmation);
            
            // Show real-time status update
            this.updatePaymentStatus('verified', confirmation);
        } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            this.handleVerificationTimeout();
            this.updatePaymentStatus('timeout');
        } else {
            // Show waiting status
            this.updatePaymentStatus('waiting', { attempts, maxAttempts });
        }
    }, 5000); // Check every 5 seconds
}

updatePaymentStatus(status, data = {}) {
    const statusElement = document.getElementById('paymentStatus') || this.createStatusElement();
    
    const statusMessages = {
        waiting: `⏳ Waiting for studio verification... (${data.attempts}/${data.maxAttempts})`,
        verified: '✅ Payment verified by studio!',
        mismatch: '⚠️ Payment received but ID mismatch',
        timeout: '❌ Verification timeout - contact support'
    };
    
    statusElement.textContent = statusMessages[status] || statusMessages.waiting;
    statusElement.className = `payment-status status-${status}`;
}

createStatusElement() {
    const statusElement = document.createElement('div');
    statusElement.id = 'paymentStatus';
    statusElement.style.cssText = `
        text-align: center;
        padding: 1rem;
        margin: 1rem 0;
        border-radius: var(--radius);
        font-weight: 600;
    `;
    
    const modalBody = document.querySelector('.modal-body');
    const instructions = document.getElementById('paymentInstructions');
    if (instructions) {
        instructions.parentNode.insertBefore(statusElement, instructions.nextSibling);
    }
    
    return statusElement;
}

checkPaymentConfirmation(paymentId) {
    const confirmations = JSON.parse(localStorage.getItem('paymentConfirmations') || '[]');
    return confirmations.find(conf => conf.userPaymentId === paymentId);
}

handleVerificationResult(confirmation) {
    if (confirmation.matched) {
        // Perfect match - complete payment
        this.completePaymentProcess(confirmation);
        this.showMessage('Payment verified successfully!', 'success');
    } else {
        // Amount received but transaction ID mismatch
        this.handleTransactionIdMismatch(confirmation);
    }
}

handleTransactionIdMismatch(confirmation) {
    const modalBody = document.querySelector('.modal-body');
    modalBody.innerHTML = `
        <div class="payment-mismatch">
            <i class="fas fa-exclamation-triangle" style="color: #ffc107; font-size: 3rem; margin-bottom: 1rem;"></i>
            <h4>Payment Received - ID Mismatch</h4>
            <p>We received UGX ${this.formatNumber(confirmation.amount)} from ${confirmation.sender}, 
            but the transaction ID doesn't match.</p>
            <div class="mismatch-details">
                <p><strong>Your entered ID:</strong> ${confirmation.userTransactionId}</p>
                <p><strong>Actual ID from SMS:</strong> ${confirmation.studioTransactionId}</p>
            </div>
            <div class="mismatch-actions">
                <button onclick="savingsManager.correctTransactionId('${confirmation.userPaymentId}', '${confirmation.studioTransactionId}')" 
                        class="btn btn-primary">
                    Use Correct ID
                </button>
                <button onclick="savingsManager.contactSupport('${confirmation.userPaymentId}')" 
                        class="btn btn-secondary">
                    Contact Support
                </button>
            </div>
        </div>
    `;
}

correctTransactionId(paymentId, correctId) {
    // Update the transaction ID and complete payment
    const confirmations = JSON.parse(localStorage.getItem('paymentConfirmations') || '[]');
    const confirmation = confirmations.find(conf => conf.userPaymentId === paymentId);
    
    if (confirmation) {
        confirmation.userTransactionId = correctId;
        confirmation.matched = true;
        localStorage.setItem('paymentConfirmations', JSON.stringify(confirmations));
        
        this.completePaymentProcess(confirmation);
        this.showMessage('Payment completed with corrected ID!', 'success');
    }
}

contactSupport(paymentId) {
    alert('Please contact support at +256 757 858 462 with your payment details.');
    this.hidePaymentModal();
}

handleVerificationTimeout() {
    const modalBody = document.querySelector('.modal-body');
    modalBody.innerHTML = `
        <div class="payment-timeout">
            <i class="fas fa-clock" style="color: #dc3545; font-size: 3rem; margin-bottom: 1rem;"></i>
            <h4>Payment Verification Timeout</h4>
            <p>We haven't received confirmation of your payment yet.</p>
            <div class="timeout-actions">
                <button onclick="savingsManager.retryVerification()" class="btn btn-primary">
                    Retry Verification
                </button>
                <button onclick="savingsManager.contactSupport('timeout')" class="btn btn-secondary">
                    Contact Support
                </button>
            </div>
        </div>
    `;
}

retryVerification() {
    // Reset and restart verification
    this.hidePaymentModal();
    this.showPaymentModal();
    this.showMessage('Please try the payment verification again', 'info');
}

completePaymentProcess(confirmation) {
    if (this.currentGoalData.isAdditional) {
        this.processAdditionalPayment(confirmation.studioTransactionId);
    } else {
        this.saveGoal({
            ...this.currentGoalData,
            transactionId: confirmation.studioTransactionId,
            paymentDate: new Date().toISOString(),
            verified: true
        });
    }
    
    this.showPaymentSuccess();
}

    showPaymentSuccess() {
        const modalBody = document.querySelector('.modal-body')
        modalBody.innerHTML = `
            <div class="payment-success">
                <i class="fas fa-check-circle"></i>
                <h4>Payment Successful!</h4>
                <p>Your payment of UGX ${this.formatNumber(this.currentGoalData.currentAmount)} has been received${this.currentGoalData.isAdditional ? ' and added to your savings goal' : ' and your savings goal has been created'}.</p>
                <button class="btn btn-primary" onclick="savingsManager.completePaymentProcess()">Continue</button>
            </div>
        `
    }

    completePaymentProcess() {
        this.hidePaymentModal()
        document.getElementById('savingsForm').reset()
    }

    saveGoal(goalData) {
        const goal = {
            id: Date.now().toString(),
            ...goalData
        }

        this.savingsGoals.push(goal)
        this.saveToLocalStorage()
        this.renderGoals()
        this.updateDashboard()
        this.showMessage('Savings goal created successfully!', 'success')
    }

    updateGoal(goalId, updates) {
        const goalIndex = this.savingsGoals.findIndex(g => g.id === goalId)
        if (goalIndex !== -1) {
            this.savingsGoals[goalIndex] = { ...this.savingsGoals[goalIndex], ...updates }
            this.saveToLocalStorage()
            this.renderGoals()
            this.updateDashboard()
        }
    }

    deleteGoal(goalId) {
        this.savingsGoals = this.savingsGoals.filter(g => g.id !== goalId)
        this.saveToLocalStorage()
        this.renderGoals()
        this.updateDashboard()
        this.showMessage('Goal deleted successfully!', 'success')
    }

    addSavings(goalId, amount) {
        if (amount > 0) {
            // Show payment modal for additional savings
            const goal = this.savingsGoals.find(g => g.id === goalId)
            this.currentGoalData = {
                projectName: goal.projectName,
                targetAmount: goal.targetAmount,
                currentAmount: amount,
                serviceType: goal.serviceType,
                goalId: goalId,
                isAdditional: true
            }
            
            this.showPaymentModal()
        }
    }

    processAdditionalPayment(transactionId) {
        const goal = this.savingsGoals.find(g => g.id === this.currentGoalData.goalId)
        if (goal) {
            const newAmount = goal.currentAmount + this.currentGoalData.currentAmount
            const completed = newAmount >= goal.targetAmount
            
            this.updateGoal(this.currentGoalData.goalId, {
                currentAmount: newAmount,
                completed: completed,
                lastPaymentDate: new Date().toISOString(),
                lastPaymentAmount: this.currentGoalData.currentAmount,
                lastTransactionId: transactionId
            })

            if (completed) {
                this.showMessage(`Congratulations! You've reached your savings goal for "${goal.projectName}"`, 'success')
            }
        }
    }

    showAddSavingsModal(goalId) {
        const amount = prompt('Enter amount to add (UGX):')
        if (amount && !isNaN(amount) && parseInt(amount) > 0) {
            this.addSavings(goalId, parseInt(amount))
        } else if (amount) {
            this.showMessage('Please enter a valid amount greater than 0', 'error')
        }
    }

    calculateDaysLeft(targetDate) {
        const today = new Date()
        const target = new Date(targetDate)
        const diffTime = target - today
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    getServiceName(serviceType) {
        const services = {
            'production': 'Music Production',
            'mixing': 'Mixing & Mastering',
            'vocal': 'Vocal Production',
            'songwriting': 'Songwriting',
            'other': 'Other'
        }
        return services[serviceType] || serviceType
    }

    renderGoals() {
        const goalsList = document.getElementById('goalsList')
        if (!goalsList) return

        if (this.savingsGoals.length === 0) {
            goalsList.innerHTML = `
                <div class="no-goals">
                    <p>No savings goals yet. Create your first goal above!</p>
                </div>
            `
            return
        }

        goalsList.innerHTML = this.savingsGoals.map(goal => this.createGoalCard(goal)).join('')
    }

    createGoalCard(goal) {
        const progress = (goal.currentAmount / goal.targetAmount) * 100
        const daysLeft = this.calculateDaysLeft(goal.targetDate)
        const progressClass = progress >= 100 ? 'completed' : progress >= 75 ? 'almost-there' : 'in-progress'
        
        return `
            <div class="goal-card ${progressClass}">
                <div class="goal-header">
                    <h4>${goal.projectName}</h4>
                    <span class="service-badge">${this.getServiceName(goal.serviceType)}</span>
                </div>
                
                <div class="goal-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${Math.min(progress, 100)}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>UGX ${this.formatNumber(goal.currentAmount)} / UGX ${this.formatNumber(goal.targetAmount)}</span>
                        <span>${progress.toFixed(1)}%</span>
                    </div>
                </div>

                <div class="goal-details">
                    <div class="detail-item">
                        <i class="fas fa-calendar"></i>
                        <span>Target: ${new Date(goal.targetDate).toLocaleDateString()}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-clock"></i>
                        <span>${daysLeft > 0 ? `${daysLeft} days left` : 'Target date passed'}</span>
                    </div>
                    ${goal.paymentDate ? `
                    <div class="detail-item">
                        <i class="fas fa-receipt"></i>
                        <span>Initial payment: ${new Date(goal.paymentDate).toLocaleDateString()}</span>
                    </div>
                    ` : ''}
                    ${goal.lastPaymentDate ? `
                    <div class="detail-item">
                        <i class="fas fa-history"></i>
                        <span>Last payment: ${new Date(goal.lastPaymentDate).toLocaleDateString()}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="goal-actions">
                    <button class="btn btn-secondary btn-sm" onclick="savingsManager.showAddSavingsModal('${goal.id}')">
                        <i class="fas fa-plus"></i> Add Savings
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="savingsManager.deleteGoal('${goal.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>

                ${progress >= 100 ? `
                    <div class="completion-badge">
                        <i class="fas fa-trophy"></i> Goal Achieved!
                    </div>
                ` : ''}
            </div>
        `
    }

    updateDashboard() {
        const totalSaved = this.savingsGoals.reduce((sum, goal) => sum + goal.currentAmount, 0)
        const activeGoals = this.savingsGoals.filter(goal => !goal.completed).length
        
        // Update dashboard stats
        const totalSavedElement = document.querySelector('.savings-stats .stat-card:nth-child(1) .amount')
        const activeGoalsElement = document.querySelector('.savings-stats .stat-card:nth-child(2) .amount')
        const nextTargetElement = document.querySelector('.savings-stats .stat-card:nth-child(3) .amount')

        if (totalSavedElement) totalSavedElement.textContent = `UGX ${this.formatNumber(totalSaved)}`
        if (activeGoalsElement) activeGoalsElement.textContent = activeGoals.toString()

        // Find next target date
        const upcomingGoals = this.savingsGoals
            .filter(goal => !goal.completed)
            .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate))
        
        if (nextTargetElement) {
            nextTargetElement.textContent = upcomingGoals.length > 0 ? 
                new Date(upcomingGoals[0].targetDate).toLocaleDateString() : '-'
        }
    }

    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    }

    showMessage(message, type) {
        // Create toast notification
        const toast = document.createElement('div')
        toast.className = `toast-message ${type}`
        toast.textContent = message
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
        `

        document.body.appendChild(toast)

        setTimeout(() => {
            toast.remove()
        }, 3000)
    }

    saveToLocalStorage() {
        localStorage.setItem('savingsGoals', JSON.stringify(this.savingsGoals))
    }
}

// Initialize savings manager when DOM is ready
let savingsManager
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('savingsForm')) {
        savingsManager = new SavingsManager()
    }
})

// Development Payment Bypass - Add this to the end of your savings.js file
class DevPaymentBypass {
    constructor(savingsManager) {
        this.savingsManager = savingsManager;
        this.setupBypass();
    }

    setupBypass() {
        // Override the processPayment method
        const originalProcessPayment = this.savingsManager.processPayment.bind(this.savingsManager);
        
        this.savingsManager.processPayment = () => {
            const transactionId = document.getElementById('transactionId').value.trim();
            
            if (!transactionId) {
                this.savingsManager.showMessage('Please enter a transaction ID/reference', 'error');
                return;
            }

            // Show processing state
            const confirmBtn = document.getElementById('confirmPayment');
            confirmBtn.innerHTML = '<div class="spinner"></div> Processing...';
            confirmBtn.disabled = true;

            // Simulate payment processing delay
            setTimeout(() => {
                // Auto-approve any transaction ID for development
                const mockConfirmation = {
                    id: `dev_payment_${Date.now()}`,
                    matched: true,
                    amount: this.savingsManager.currentGoalData.currentAmount,
                    studioTransactionId: transactionId || `DEV_${Math.random().toString(36).substr(2, 9)}`,
                    userPaymentId: `dev_${Date.now()}`,
                    userTransactionId: transactionId,
                    sender: "DEV_USER"
                };

                // Complete payment process directly
                if (this.savingsManager.currentGoalData.isAdditional) {
                    this.savingsManager.processAdditionalPayment(mockConfirmation.studioTransactionId);
                } else {
                    this.savingsManager.saveGoal({
                        ...this.savingsManager.currentGoalData,
                        transactionId: mockConfirmation.studioTransactionId,
                        paymentDate: new Date().toISOString(),
                        verified: true
                    });
                }

                // Show success message
                this.savingsManager.showPaymentSuccess();
                
                // Reset button
                confirmBtn.innerHTML = 'Confirm Payment';
                confirmBtn.disabled = false;

                console.log('✅ Development Payment Bypass: Payment auto-approved with transaction ID:', mockConfirmation.studioTransactionId);
                
            }, 1500); // 1.5 second delay to simulate processing
        };

        console.log('<i class="fas fa-history"></i> Development Payment Bypass: Active - All payments will be auto-approved');
    }
}

// Initialize the bypass when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('savingsForm') && savingsManager) {
        new DevPaymentBypass(savingsManager);
        
        // Also add a helper function to quickly fill test data
        window.fillTestPayment = function() {
            const testIds = ['TEST123456', 'DEV789012', 'FAKE_TRANSACTION', 'BY_PASS_ME'];
            const randomId = testIds[Math.floor(Math.random() * testIds.length)];
            document.getElementById('transactionId').value = randomId;
            console.log('🧪 Test transaction ID filled:', randomId);
        };
        
        // Auto-fill test ID when payment modal opens (optional)
        const originalShowModal = savingsManager.showPaymentModal.bind(savingsManager);
        savingsManager.showPaymentModal = function() {
            originalShowModal();
            setTimeout(() => {
                if (document.getElementById('transactionId')) {
                    window.fillTestPayment();
                }
            }, 100);
        };
    }
});