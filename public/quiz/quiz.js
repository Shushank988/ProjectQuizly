// =============================================
// QUIZLY — Quiz Attempt Engine
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    const API = 'http://localhost:5000/api';
    const token = localStorage.getItem('jwt_token');
    if (!token) { window.location.href = '../auth/auth.html'; return; }

    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('quiz_id');
    if (!quizId) { alert('No quiz selected!'); window.location.href = '../dashboard/student-dashboard.html'; return; }

    let questions = [];
    let currentIndex = 0;
    let userAnswers = {};
    let reviewFlags = {};
    let totalSeconds = 0;
    let startTime = Date.now();
    let timerInterval;
    let tabSwitchCount = 0;

    // DOM
    const quizLoading = document.getElementById('quizLoading');
    const questionCard = document.getElementById('questionCard');
    const quizNav = document.getElementById('quizNav');
    const questionText = document.getElementById('questionText');
    const optionsList = document.getElementById('optionsList');
    const questionNumber = document.getElementById('questionNumber');
    const questionMarks = document.getElementById('questionMarks');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const timerDisplay = document.getElementById('timerDisplay');
    const quizTimer = document.getElementById('quizTimer');
    const navGrid = document.getElementById('questionNavGrid');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitQuizBtn = document.getElementById('submitQuizBtn');
    const markReviewBtn = document.getElementById('markReviewBtn');

    // ========== API HELPER ==========
    async function apiFetch(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API}${endpoint}`, { ...options, headers });
        if (res.status === 401 || res.status === 403) {
            window.location.href = '../auth/auth.html'; return null;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    }

    // ========== LOAD QUIZ ==========
    async function loadQuiz() {
        try {
            const data = await apiFetch(`/quiz/${quizId}/attempt`);
            if (!data) return;

            document.getElementById('quizTitle').textContent = data.quiz.title;
            document.getElementById('quizSubject').textContent = data.quiz.subject;
            document.title = `${data.quiz.title} — Quizly`;

            questions = data.questions.map(q => {
                let opts = [];
                if (q.option1) opts.push(q.option1);
                if (q.option2) opts.push(q.option2);
                if (q.option3) opts.push(q.option3);
                if (q.option4) opts.push(q.option4);
                if (opts.length === 0) opts = ['True', 'False'];
                return { id: q.question_id, text: q.question_text, options: opts, marks: q.marks };
            });

            totalSeconds = data.quiz.timer * 60;
            startTime = Date.now();

            // Build nav grid
            buildNavGrid();

            quizLoading.style.display = 'none';
            questionCard.style.display = 'block';
            quizNav.style.display = 'flex';

            renderQuestion();
            startTimer();
        } catch (err) {
            quizLoading.innerHTML = '<i class="fas fa-exclamation-circle" style="color:var(--secondary);font-size:2.5rem;display:block;margin-bottom:16px;"></i><p>Failed to load quiz. Please try again.</p>';
        }
    }

    // ========== TIMER ==========
    function startTimer() {
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            totalSeconds--;
            updateTimerDisplay();
            if (totalSeconds <= 60) quizTimer.classList.add('warning');
            if (totalSeconds <= 0) {
                clearInterval(timerInterval);
                document.getElementById('timeUpModal')?.classList.add('active');
                setTimeout(() => submitQuiz(), 2000);
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // ========== RENDER QUESTION ==========
    function renderQuestion() {
        const q = questions[currentIndex];
        const letters = ['A', 'B', 'C', 'D'];

        questionNumber.textContent = `Q${currentIndex + 1}`;
        questionMarks.textContent = `${q.marks} mark${q.marks > 1 ? 's' : ''}`;
        questionText.textContent = q.text;

        optionsList.innerHTML = q.options.map((opt, i) => {
            const selected = userAnswers[q.id] === opt ? 'selected' : '';
            return `<div class="option-item ${selected}" data-value="${opt}" onclick="selectOption(this, ${q.id})">
                <span class="option-letter">${letters[i] || i + 1}</span>
                <span>${opt}</span>
            </div>`;
        }).join('');

        // Update nav
        prevBtn.disabled = currentIndex === 0;
        if (currentIndex === questions.length - 1) {
            nextBtn.style.display = 'none';
            submitQuizBtn.style.display = 'flex';
        } else {
            nextBtn.style.display = 'flex';
            submitQuizBtn.style.display = 'none';
        }

        // Update mark review button
        markReviewBtn.innerHTML = reviewFlags[q.id]
            ? '<i class="fas fa-flag"></i> Unmark Review'
            : '<i class="fas fa-flag"></i> Mark for Review';

        updateProgress();
        updateNavGrid();
    }

    // ========== SELECT OPTION ==========
    window.selectOption = function(el, qId) {
        document.querySelectorAll('.option-item').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        userAnswers[qId] = el.dataset.value;
        updateProgress();
        updateNavGrid();
    };

    // ========== NAVIGATION ==========
    prevBtn.addEventListener('click', () => { if (currentIndex > 0) { currentIndex--; renderQuestion(); } });
    nextBtn.addEventListener('click', () => { if (currentIndex < questions.length - 1) { currentIndex++; renderQuestion(); } });

    markReviewBtn.addEventListener('click', () => {
        const qId = questions[currentIndex].id;
        reviewFlags[qId] = !reviewFlags[qId];
        renderQuestion();
    });

    // ========== NAV GRID ==========
    function buildNavGrid() {
        navGrid.innerHTML = questions.map((_, i) =>
            `<button class="q-nav-btn" onclick="jumpToQuestion(${i})">${i + 1}</button>`
        ).join('');
    }

    window.jumpToQuestion = function(index) {
        currentIndex = index;
        renderQuestion();
    };

    function updateNavGrid() {
        const btns = navGrid.querySelectorAll('.q-nav-btn');
        btns.forEach((btn, i) => {
            btn.className = 'q-nav-btn';
            const qId = questions[i].id;
            if (i === currentIndex) btn.classList.add('current');
            if (userAnswers[qId]) btn.classList.add('answered');
            if (reviewFlags[qId]) btn.classList.add('review');
        });
    }

    function updateProgress() {
        const answered = Object.keys(userAnswers).length;
        const total = questions.length;
        const pct = Math.round((answered / total) * 100);
        progressFill.style.width = pct + '%';
        progressText.textContent = `${answered} / ${total} answered`;
    }

    // ========== SUBMIT ==========
    submitQuizBtn.addEventListener('click', () => {
        const answered = Object.keys(userAnswers).length;
        const reviewed = Object.keys(reviewFlags).filter(k => reviewFlags[k]).length;
        const unanswered = questions.length - answered;

        const summary = document.getElementById('submitSummary');
        summary.innerHTML = `
            <div class="summary-item"><h4 style="color:var(--accent);">${answered}</h4><p>Answered</p></div>
            <div class="summary-item"><h4 style="color:#FFA36C;">${reviewed}</h4><p>Marked Review</p></div>
            <div class="summary-item"><h4 style="color:var(--secondary);">${unanswered}</h4><p>Unanswered</p></div>
        `;
        document.getElementById('submitModal')?.classList.add('active');
    });

    document.getElementById('cancelSubmit')?.addEventListener('click', () => {
        document.getElementById('submitModal')?.classList.remove('active');
    });

    document.getElementById('confirmSubmit')?.addEventListener('click', () => {
        document.getElementById('submitModal')?.classList.remove('active');
        submitQuiz();
    });

    async function submitQuiz() {
        clearInterval(timerInterval);
        const timeTaken = Math.round((Date.now() - startTime) / 1000);

        const payload = Object.keys(userAnswers).map(qid => ({
            question_id: parseInt(qid),
            selected_answer: userAnswers[qid]
        }));

        try {
            questionCard.style.display = 'none';
            quizNav.style.display = 'none';
            quizLoading.style.display = 'block';
            quizLoading.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:2.5rem;color:var(--primary);display:block;margin-bottom:16px;"></i><p>Submitting your quiz...</p>';

            const result = await apiFetch('/quiz/submit', {
                method: 'POST',
                body: JSON.stringify({ quiz_id: parseInt(quizId), answers: payload, time_taken: timeTaken })
            });

            localStorage.setItem('latest_result', JSON.stringify(result));
            window.location.href = 'quiz-result.html';
        } catch (err) {
            showToast('Failed to submit quiz. Please try again.', 'error');
            questionCard.style.display = 'block';
            quizNav.style.display = 'flex';
            quizLoading.style.display = 'none';
        }
    }

    // ========== ANTI-CHEAT: Tab Switch Detection ==========
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            tabSwitchCount++;
            const banner = document.getElementById('antiCheatBanner');
            if (banner) {
                banner.style.display = 'flex';
                banner.querySelector('span').textContent = `Warning: Tab switch detected (${tabSwitchCount}x)! Stay focused on the quiz.`;
            }
            showToast('⚠️ Tab switching detected!', 'error');
        }
    });

    // ========== KEYBOARD NAV ==========
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' && currentIndex < questions.length - 1) { currentIndex++; renderQuestion(); }
        if (e.key === 'ArrowLeft' && currentIndex > 0) { currentIndex--; renderQuestion(); }
    });

    // ========== INIT ==========
    loadQuiz();
});
