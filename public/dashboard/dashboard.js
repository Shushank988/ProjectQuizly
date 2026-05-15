// =============================================
// QUIZLY — Student Dashboard Logic
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    const API = 'http://localhost:5000/api';
    const token = localStorage.getItem('jwt_token');
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');

    // Redirect if not logged in
    if (!token) { window.location.href = '../auth/auth.html'; return; }

    // ========== POPULATE USER DATA ==========
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('userName', userData.name?.split(' ')[0] || 'Student');
    
    const dicebearUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userData.email || userData.name || 'guest')}`;
    const topAvatar = document.getElementById('topbarAvatar');
    if (topAvatar) topAvatar.innerHTML = `<img src="${dicebearUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;background:var(--primary);">`;
    
    const profAvatar = document.getElementById('profileAvatar');
    if (profAvatar) profAvatar.innerHTML = `<img src="${dicebearUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;background:var(--primary);">`;
    
    setEl('profileName', userData.name || 'Student');
    setEl('profileEmail', userData.email || '');

    // Load full profile from API
    async function loadProfile() {
        try {
            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
            const res = await fetch(`${API}/profile`, { headers });
            if (!res.ok) return;
            const p = await res.json();
            setEl('profileName', p.name || 'Student');
            setEl('profileEmail', p.email || '');
            setEl('profileUsername', p.username || '—');
            setEl('profileCollege', p.college || '—');
            setEl('profileDept', p.department || '—');
            setEl('profileSem', p.semester || '—');
            setEl('profileJoined', p.joined ? new Date(p.joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—');
        } catch (e) { console.error('Profile load failed'); }
    }
    loadProfile();

    // Date
    const dateEl = document.getElementById('topbarDate');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // ========== SIDEBAR NAVIGATION ==========
    const sidebarLinks = document.querySelectorAll('.sidebar-link[data-page]');
    const pages = document.querySelectorAll('.dash-page');

    function switchPage(page) {
        pages.forEach(p => p.classList.remove('active'));
        sidebarLinks.forEach(l => l.classList.remove('active'));
        const target = document.getElementById('page-' + page);
        const link = document.querySelector(`.sidebar-link[data-page="${page}"]`);
        if (target) target.classList.add('active');
        if (link) link.classList.add('active');
        // Close mobile sidebar
        document.getElementById('sidebar')?.classList.remove('open');
    }

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage(link.dataset.page);
        });
    });

    // Mobile sidebar
    const menuToggle = document.getElementById('menuToggle');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle) menuToggle.addEventListener('click', () => sidebar?.classList.toggle('open'));
    if (sidebarClose) sidebarClose.addEventListener('click', () => sidebar?.classList.remove('open'));

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user_data');
        window.location.href = '../auth/auth.html';
    });

    // ========== NOTIFICATIONS ==========
    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    
    notifBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown?.classList.toggle('open');
        // Hide the red dot when opened
        const dot = document.getElementById('notifDot');
        if (dot) dot.style.display = 'none';
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.notif-wrapper')) {
            notifDropdown?.classList.remove('open');
        }
    });

    document.getElementById('markAllRead')?.addEventListener('click', () => {
        document.querySelectorAll('.notif-item.unread').forEach(n => n.classList.remove('unread'));
    });

    function populateNotifications(results) {
        const list = document.getElementById('notifList');
        const dot = document.getElementById('notifDot');
        if (!list) return;
        
        if (!results || results.length === 0) {
            list.innerHTML = '<div class="empty-state" style="padding:20px;"><i class="fas fa-bell-slash"></i><p>No notifications yet</p></div>';
            return;
        }
        
        // Show dot if there are recent results
        if (dot) dot.style.display = 'block';
        
        list.innerHTML = results.slice(0, 8).map(r => {
            const pct = Math.round((r.score / r.total_marks) * 100);
            const pass = pct >= 50;
            const icon = pass ? 'check-circle' : 'times-circle';
            const color = pass ? 'var(--accent)' : 'var(--secondary)';
            const bg = pass ? 'rgba(78,205,196,0.15)' : 'rgba(255,107,107,0.15)';
            const timeAgo = getTimeAgo(new Date(r.submitted_at));
            return `<div class="notif-item unread">
                <div class="notif-item-icon" style="background:${bg};color:${color};"><i class="fas fa-${icon}"></i></div>
                <div class="notif-item-content">
                    <p>You scored <strong>${pct}%</strong> on <strong>${r.title}</strong></p>
                    <span>${timeAgo}</span>
                </div>
            </div>`;
        }).join('');
    }
    
    function getTimeAgo(date) {
        const diff = Math.floor((new Date() - date) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
        if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
        return Math.floor(diff / 86400) + ' days ago';
    }

    // ========== API HELPER ==========
    async function apiFetch(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        try {
            const res = await fetch(`${API}${endpoint}`, { ...options, headers });
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('jwt_token');
                localStorage.removeItem('user_data');
                window.location.href = '../auth/auth.html';
                return null;
            }
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            return data;
        } catch (err) {
            console.error(`API Error: ${endpoint}`, err);
            throw err;
        }
    }

    // ========== LOAD QUIZZES ==========
    let allQuizzes = [];

    async function loadQuizzes() {
        try {
            allQuizzes = await apiFetch('/student/quizzes') || [];
            setEl('statTotal', allQuizzes.length);
            renderQuizGrid(allQuizzes);
            populateSubjectFilter(allQuizzes);
            loadUpcoming(allQuizzes);
        } catch (err) {
            document.getElementById('quizGrid').innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load quizzes</p></div>';
        }
    }

    function renderQuizGrid(quizzes) {
        const grid = document.getElementById('quizGrid');
        if (!grid) return;
        if (quizzes.length === 0) {
            grid.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No quizzes available right now.</p></div>';
            return;
        }
        grid.innerHTML = quizzes.map(q => `
            <div class="quiz-card">
                <div class="quiz-card-header">
                    <span class="quiz-card-badge badge-${q.difficulty || 'medium'}">${q.difficulty || 'Medium'}</span>
                    ${q.attempted ? '<span class="quiz-card-attempted"><i class="fas fa-check-circle"></i> Attempted</span>' : ''}
                </div>
                <div class="quiz-card-body">
                    <h3>${q.title}</h3>
                    <div class="quiz-card-meta">
                        <span class="quiz-meta-item"><i class="fas fa-flask"></i> ${q.subject}</span>
                        <span class="quiz-meta-item"><i class="fas fa-clock"></i> ${q.timer} min</span>
                        <span class="quiz-meta-item"><i class="fas fa-star"></i> ${q.total_marks} marks</span>
                        <span class="quiz-meta-item"><i class="fas fa-list-ol"></i> ${q.question_count || '?'} Q's</span>
                        ${q.teacher_name ? `<span class="quiz-meta-item"><i class="fas fa-user-tie"></i> ${q.teacher_name}</span>` : ''}
                    </div>
                </div>
                <div class="quiz-card-footer">
                    <button class="quiz-start-btn ${q.attempted ? 'attempted' : ''}" onclick="openQuizRules(${q.quiz_id}, '${q.title.replace(/'/g, "\\'")}')">
                        <i class="fas fa-${q.attempted ? 'redo' : 'play'}"></i> ${q.attempted ? 'Retake Quiz' : 'Start Quiz'}
                    </button>
                </div>
            </div>
        `).join('');
    }

    function populateSubjectFilter(quizzes) {
        const select = document.getElementById('filterSubject');
        if (!select) return;
        const subjects = [...new Set(quizzes.map(q => q.subject))];
        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            select.appendChild(opt);
        });
    }

    function loadUpcoming(quizzes) {
        const container = document.getElementById('upcomingQuizzes');
        if (!container) return;
        const pending = quizzes.filter(q => !q.attempted).slice(0, 3);
        if (pending.length === 0) return;
        container.innerHTML = pending.map(q => `
            <div class="activity-item">
                <div class="activity-dot" style="background:var(--primary);"></div>
                <div class="activity-info"><h5>${q.title}</h5><span>${q.subject} · ${q.timer} min · ${q.total_marks} marks</span></div>
                <button class="btn btn-primary btn-sm" onclick="openQuizRules(${q.quiz_id}, '${q.title.replace(/'/g, "\\'")}')">Start</button>
            </div>
        `).join('');
    }

    // ========== FILTERS ==========
    document.getElementById('quizSearch')?.addEventListener('input', applyFilters);
    document.getElementById('filterDifficulty')?.addEventListener('change', applyFilters);
    document.getElementById('filterSubject')?.addEventListener('change', applyFilters);

    function applyFilters() {
        let filtered = [...allQuizzes];
        const search = document.getElementById('quizSearch')?.value.toLowerCase() || '';
        const diff = document.getElementById('filterDifficulty')?.value || '';
        const subj = document.getElementById('filterSubject')?.value || '';
        if (search) filtered = filtered.filter(q => q.title.toLowerCase().includes(search) || q.subject.toLowerCase().includes(search));
        if (diff) filtered = filtered.filter(q => q.difficulty === diff);
        if (subj) filtered = filtered.filter(q => q.subject === subj);
        renderQuizGrid(filtered);
    }

    // ========== LOAD RESULTS ==========
    async function loadResults() {
        try {
            const results = await apiFetch('/student/results') || [];
            setEl('statAttempted', results.length);
            if (results.length > 0) {
                const scores = results.map(r => Math.round((r.score / r.total_marks) * 100));
                setEl('statHighest', Math.max(...scores) + '%');
                setEl('statAvg', Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) + '%');
                renderResults(results);
                renderRecent(results);
                renderChart(results);
                populateNotifications(results);
            }
        } catch (err) { console.error('Failed to load results'); }
    }

    function renderResults(results) {
        const tbody = document.getElementById('resultsBody');
        if (!tbody) return;
        tbody.innerHTML = results.map(r => {
            const pct = Math.round((r.score / r.total_marks) * 100);
            const pass = pct >= 50;
            return `<tr>
                <td><strong>${r.title}</strong></td>
                <td>${r.subject}</td>
                <td>${r.score}/${r.total_marks}</td>
                <td>${pct}%</td>
                <td>${new Date(r.submitted_at).toLocaleDateString()}</td>
                <td><span class="${pass ? 'status-pass' : 'status-fail'}">${pass ? 'Passed' : 'Failed'}</span></td>
            </tr>`;
        }).join('');
    }

    function renderRecent(results) {
        const container = document.getElementById('recentActivity');
        if (!container) return;
        const recent = results.slice(0, 5);
        container.innerHTML = recent.map(r => {
            const pct = Math.round((r.score / r.total_marks) * 100);
            const color = pct >= 50 ? 'var(--accent)' : 'var(--secondary)';
            return `<div class="activity-item">
                <div class="activity-dot" style="background:${color};"></div>
                <div class="activity-info"><h5>${r.title}</h5><span>${new Date(r.submitted_at).toLocaleDateString()}</span></div>
                <span class="activity-score" style="color:${color};">${pct}%</span>
            </div>`;
        }).join('');
    }

    function renderChart(results) {
        const chartEl = document.getElementById('perfChart');
        const chartEmpty = document.getElementById('chartEmpty');
        const barsContainer = document.getElementById('chartBars');
        if (!chartEl || !barsContainer) return;
        const last5 = results.slice(0, 5).reverse();
        if (last5.length === 0) return;
        chartEl.classList.add('visible');
        if (chartEmpty) chartEmpty.style.display = 'none';
        barsContainer.innerHTML = last5.map(r => {
            const pct = Math.round((r.score / r.total_marks) * 100);
            return `<div class="chart-bar-wrap">
                <div class="chart-bar" style="height:${pct}%"></div>
                <span class="chart-bar-label">${pct}%</span>
            </div>`;
        }).join('');
    }

    // ========== LOAD LEADERBOARD ==========
    async function loadLeaderboard() {
        try {
            const leaders = await apiFetch('/leaderboard');
            const tbody = document.getElementById('leaderboardBody');
            if (!tbody) return;
            if (leaders.length === 0) {
                tbody.innerHTML = '<div class="empty-state"><i class="fas fa-medal"></i><p>No leaderboard data yet. Be the first to take a quiz!</p></div>';
                return;
            }
            tbody.innerHTML = `
                <table class="results-table">
                    <thead><tr><th>Rank</th><th>Student</th><th>Average Score</th><th>Quizzes Taken</th></tr></thead>
                    <tbody>
                        ${leaders.map((l, i) => `
                            <tr>
                                <td>
                                    ${i === 0 ? '<i class="fas fa-crown" style="color:gold;font-size:1.2rem;"></i>' : 
                                      i === 1 ? '<i class="fas fa-medal" style="color:silver;font-size:1.2rem;"></i>' : 
                                      i === 2 ? '<i class="fas fa-medal" style="color:#cd7f32;font-size:1.2rem;"></i>' : 
                                      `<strong>#${i+1}</strong>`}
                                </td>
                                <td>
                                    <div style="display:flex;align-items:center;gap:10px;">
                                        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(l.email || l.full_name)}" style="width:32px;height:32px;border-radius:50%;background:${l.avatar_color || 'var(--primary)'};object-fit:cover;">
                                        <strong>${l.full_name}</strong>
                                    </div>
                                </td>
                                <td><span class="status-pass" style="background:var(--bg-glass);">${l.avg_score}%</span></td>
                                <td>${l.attempts}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (err) { console.error('Failed to load leaderboard', err); }
    }

    // ========== QUIZ RULES MODAL ==========
    let selectedQuizId = null;

    window.openQuizRules = function(quizId, title) {
        selectedQuizId = quizId;
        setEl('rulesQuizTitle', title);
        document.getElementById('quizRulesModal')?.classList.add('active');
    };

    document.getElementById('cancelQuizBtn')?.addEventListener('click', () => {
        document.getElementById('quizRulesModal')?.classList.remove('active');
    });

    document.getElementById('startQuizBtn')?.addEventListener('click', () => {
        if (selectedQuizId) {
            window.location.href = `../quiz/attempt-quiz.html?quiz_id=${selectedQuizId}`;
        }
    });

    // ========== GLOBAL SEARCH ==========
    document.getElementById('globalSearch')?.addEventListener('input', (e) => {
        const val = e.target.value;
        const quizSearchEl = document.getElementById('quizSearch');
        if (quizSearchEl) quizSearchEl.value = val;
        
        const quizzesPage = document.getElementById('page-quizzes');
        if (val.trim() && quizzesPage && !quizzesPage.classList.contains('active')) {
            switchPage('quizzes');
        }
        applyFilters();
    });

    // ========== DELETE ACCOUNT ==========
    document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
        const confirmed = confirm('⚠️ WARNING: This will permanently delete your account and ALL your data (results, attempts, everything). This CANNOT be undone.\n\nAre you absolutely sure?');
        if (!confirmed) return;
        const doubleConfirm = confirm('Last chance! Type OK to confirm you want to DELETE your account forever.');
        if (!doubleConfirm) return;
        
        try {
            await apiFetch('/account/delete', { method: 'DELETE' });
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('user_data');
            alert('Your account has been permanently deleted.');
            window.location.href = '../index.html';
        } catch (err) {
            showToast(err.message || 'Failed to delete account.', 'error');
        }
    });

    // ========== INIT ==========
    loadQuizzes();
    loadResults();
    loadLeaderboard();
});
