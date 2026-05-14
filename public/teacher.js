// =============================================
// QUIZLY — Teacher Panel Logic
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    const API = 'http://localhost:5000/api';
    const token = localStorage.getItem('jwt_token');
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    if (!token || userData.role !== 'teacher') { window.location.href = 'auth.html'; return; }

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('userName', userData.name?.split(' ')[0] || '');
    setEl('avatarInitials', (userData.name || 'T')[0].toUpperCase());
    setEl('profInit', (userData.name || 'T')[0].toUpperCase());
    setEl('profName', userData.name || 'Teacher');
    setEl('profEmail', userData.email || '');
    const dateEl = document.getElementById('topbarDate');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Load full profile from API
    async function loadProfile() {
        try {
            const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
            const res = await fetch(`${API}/profile`, { headers });
            if (!res.ok) return;
            const p = await res.json();
            setEl('profName', p.name || 'Teacher');
            setEl('profEmail', p.email || '');
            setEl('profUsername', p.username || '—');
            setEl('profCollege', p.college || '—');
            setEl('profDept', p.department || '—');
            setEl('profJoined', p.joined ? new Date(p.joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—');
        } catch (e) { console.error('Profile load failed'); }
    }
    loadProfile();

    // Sidebar nav
    const pages = document.querySelectorAll('.dash-page');
    const links = document.querySelectorAll('.sidebar-link[data-page]');
    function switchPage(page) {
        pages.forEach(p => p.classList.remove('active'));
        links.forEach(l => l.classList.remove('active'));
        document.getElementById('page-' + page)?.classList.add('active');
        document.querySelector(`.sidebar-link[data-page="${page}"]`)?.classList.add('active');
        document.getElementById('sidebar')?.classList.remove('open');
    }
    links.forEach(l => l.addEventListener('click', e => { e.preventDefault(); switchPage(l.dataset.page); }));
    document.getElementById('menuToggle')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('open'));
    document.getElementById('sidebarClose')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.remove('open'));
    document.getElementById('logoutBtn')?.addEventListener('click', () => { localStorage.clear(); window.location.href = 'auth.html'; });

    async function apiFetch(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers };
        const res = await fetch(`${API}${endpoint}`, { ...options, headers });
        if (res.status === 401 || res.status === 403) { localStorage.clear(); window.location.href = 'auth.html'; return null; }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    }

    // ========== LOAD STATS ==========
    async function loadStats() {
        try {
            const s = await apiFetch('/teacher/stats');
            setEl('statQuizzes', s.totalQuizzes);
            setEl('statAttempts', s.totalAttempts);
            setEl('statAvg', s.avgScore + '%');
            setEl('statQCount', s.totalQuestions);
        } catch (e) {}
    }

    // ========== LOAD QUIZZES ==========
    async function loadQuizzes() {
        try {
            const quizzes = await apiFetch('/teacher/quizzes') || [];
            // Recent
            const recent = document.getElementById('recentQuizzes');
            if (recent && quizzes.length > 0) {
                recent.innerHTML = quizzes.slice(0, 5).map(q => `
                    <div class="activity-item">
                        <div class="activity-dot" style="background:var(--primary);"></div>
                        <div class="activity-info"><h5>${q.title}</h5><span>${q.subject} · ${q.question_count} Q's · ${q.attempt_count} attempts</span></div>
                        <span class="activity-score" style="color:${q.is_active ? 'var(--accent)' : 'var(--secondary)'};">${q.is_active ? 'Active' : 'Inactive'}</span>
                    </div>`).join('');
            }
            // Manage table
            const tbody = document.getElementById('manageBody');
            if (tbody && quizzes.length > 0) {
                tbody.innerHTML = quizzes.map(q => `<tr>
                    <td><strong>${q.title}</strong></td><td>${q.subject}</td>
                    <td><span class="quiz-card-badge badge-${q.difficulty}">${q.difficulty}</span></td>
                    <td>${q.question_count}</td><td>${q.attempt_count}</td>
                    <td><span class="${q.is_active ? 'status-pass' : 'status-fail'}">${q.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td><button class="btn btn-outline btn-sm" onclick="deleteQuiz(${q.quiz_id})" style="padding:6px 12px;font-size:0.75rem;"><i class="fas fa-trash"></i></button></td>
                </tr>`).join('');
            }
        } catch (e) {}
    }

    window.deleteQuiz = async (id) => {
        if (!confirm('Delete this quiz? This cannot be undone.')) return;
        try { await apiFetch(`/quizzes/${id}`, { method: 'DELETE' }); showToast('Quiz deleted!', 'success'); loadQuizzes(); loadStats(); } catch (e) { showToast(e.message, 'error'); }
    };

    // ========== CREATE QUIZ ==========
    let createdQuizId = null;
    document.getElementById('cqNegative')?.addEventListener('change', e => {
        document.getElementById('negValueGroup').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('createQuizForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('createQuizBtn');
        btn.classList.add('loading'); btn.disabled = true;
        try {
            const data = await apiFetch('/quizzes/create', {
                method: 'POST',
                body: JSON.stringify({
                    title: document.getElementById('cqTitle').value, subject: document.getElementById('cqSubject').value,
                    difficulty: document.getElementById('cqDifficulty').value, category: document.getElementById('cqCategory').value,
                    timer: parseInt(document.getElementById('cqTimer').value), total_marks: parseInt(document.getElementById('cqMarks').value),
                    instructions: document.getElementById('cqInstructions').value,
                    negative_marking: document.getElementById('cqNegative').checked,
                    negative_mark_value: parseFloat(document.getElementById('cqNegValue').value) || 0,
                    randomize_questions: document.getElementById('cqRandomize').checked
                })
            });
            createdQuizId = data.quiz_id;
            setEl('questionsQuizTitle', document.getElementById('cqTitle').value);
            document.getElementById('questionsSection').style.display = 'block';
            document.getElementById('questionsSection').scrollIntoView({ behavior: 'smooth' });
            showToast('Quiz created! Now add questions.', 'success');
            addQuestionBlock();
        } catch (e) { showToast(e.message, 'error'); }
        finally { btn.classList.remove('loading'); btn.disabled = false; }
    });

    // ========== QUESTION BUILDER ==========
    let qCount = 0;
    document.getElementById('addQuestionBtn')?.addEventListener('click', addQuestionBlock);

    function addQuestionBlock() {
        qCount++;
        const container = document.getElementById('questionsContainer');
        const div = document.createElement('div');
        div.className = 'question-block';
        div.id = `qblock-${qCount}`;
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <span style="font-weight:700;color:var(--primary);">Question ${qCount}</span>
                <button type="button" class="btn btn-outline btn-sm" onclick="this.closest('.question-block').remove()" style="padding:4px 10px;font-size:0.75rem;color:var(--secondary);border-color:var(--secondary);"><i class="fas fa-trash"></i></button>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:3;"><label>Question Text</label><textarea class="form-control q-text" rows="2" placeholder="Enter question..." style="padding:12px;" required></textarea></div>
                <div class="form-group" style="flex:1;"><label>Type</label><select class="form-control q-type"><option value="mcq">MCQ</option><option value="tf">True/False</option></select></div>
            </div>
            <div class="form-row mcq-opts">
                <div class="form-group"><label>Option A</label><input type="text" class="form-control q-opt1" placeholder="Option A"></div>
                <div class="form-group"><label>Option B</label><input type="text" class="form-control q-opt2" placeholder="Option B"></div>
                <div class="form-group"><label>Option C</label><input type="text" class="form-control q-opt3" placeholder="Option C"></div>
                <div class="form-group"><label>Option D</label><input type="text" class="form-control q-opt4" placeholder="Option D"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Correct Answer</label><input type="text" class="form-control q-correct" placeholder="e.g. Option A text" required></div>
                <div class="form-group" style="flex:0.5;"><label>Marks</label><input type="number" class="form-control q-marks" value="1" min="1"></div>
            </div>
            <hr style="border-color:rgba(255,255,255,0.06);margin:16px 0;">`;
        container.appendChild(div);

        // Type toggle
        const typeSelect = div.querySelector('.q-type');
        typeSelect.addEventListener('change', () => {
            const mcqOpts = div.querySelector('.mcq-opts');
            mcqOpts.style.display = typeSelect.value === 'tf' ? 'none' : 'grid';
            if (typeSelect.value === 'tf') div.querySelector('.q-correct').placeholder = 'True or False';
        });
    }

    document.getElementById('publishQuestionsBtn')?.addEventListener('click', async () => {
        const blocks = document.querySelectorAll('.question-block');
        if (blocks.length === 0) { showToast('Add at least one question.', 'error'); return; }

        const questions = [];
        let hasError = false;
        blocks.forEach((b, idx) => {
            const correctAnswer = b.querySelector('.q-correct').value.trim();
            const questionText = b.querySelector('.q-text').value.trim();
            
            if (!questionText) {
                showToast(`Question ${idx + 1}: Question text is required.`, 'error');
                b.querySelector('.q-text').focus();
                hasError = true;
                return;
            }
            if (!correctAnswer) {
                showToast(`Question ${idx + 1}: Correct answer is mandatory!`, 'error');
                b.querySelector('.q-correct').style.borderColor = 'var(--secondary)';
                b.querySelector('.q-correct').focus();
                hasError = true;
                return;
            }
            b.querySelector('.q-correct').style.borderColor = '';
            
            questions.push({
                question_type: b.querySelector('.q-type').value,
                question_text: questionText,
                option1: b.querySelector('.q-opt1')?.value || null,
                option2: b.querySelector('.q-opt2')?.value || null,
                option3: b.querySelector('.q-opt3')?.value || null,
                option4: b.querySelector('.q-opt4')?.value || null,
                correct_answer: correctAnswer,
                marks: parseInt(b.querySelector('.q-marks').value) || 1
            });
        });
        if (hasError) return;

        const btn = document.getElementById('publishQuestionsBtn');
        btn.classList.add('loading'); btn.disabled = true;
        try {
            await apiFetch('/questions/add', { method: 'POST', body: JSON.stringify({ quiz_id: createdQuizId, questions }) });
            showToast('Questions published successfully!', 'success');
            document.getElementById('createQuizForm').reset();
            document.getElementById('questionsSection').style.display = 'none';
            document.getElementById('questionsContainer').innerHTML = '';
            qCount = 0; createdQuizId = null;
            loadStats(); loadQuizzes();
            switchPage('manage');
        } catch (e) { showToast(e.message, 'error'); }
        finally { btn.classList.remove('loading'); btn.disabled = false; }
    });

    // ========== STUDENT RESULTS ==========
    async function loadStudentResults() {
        try {
            const results = await apiFetch('/teacher/student-results') || [];
            const tbody = document.getElementById('studentResultsBody');
            if (tbody && results.length > 0) {
                tbody.innerHTML = results.map(r => {
                    const pass = r.percentage >= 50;
                    return `<tr><td><strong>${r.student_name}</strong></td><td>${r.student_email}</td><td>${r.title}</td>
                        <td>${r.score}/${r.total_marks}</td><td>${r.percentage}%</td>
                        <td>${new Date(r.submitted_at).toLocaleDateString()}</td>
                        <td><span class="${pass ? 'status-pass' : 'status-fail'}">${pass ? 'Pass' : 'Fail'}</span></td></tr>`;
                }).join('');
            }
        } catch (e) {}
    }

    // ========== ANALYTICS ==========
    async function loadAnalytics() {
        try {
            const data = await apiFetch('/teacher/analytics');
            const ts = document.getElementById('topScorers');
            if (ts && data.topScorers?.length > 0) {
                ts.innerHTML = data.topScorers.map((s, i) => `
                    <div class="activity-item"><div class="activity-dot" style="background:${i < 3 ? 'gold' : 'var(--primary)'};"></div>
                    <div class="activity-info"><h5>#${i + 1} ${s.full_name}</h5><span>Best Score</span></div>
                    <span class="activity-score" style="color:var(--accent);">${s.best_score}%</span></div>`).join('');
            }
            const qp = document.getElementById('quizPerf');
            if (qp && data.quizPerformance?.length > 0) {
                qp.innerHTML = data.quizPerformance.map(q => `
                    <div class="activity-item"><div class="activity-dot" style="background:var(--primary);"></div>
                    <div class="activity-info"><h5>${q.title}</h5><span>${q.subject} · ${q.attempts} attempts</span></div>
                    <span class="activity-score">${q.avg_score || 0}%</span></div>`).join('');
            }
            const sp = document.getElementById('subjectPerf');
            if (sp && data.subjectPerformance?.length > 0) {
                sp.innerHTML = data.subjectPerformance.map(s => `
                    <div class="activity-item"><div class="activity-dot" style="background:var(--accent);"></div>
                    <div class="activity-info"><h5>${s.subject}</h5><span>${s.attempts} total attempts</span></div>
                    <span class="activity-score">${s.avg_score}%</span></div>`).join('');
            }
        } catch (e) {}
    }

    // ========== DELETE ACCOUNT ==========
    document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
        const confirmed = confirm('⚠️ WARNING: This will permanently delete your account, ALL quizzes you created, ALL questions, and ALL student attempt data for your quizzes. This CANNOT be undone.\n\nAre you absolutely sure?');
        if (!confirmed) return;
        const doubleConfirm = confirm('Last chance! Click OK to confirm you want to DELETE your account forever.');
        if (!doubleConfirm) return;
        
        try {
            await apiFetch('/account/delete', { method: 'DELETE' });
            localStorage.clear();
            alert('Your account and all associated data have been permanently deleted.');
            window.location.href = 'index.html';
        } catch (err) {
            showToast(err.message || 'Failed to delete account.', 'error');
        }
    });

    // INIT
    loadStats(); loadQuizzes(); loadStudentResults(); loadAnalytics();
});
