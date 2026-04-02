-- Sports Event and Tournament Management System
-- MySQL Database Schema for XAMPP
-- Run this file in phpMyAdmin to create the database

CREATE DATABASE IF NOT EXISTS sports_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sports_management;

-- ============================================
-- CAMPUSES
-- ============================================
CREATE TABLE IF NOT EXISTS campuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'sports_coordinator', 'organizer') NOT NULL DEFAULT 'organizer',
  campus VARCHAR(255) DEFAULT '',
  sport VARCHAR(100) DEFAULT NULL,
  assigned_sports JSON DEFAULT NULL,
  assigned_events JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Ensure existing databases are updated to the latest users schema
ALTER TABLE users DROP COLUMN IF EXISTS phone;

-- ============================================
-- TEAMS
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id VARCHAR(500) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  sport VARCHAR(100) NOT NULL,
  campus VARCHAR(255) NOT NULL,
  team_group VARCHAR(100) DEFAULT '',
  logo LONGTEXT DEFAULT NULL,
  lineup_presets JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- PLAYERS
-- ============================================
CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  team VARCHAR(500) NOT NULL,
  position VARCHAR(100) DEFAULT '',
  sport VARCHAR(100) DEFAULT '',
  campus VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- BIG EVENTS (Intramurals)
-- ============================================
CREATE TABLE IF NOT EXISTS big_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  campus VARCHAR(255) NOT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  sports JSON DEFAULT NULL,
  units JSON DEFAULT NULL,
  unit_standings JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- TOURNAMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS tournaments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sport VARCHAR(100) NOT NULL,
  teams JSON DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  format ENUM('single', 'double', 'roundrobin', 'groupknockout') DEFAULT 'single',
  auto_seed TINYINT(1) DEFAULT 1,
  best_of TINYINT DEFAULT 1,
  twice_to_beat TINYINT(1) DEFAULT 0,
  campus VARCHAR(255) DEFAULT '',
  big_event_id VARCHAR(100) DEFAULT NULL,
  bracket JSON DEFAULT NULL,
  round_robin JSON DEFAULT NULL,
  group_stage JSON DEFAULT NULL,
  grand_final JSON DEFAULT NULL,
  winner VARCHAR(500) DEFAULT NULL,
  status VARCHAR(50) DEFAULT 'upcoming',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- MATCHES (Scheduled Games)
-- ============================================
CREATE TABLE IF NOT EXISTS matches_table (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_a VARCHAR(500) DEFAULT NULL,
  team_b VARCHAR(500) DEFAULT NULL,
  score_a INT DEFAULT 0,
  score_b INT DEFAULT 0,
  match_date DATE DEFAULT NULL,
  match_time VARCHAR(10) DEFAULT NULL,
  end_time VARCHAR(10) DEFAULT NULL,
  court VARCHAR(255) DEFAULT '',
  status VARCHAR(50) DEFAULT 'scheduled',
  sport VARCHAR(100) DEFAULT '',
  tournament VARCHAR(255) DEFAULT '',
  campus VARCHAR(255) DEFAULT '',
  played TINYINT(1) DEFAULT 0,
  winner VARCHAR(500) DEFAULT NULL,
  lineups JSON DEFAULT NULL,
  reschedule_history JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- ANNOUNCEMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  announcement_id BIGINT NOT NULL UNIQUE,
  user VARCHAR(100) NOT NULL,
  role VARCHAR(50) DEFAULT '',
  campus VARCHAR(255) DEFAULT '',
  text TEXT NOT NULL,
  time VARCHAR(100) DEFAULT '',
  event_id VARCHAR(255) DEFAULT '',
  event_name VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id VARCHAR(100) NOT NULL UNIQUE,
  sender VARCHAR(100) NOT NULL,
  recipient VARCHAR(100) NOT NULL,
  text TEXT NOT NULL,
  time VARCHAR(100) DEFAULT '',
  is_read TINYINT(1) DEFAULT 0,
  broadcast TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- SMS NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS sms_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipient VARCHAR(100) DEFAULT '',
  phone VARCHAR(20) DEFAULT '',
  message TEXT DEFAULT NULL,
  type VARCHAR(50) DEFAULT 'schedule',
  timestamp VARCHAR(100) DEFAULT '',
  is_read TINYINT(1) DEFAULT 0,
  sent TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- SMS SENT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS sms_sent_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) DEFAULT '',
  message TEXT DEFAULT NULL,
  match_id INT DEFAULT NULL,
  sent_at VARCHAR(100) DEFAULT '',
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- SETTINGS (key-value store for misc settings)
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value LONGTEXT DEFAULT NULL
) ENGINE=InnoDB;

-- ============================================
-- DEFAULT DATA
-- ============================================
INSERT INTO campuses (name) VALUES ('Main Campus')
  ON DUPLICATE KEY UPDATE name = name;

INSERT INTO users (username, password, role, campus) VALUES
  ('admin', 'admin123', 'admin', '')
  ON DUPLICATE KEY UPDATE username = username;

INSERT INTO settings (setting_key, setting_value) VALUES ('darkMode', '"light"')
  ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO users (username, password, role, campus, sport, assigned_sports, assigned_events)
VALUES
  ('admin', 'admin123', 'admin', '', NULL, NULL, NULL),
  ('sportscoord1', 'coord123', 'sports_coordinator', 'Main Campus', NULL, '[]', '[]'),
  ('organizer1', 'org123', 'organizer', 'Main Campus', NULL, '[]', '[]')
ON DUPLICATE KEY UPDATE username = username;

INSERT INTO settings (setting_key, setting_value) VALUES ('darkMode', '"light"')
  ON DUPLICATE KEY UPDATE setting_key = setting_key;
