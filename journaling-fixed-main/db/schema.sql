-- User table: stores registered users
CREATE TABLE IF NOT EXISTS user (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    gender TEXT,
    location TEXT
);

-- Entry table: stores journal entries, each linked to a user
CREATE TABLE IF NOT EXISTS entry (
    entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    mood TEXT,
    date_created TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES user (user_id)
);
