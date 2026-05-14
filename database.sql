-- ==========================================
-- QUIZLY — Complete Database Schema
-- ==========================================

CREATE DATABASE IF NOT EXISTS quizly_db;
USE quizly_db;

-- 1. Users Table (Students, Teachers, Admins)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student',
    college_name VARCHAR(255),
    department VARCHAR(100),
    semester INT,
    profile_photo TEXT,
    avatar_color VARCHAR(7) DEFAULT '#6C63FF',
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Quizzes Table
CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    total_marks INT NOT NULL,
    timer INT NOT NULL COMMENT 'Duration in minutes',
    category VARCHAR(100),
    instructions TEXT,
    negative_marking BOOLEAN DEFAULT FALSE,
    negative_mark_value DECIMAL(3,1) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    randomize_questions BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Questions Table
CREATE TABLE IF NOT EXISTS questions (
    question_id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    question_type ENUM('mcq', 'tf', 'short') DEFAULT 'mcq',
    question_text TEXT NOT NULL,
    option1 VARCHAR(500),
    option2 VARCHAR(500),
    option3 VARCHAR(500),
    option4 VARCHAR(500),
    correct_answer VARCHAR(500) NOT NULL,
    marks INT NOT NULL DEFAULT 1,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE
);

-- 4. Quiz Attempts Table
CREATE TABLE IF NOT EXISTS quiz_attempts (
    attempt_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    quiz_id INT NOT NULL,
    score INT DEFAULT 0,
    total_marks INT DEFAULT 0,
    percentage DECIMAL(5,2) DEFAULT 0,
    time_taken INT DEFAULT 0 COMMENT 'Seconds taken',
    status ENUM('in_progress', 'submitted', 'auto_submitted') DEFAULT 'submitted',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE
);

-- 5. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Contact Messages Table
CREATE TABLE IF NOT EXISTS contact_messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    sender_name VARCHAR(255) NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Insert default admin account (password: admin123)
-- Password hash for 'admin123' using bcrypt
INSERT IGNORE INTO users (full_name, email, username, password, role)
VALUES ('Admin', 'admin@quizly.com', 'admin', '$2b$10$NlyO8Moq3zVlksaw2LfB4uhFGqiQq4aLLhOvEuEU8iHzzCdW/al6i', 'admin');
