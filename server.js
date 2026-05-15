// =============================================
// QUIZLY — Complete Backend Server
// =============================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// MIDDLEWARE
// ==========================================
const auth = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided.' });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token.' });
        req.user = user;
        next();
    });
};

const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Access denied.' });
    next();
};

// ==========================================
// AUTH APIs
// ==========================================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, role, username, college, department, semester } = req.body;
        if (!name || !email || !password || !role) return res.status(400).json({ error: 'All required fields must be filled.' });

        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) return res.status(409).json({ error: 'Email already registered.' });

        const hashed = await bcrypt.hash(password, 10);
        const colors = ['#6C63FF','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFA36C','#DDA0DD'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        const [result] = await db.query(
            'INSERT INTO users (full_name, email, username, password, role, college_name, department, semester, avatar_color) VALUES (?,?,?,?,?,?,?,?,?)',
            [name, email, username || null, hashed, role, college || null, department || null, semester || null, color]
        );
        res.status(201).json({ message: 'Registration successful!', userId: result.insertId });
    } catch (err) {
        console.error('Register:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials.' });

        const user = users[0];
        if (user.is_blocked) return res.status(403).json({ error: 'Account is blocked. Contact admin.' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials.' });

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({
            message: 'Login successful!', token,
            user: {
                id: user.id, name: user.full_name, email: user.email, role: user.role,
                avatar_color: user.avatar_color, username: user.username,
                college: user.college_name, department: user.department, semester: user.semester
            }
        });
    } catch (err) {
        console.error('Login:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ==========================================
// PROFILE API
// ==========================================
app.get('/api/profile', auth, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, full_name, email, username, role, college_name, department, semester, avatar_color, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        if (users.length === 0) return res.status(404).json({ error: 'User not found.' });
        const u = users[0];
        res.json({
            id: u.id, name: u.full_name, email: u.email, username: u.username, role: u.role,
            college: u.college_name, department: u.department, semester: u.semester,
            avatar_color: u.avatar_color, joined: u.created_at
        });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// ==========================================
// STUDENT APIs
// ==========================================
app.get('/api/student/quizzes', auth, requireRole('student'), async (req, res) => {
    try {
        const [quizzes] = await db.query(
            `SELECT q.*, u.full_name as teacher_name,
                (SELECT COUNT(*) FROM questions WHERE quiz_id = q.quiz_id) as question_count
             FROM quizzes q JOIN users u ON q.teacher_id = u.id
             WHERE q.is_active = TRUE ORDER BY q.created_at DESC`
        );
        const [attempted] = await db.query('SELECT quiz_id FROM quiz_attempts WHERE student_id = ?', [req.user.id]);
        const attemptedIds = attempted.map(r => r.quiz_id);
        res.json(quizzes.map(q => ({ ...q, attempted: attemptedIds.includes(q.quiz_id) })));
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.get('/api/quiz/:quiz_id/attempt', auth, requireRole('student'), async (req, res) => {
    try {
        const [questions] = await db.query(
            'SELECT question_id, quiz_id, question_type, question_text, option1, option2, option3, option4, marks FROM questions WHERE quiz_id = ?',
            [req.params.quiz_id]
        );
        if (questions.length === 0) return res.status(404).json({ error: 'No questions found.' });

        const [quizData] = await db.query('SELECT title, subject, timer, total_marks, difficulty, randomize_questions, instructions, negative_marking, negative_mark_value FROM quizzes WHERE quiz_id = ?', [req.params.quiz_id]);
        
        let qs = questions;
        if (quizData[0]?.randomize_questions) {
            qs = questions.sort(() => Math.random() - 0.5);
        }
        res.json({ quiz: quizData[0], questions: qs });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.post('/api/quiz/submit', auth, requireRole('student'), async (req, res) => {
    try {
        const { quiz_id, answers, time_taken } = req.body;
        if (!quiz_id || !answers) return res.status(400).json({ error: 'quiz_id and answers required.' });

        const [dbQ] = await db.query('SELECT question_id, question_text, correct_answer, marks FROM questions WHERE quiz_id = ?', [quiz_id]);
        const [quizMeta] = await db.query('SELECT negative_marking, negative_mark_value FROM quizzes WHERE quiz_id = ?', [quiz_id]);
        
        if (dbQ.length === 0) return res.status(404).json({ error: 'Quiz not found.' });

        const negMarking = quizMeta[0]?.negative_marking;
        const negValue = parseFloat(quizMeta[0]?.negative_mark_value) || 0;

        const ansMap = {};
        let totalPossible = 0;
        dbQ.forEach(q => { ansMap[q.question_id] = q; totalPossible += q.marks; });

        let score = 0;
        const breakdown = [];
        for (const a of answers) {
            const ref = ansMap[a.question_id];
            if (!ref) continue;
            const correct = a.selected_answer === ref.correct_answer;
            if (correct) { score += ref.marks; }
            else if (negMarking && a.selected_answer) { score -= negValue; }
            breakdown.push({
                question_id: a.question_id, question_text: ref.question_text,
                selected_answer: a.selected_answer, correct_answer: ref.correct_answer,
                is_correct: correct, marks_awarded: correct ? ref.marks : (negMarking && a.selected_answer ? -negValue : 0), max_marks: ref.marks
            });
        }
        score = Math.max(0, score);
        const percentage = Math.round((score / totalPossible) * 100);

        await db.query(
            'INSERT INTO quiz_attempts (student_id, quiz_id, score, total_marks, percentage, time_taken, status) VALUES (?,?,?,?,?,?,?)',
            [req.user.id, quiz_id, score, totalPossible, percentage, time_taken || 0, 'submitted']
        );

        res.json({ message: 'Quiz submitted!', total_score: score, total_possible_marks: totalPossible, percentage, breakdown });
    } catch (err) { console.error('Submit:', err); res.status(500).json({ error: 'Server error.' }); }
});

app.get('/api/student/results', auth, requireRole('student'), async (req, res) => {
    try {
        const [results] = await db.query(
            `SELECT qa.*, q.title, q.subject, q.difficulty FROM quiz_attempts qa
             JOIN quizzes q ON qa.quiz_id = q.quiz_id WHERE qa.student_id = ? ORDER BY qa.submitted_at DESC`, [req.user.id]
        );
        res.json(results);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.get('/api/leaderboard', auth, async (req, res) => {
    try {
        const [leaders] = await db.query(
            `SELECT u.full_name, u.email, u.avatar_color, AVG(qa.percentage) as avg_score, COUNT(qa.attempt_id) as attempts
             FROM quiz_attempts qa JOIN users u ON qa.student_id = u.id
             GROUP BY qa.student_id ORDER BY avg_score DESC LIMIT 20`
        );
        res.json(leaders);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// ==========================================
// TEACHER APIs
// ==========================================
app.get('/api/teacher/stats', auth, requireRole('teacher'), async (req, res) => {
    try {
        const tid = req.user.id;
        const [[{qc}]] = await db.query('SELECT COUNT(*) as qc FROM quizzes WHERE teacher_id = ?', [tid]);
        const [[{ac}]] = await db.query('SELECT COUNT(*) as ac FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id=q.quiz_id WHERE q.teacher_id=?', [tid]);
        const [[{avg}]] = await db.query('SELECT ROUND(AVG(qa.percentage),1) as avg FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id=q.quiz_id WHERE q.teacher_id=?', [tid]);
        const [[{qcount}]] = await db.query('SELECT COUNT(*) as qcount FROM questions qs JOIN quizzes q ON qs.quiz_id=q.quiz_id WHERE q.teacher_id=?', [tid]);
        res.json({ totalQuizzes: qc, totalAttempts: ac, avgScore: avg || 0, totalQuestions: qcount });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.post('/api/quizzes/create', auth, requireRole('teacher'), async (req, res) => {
    try {
        const { title, subject, difficulty, timer, total_marks, category, instructions, negative_marking, negative_mark_value, randomize_questions } = req.body;
        if (!title || !subject || !timer || !total_marks) return res.status(400).json({ error: 'Required fields missing.' });

        const [result] = await db.query(
            'INSERT INTO quizzes (teacher_id, title, subject, difficulty, timer, total_marks, category, instructions, negative_marking, negative_mark_value, randomize_questions) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [req.user.id, title, subject, difficulty||'medium', timer, total_marks, category||null, instructions||null, negative_marking||false, negative_mark_value||0, randomize_questions||false]
        );
        res.status(201).json({ message: 'Quiz created!', quiz_id: result.insertId });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.put('/api/quizzes/:id', auth, requireRole('teacher'), async (req, res) => {
    try {
        const { title, subject, difficulty, timer, total_marks, category, instructions, negative_marking, is_active } = req.body;
        await db.query(
            'UPDATE quizzes SET title=?, subject=?, difficulty=?, timer=?, total_marks=?, category=?, instructions=?, negative_marking=?, is_active=? WHERE quiz_id=? AND teacher_id=?',
            [title, subject, difficulty, timer, total_marks, category, instructions, negative_marking, is_active, req.params.id, req.user.id]
        );
        res.json({ message: 'Quiz updated!' });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.delete('/api/quizzes/:id', auth, requireRole('teacher','admin'), async (req, res) => {
    try {
        let r;
        if (req.user.role === 'admin') {
            [r] = await db.query('DELETE FROM quizzes WHERE quiz_id = ?', [req.params.id]);
        } else {
            [r] = await db.query('DELETE FROM quizzes WHERE quiz_id = ? AND teacher_id = ?', [req.params.id, req.user.id]);
        }
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Not found.' });
        res.json({ message: 'Quiz deleted!' });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.get('/api/teacher/quizzes', auth, requireRole('teacher'), async (req, res) => {
    try {
        const [quizzes] = await db.query(
            `SELECT q.*, (SELECT COUNT(*) FROM questions WHERE quiz_id=q.quiz_id) as question_count,
                (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id=q.quiz_id) as attempt_count
             FROM quizzes q WHERE q.teacher_id=? ORDER BY q.created_at DESC`, [req.user.id]
        );
        res.json(quizzes);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.post('/api/questions/add', auth, requireRole('teacher'), async (req, res) => {
    try {
        const { quiz_id, questions } = req.body;
        if (!quiz_id || !questions?.length) return res.status(400).json({ error: 'quiz_id and questions required.' });

        // Validate every question has required fields
        for (let i = 0; i < questions.length; i++) {
            if (!questions[i].question_text?.trim()) return res.status(400).json({ error: `Question ${i + 1}: Question text is required.` });
            if (!questions[i].correct_answer?.trim()) return res.status(400).json({ error: `Question ${i + 1}: Correct answer is mandatory.` });
        }

        const conn = await db.getConnection();
        await conn.beginTransaction();
        try {
            for (const q of questions) {
                await conn.query(
                    'INSERT INTO questions (quiz_id, question_type, question_text, option1, option2, option3, option4, correct_answer, marks) VALUES (?,?,?,?,?,?,?,?,?)',
                    [quiz_id, q.question_type||'mcq', q.question_text, q.option1||null, q.option2||null, q.option3||null, q.option4||null, q.correct_answer, q.marks||1]
                );
            }
            await conn.commit();
            res.status(201).json({ message: `${questions.length} questions added!` });
        } catch (e) { await conn.rollback(); throw e; }
        finally { conn.release(); }
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.put('/api/questions/:id', auth, requireRole('teacher'), async (req, res) => {
    try {
        const { question_text, option1, option2, option3, option4, correct_answer, marks, question_type } = req.body;
        await db.query(
            'UPDATE questions SET question_type=?, question_text=?, option1=?, option2=?, option3=?, option4=?, correct_answer=?, marks=? WHERE question_id=?',
            [question_type||'mcq', question_text, option1, option2, option3, option4, correct_answer, marks, req.params.id]
        );
        res.json({ message: 'Question updated!' });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.delete('/api/questions/:id', auth, requireRole('teacher','admin'), async (req, res) => {
    try {
        await db.query('DELETE FROM questions WHERE question_id = ?', [req.params.id]);
        res.json({ message: 'Question deleted!' });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.get('/api/quiz/:quiz_id/questions', auth, requireRole('teacher'), async (req, res) => {
    try {
        const [qs] = await db.query('SELECT * FROM questions WHERE quiz_id = ?', [req.params.quiz_id]);
        res.json(qs);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.get('/api/teacher/student-results', auth, requireRole('teacher'), async (req, res) => {
    try {
        const [results] = await db.query(
            `SELECT qa.*, q.title, q.subject, u.full_name as student_name, u.email as student_email
             FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id=q.quiz_id JOIN users u ON qa.student_id=u.id
             WHERE q.teacher_id=? ORDER BY qa.submitted_at DESC`, [req.user.id]
        );
        res.json(results);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.get('/api/teacher/analytics', auth, requireRole('teacher'), async (req, res) => {
    try {
        const tid = req.user.id;
        const [topScorers] = await db.query(
            `SELECT u.full_name, MAX(qa.percentage) as best_score FROM quiz_attempts qa
             JOIN quizzes q ON qa.quiz_id=q.quiz_id JOIN users u ON qa.student_id=u.id
             WHERE q.teacher_id=? GROUP BY qa.student_id ORDER BY best_score DESC LIMIT 10`, [tid]
        );
        const [quizPerf] = await db.query(
            `SELECT q.title, q.subject, COUNT(qa.attempt_id) as attempts, ROUND(AVG(qa.percentage),1) as avg_score
             FROM quizzes q LEFT JOIN quiz_attempts qa ON q.quiz_id=qa.quiz_id
             WHERE q.teacher_id=? GROUP BY q.quiz_id ORDER BY q.created_at DESC`, [tid]
        );
        const [subjectPerf] = await db.query(
            `SELECT q.subject, ROUND(AVG(qa.percentage),1) as avg_score, COUNT(qa.attempt_id) as attempts
             FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id=q.quiz_id
             WHERE q.teacher_id=? GROUP BY q.subject`, [tid]
        );
        res.json({ topScorers, quizPerformance: quizPerf, subjectPerformance: subjectPerf });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// ==========================================
// ADMIN APIs
// ==========================================
app.get('/api/admin/stats', auth, requireRole('admin'), async (req, res) => {
    try {
        const [[{students}]] = await db.query("SELECT COUNT(*) as students FROM users WHERE role='student'");
        const [[{teachers}]] = await db.query("SELECT COUNT(*) as teachers FROM users WHERE role='teacher'");
        const [[{quizzes}]] = await db.query("SELECT COUNT(*) as quizzes FROM quizzes");
        const [[{attempts}]] = await db.query("SELECT COUNT(*) as attempts FROM quiz_attempts");
        const [[{avg}]] = await db.query("SELECT ROUND(AVG(percentage),1) as avg FROM quiz_attempts");
        res.json({ students, teachers, quizzes, attempts, avgScore: avg || 0 });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.get('/api/admin/users', auth, requireRole('admin'), async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, full_name, email, username, role, college_name, department, is_blocked, created_at FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.delete('/api/admin/users/:id', auth, requireRole('admin'), async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ? AND role != ?', [req.params.id, 'admin']);
        res.json({ message: 'User deleted.' });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.put('/api/admin/users/:id/block', auth, requireRole('admin'), async (req, res) => {
    try {
        const { blocked } = req.body;
        await db.query('UPDATE users SET is_blocked = ? WHERE id = ?', [blocked, req.params.id]);
        res.json({ message: blocked ? 'User blocked.' : 'User unblocked.' });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.get('/api/admin/quizzes', auth, requireRole('admin'), async (req, res) => {
    try {
        const [quizzes] = await db.query(
            `SELECT q.*, u.full_name as teacher_name,
                (SELECT COUNT(*) FROM questions WHERE quiz_id=q.quiz_id) as question_count,
                (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id=q.quiz_id) as attempt_count
             FROM quizzes q JOIN users u ON q.teacher_id=u.id ORDER BY q.created_at DESC`
        );
        res.json(quizzes);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.get('/api/admin/analytics', auth, requireRole('admin'), async (req, res) => {
    try {
        const [monthly] = await db.query(
            `SELECT DATE_FORMAT(submitted_at, '%Y-%m') as month, COUNT(*) as attempts, ROUND(AVG(percentage),1) as avg_score
             FROM quiz_attempts GROUP BY month ORDER BY month DESC LIMIT 12`
        );
        const [topStudents] = await db.query(
            `SELECT u.full_name, u.email, ROUND(AVG(qa.percentage),1) as avg_score, COUNT(qa.attempt_id) as total_attempts
             FROM quiz_attempts qa JOIN users u ON qa.student_id=u.id GROUP BY qa.student_id ORDER BY avg_score DESC LIMIT 10`
        );
        const [topTeachers] = await db.query(
            `SELECT u.full_name, COUNT(q.quiz_id) as quizzes_created,
                (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.quiz_id IN (SELECT quiz_id FROM quizzes WHERE teacher_id=u.id)) as total_attempts
             FROM users u LEFT JOIN quizzes q ON u.id=q.teacher_id WHERE u.role='teacher' GROUP BY u.id ORDER BY quizzes_created DESC LIMIT 10`
        );
        res.json({ monthlyStats: monthly, topStudents, topTeachers });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// ==========================================
// SELF-DELETE ACCOUNT
// ==========================================
app.delete('/api/account/delete', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        if (req.user.role === 'admin') return res.status(403).json({ error: 'Admin accounts cannot be self-deleted.' });

        // CASCADE is configured in DB schema, so deleting user will auto-remove:
        // - All quizzes they created (if teacher) → which cascades their questions & attempts
        // - All quiz_attempts they made (if student)
        // - All notifications
        const [result] = await db.query('DELETE FROM users WHERE id = ?', [userId]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Account not found.' });

        res.json({ message: 'Account and all associated data deleted permanently.' });
    } catch (err) {
        console.error('Account Delete:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ==========================================
// PUBLIC APIs
// ==========================================
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        if (!name || !email || !message) return res.status(400).json({ error: 'All fields are required.' });

        await db.query(
            'INSERT INTO contact_messages (sender_name, sender_email, message) VALUES (?, ?, ?)',
            [name, email, message]
        );
        res.status(200).json({ message: 'Message sent successfully!' });
    } catch (err) {
        console.error('Contact Form Error:', err);
        res.status(500).json({ error: 'Failed to send message.' });
    }
});

// Admin: Get contact messages
app.get('/api/admin/messages', auth, requireRole('admin'), async (req, res) => {
    try {
        const [messages] = await db.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
        res.json(messages);
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.delete('/api/admin/messages/:id', auth, requireRole('admin'), async (req, res) => {
    try {
        await db.query('DELETE FROM contact_messages WHERE message_id = ?', [req.params.id]);
        res.json({ message: 'Message deleted.' });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

// ==========================================
// SPA FALLBACK
// ==========================================
app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        next();
    }
});

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        // Auto-configure Admin Account from .env
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPass = process.env.ADMIN_PASSWORD;
        
        if (adminEmail && adminPass) {
            const hash = await bcrypt.hash(adminPass, 10);
            const [existing] = await db.query('SELECT id FROM users WHERE role = "admin"');
            
            if (existing.length === 0) {
                await db.query(
                    'INSERT INTO users (full_name, email, username, password, role) VALUES (?, ?, ?, ?, ?)',
                    ['System Admin', adminEmail, 'admin', hash, 'admin']
                );
                console.log(`🔐 Admin account created: ${adminEmail}`);
            } else {
                await db.query(
                    'UPDATE users SET email = ?, password = ? WHERE role = "admin"',
                    [adminEmail, hash]
                );
                console.log(`🔐 Admin account updated: ${adminEmail}`);
            }
        }
        
        app.listen(PORT, () => console.log(`🚀 Quizly server running at http://localhost:${PORT}`));
    } catch (err) {
        console.error('Failed to start server:', err);
    }
}

startServer();
