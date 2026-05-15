// =============================================
// QUIZLY — Auth Page Logic
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    const API = 'http://localhost:5000/api';

    // ========== TAB SWITCHING ==========
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabIndicator = document.getElementById('tabIndicator');
    const sidebarTitle = document.getElementById('sidebarTitle');
    const sidebarText = document.getElementById('sidebarText');

    function switchTab(tab) {
        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
            if (tabIndicator) tabIndicator.style.transform = 'translateX(0)';
            if (sidebarTitle) sidebarTitle.textContent = 'Welcome Back!';
            if (sidebarText) sidebarText.textContent = 'Login to access your dashboard, attempt quizzes, and track your progress.';
        } else {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.classList.add('active');
            loginForm.classList.remove('active');
            if (tabIndicator) tabIndicator.style.transform = 'translateX(100%)';
            if (sidebarTitle) sidebarTitle.textContent = 'Join Quizly!';
            if (sidebarText) sidebarText.textContent = 'Create your account to access quizzes, compete with peers, and track your learning.';
        }
    }

    if (loginTab) loginTab.addEventListener('click', () => switchTab('login'));
    if (registerTab) registerTab.addEventListener('click', () => switchTab('register'));

    // Switch links
    const switchToRegister = document.getElementById('switchToRegister');
    const switchToLogin = document.getElementById('switchToLogin');
    if (switchToRegister) switchToRegister.addEventListener('click', (e) => { e.preventDefault(); switchTab('register'); });
    if (switchToLogin) switchToLogin.addEventListener('click', (e) => { e.preventDefault(); switchTab('login'); });

    // Nav links
    const navLoginLink = document.getElementById('navLoginLink');
    const navRegisterLink = document.getElementById('navRegisterLink');
    if (navLoginLink) navLoginLink.addEventListener('click', (e) => { e.preventDefault(); switchTab('login'); });
    if (navRegisterLink) navRegisterLink.addEventListener('click', (e) => { e.preventDefault(); switchTab('register'); });

    // Check hash on load
    if (window.location.hash === '#register') switchTab('register');

    // ========== SHOW/HIDE PASSWORD ==========
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.target);
            const icon = btn.querySelector('i');
            if (target.type === 'password') {
                target.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                target.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    // ========== ROLE SELECTOR ==========
    const roleOptions = document.querySelectorAll('.role-option');
    roleOptions.forEach(option => {
        option.addEventListener('click', () => {
            roleOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            option.querySelector('input').checked = true;
        });
    });

    // ========== PASSWORD STRENGTH ==========
    const regPassword = document.getElementById('registerPassword');
    const strengthBars = document.querySelectorAll('.strength-bar');
    const strengthText = document.getElementById('strengthText');

    if (regPassword) {
        regPassword.addEventListener('input', () => {
            const val = regPassword.value;
            let score = 0;
            if (val.length >= 6) score++;
            if (val.length >= 8) score++;
            if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
            if (/[0-9]/.test(val) && /[^A-Za-z0-9]/.test(val)) score++;

            const levels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
            const classes = ['', 'weak', 'fair', 'good', 'strong'];
            const colors = ['', '#FF6B6B', '#FFA36C', '#FFEAA7', '#4ECDC4'];

            strengthBars.forEach((bar, i) => {
                bar.className = 'strength-bar';
                if (i < score) bar.classList.add(classes[score]);
            });
            if (strengthText) {
                strengthText.textContent = val.length > 0 ? levels[score] : '';
                strengthText.style.color = colors[score];
            }
            updateProgress();
        });
    }

    // ========== CONFIRM PASSWORD ==========
    const confirmPassword = document.getElementById('confirmPassword');
    const confirmMsg = document.getElementById('confirmMsg');

    if (confirmPassword) {
        confirmPassword.addEventListener('input', () => {
            if (confirmPassword.value && regPassword.value !== confirmPassword.value) {
                confirmMsg.textContent = 'Passwords do not match';
                confirmMsg.className = 'validation-msg error';
                confirmPassword.classList.add('input-error');
                confirmPassword.classList.remove('input-success');
            } else if (confirmPassword.value) {
                confirmMsg.textContent = 'Passwords match ✓';
                confirmMsg.className = 'validation-msg success';
                confirmPassword.classList.remove('input-error');
                confirmPassword.classList.add('input-success');
            } else {
                confirmMsg.textContent = '';
                confirmPassword.classList.remove('input-error', 'input-success');
            }
            updateProgress();
        });
    }

    // ========== FORM PROGRESS ==========
    function updateProgress() {
        const fields = ['registerName', 'registerUsername', 'registerEmail', 'registerPassword', 'confirmPassword'];
        let filled = 0;
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.value.trim()) filled++;
        });
        const role = document.querySelector('input[name="role"]:checked');
        if (role) filled++;
        const terms = document.getElementById('agreeTerms');
        if (terms && terms.checked) filled++;

        const total = fields.length + 2; // +role +terms
        const pct = Math.round((filled / total) * 100);
        const bar = document.getElementById('formProgressBar');
        const text = document.getElementById('formProgressText');
        if (bar) bar.style.width = pct + '%';
        if (text) text.textContent = pct + '% Complete';
    }

    // Listen to all register form inputs for progress
    const regInputs = document.querySelectorAll('#registerForm input, #registerForm select');
    regInputs.forEach(input => input.addEventListener('input', updateProgress));
    regInputs.forEach(input => input.addEventListener('change', updateProgress));

    // ========== EMAIL VALIDATION ==========
    const regEmail = document.getElementById('registerEmail');
    const emailMsg = document.getElementById('emailMsg');
    if (regEmail) {
        regEmail.addEventListener('blur', () => {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (regEmail.value && !re.test(regEmail.value)) {
                emailMsg.textContent = 'Please enter a valid email';
                emailMsg.className = 'validation-msg error';
                regEmail.classList.add('input-error');
            } else if (regEmail.value) {
                emailMsg.textContent = 'Looks good ✓';
                emailMsg.className = 'validation-msg success';
                regEmail.classList.remove('input-error');
                regEmail.classList.add('input-success');
            } else {
                emailMsg.textContent = '';
                regEmail.classList.remove('input-error', 'input-success');
            }
        });
    }

    // ========== LOGIN FORM SUBMIT ==========
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const btn = document.getElementById('loginBtn');

            if (!email || !password) { showToast('Please fill in all fields.', 'error'); return; }

            btn.classList.add('loading');
            btn.disabled = true;

            try {
                const res = await fetch(`${API}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                localStorage.setItem('jwt_token', data.token);
                localStorage.setItem('user_data', JSON.stringify(data.user));
                showToast('Login successful! Redirecting...', 'success');

                setTimeout(() => {
                    if (data.user.role === 'teacher') {
                        window.location.href = '../dashboard/teacher-dashboard.html';
                    } else if (data.user.role === 'admin') {
                        window.location.href = '../admin/admin.html';
                    } else {
                        window.location.href = '../dashboard/student-dashboard.html';
                    }
                }, 1200);
            } catch (err) {
                showToast(err.message || 'Login failed.', 'error');
            } finally {
                btn.classList.remove('loading');
                btn.disabled = false;
            }
        });
    }

    // ========== REGISTER FORM SUBMIT ==========
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value.trim();
            const username = document.getElementById('registerUsername').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const college = document.getElementById('registerCollege').value.trim();
            const department = document.getElementById('registerDept').value;
            const semester = document.getElementById('registerSemester').value;
            const password = document.getElementById('registerPassword').value;
            const confirm = document.getElementById('confirmPassword').value;
            const role = document.querySelector('input[name="role"]:checked')?.value;
            const terms = document.getElementById('agreeTerms').checked;
            const btn = document.getElementById('registerBtn');

            // Validation
            if (!name || !username || !email || !password || !confirm) {
                showToast('Please fill in all required fields.', 'error'); return;
            }
            const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRe.test(email)) { showToast('Please enter a valid email.', 'error'); return; }
            if (password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
            if (password !== confirm) { showToast('Passwords do not match.', 'error'); return; }
            if (!terms) { showToast('Please agree to Terms & Conditions.', 'error'); return; }

            btn.classList.add('loading');
            btn.disabled = true;

            try {
                const res = await fetch(`${API}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, role, username, college, department, semester })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                // Show success modal
                const modal = document.getElementById('successModal');
                if (modal) modal.classList.add('active');

            } catch (err) {
                showToast(err.message || 'Registration failed.', 'error');
            } finally {
                btn.classList.remove('loading');
                btn.disabled = false;
            }
        });
    }

    // ========== SUCCESS MODAL ==========
    const modalLoginBtn = document.getElementById('modalLoginBtn');
    if (modalLoginBtn) {
        modalLoginBtn.addEventListener('click', () => {
            document.getElementById('successModal').classList.remove('active');
            switchTab('login');
            registerForm.reset();

            // Reset progress
            const bar = document.getElementById('formProgressBar');
            const text = document.getElementById('formProgressText');
            if (bar) bar.style.width = '0%';
            if (text) text.textContent = '0% Complete';
            // Reset strength
            strengthBars.forEach(b => b.className = 'strength-bar');
            if (strengthText) strengthText.textContent = '';
            if (confirmMsg) { confirmMsg.textContent = ''; }
        });
    }

    // ========== PARTICLES ==========
    const authParticles = document.getElementById('authParticles');
    if (authParticles) {
        for (let i = 0; i < 20; i++) {
            const p = document.createElement('div');
            p.classList.add('particle');
            p.style.left = Math.random() * 100 + '%';
            p.style.animationDuration = (Math.random() * 15 + 10) + 's';
            p.style.animationDelay = (Math.random() * 10) + 's';
            p.style.width = p.style.height = (Math.random() * 3 + 1) + 'px';
            if (Math.random() > 0.5) p.style.background = 'rgba(78,205,196,0.4)';
            authParticles.appendChild(p);
        }
    }

    // ========== NAVBAR SCROLL (for auth page) ==========
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.classList.add('scrolled'); // Always solid on auth page
    }
});
