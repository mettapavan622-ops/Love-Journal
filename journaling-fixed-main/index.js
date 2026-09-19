const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const logger = require("./logger");
const authenticateToken = require("./authenticateToken");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serves public/index.html at "/"

const dbPath = process.env.DB_PATH || path.join(__dirname, "db", "journal.db");
const schemaPath = path.join(__dirname, "db", "schema.sql");
const jwtSecret = process.env.JWT_SECRET;
let db = null;

// ---------- 1. Initialize DB and start server ----------
const initializeDbAndServer = async () => {
  try {
    if (!jwtSecret) {
      throw new Error("JWT_SECRET environment variable is required");
    }
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Run schema on startup so tables exist even on a fresh clone
    const schema = fs.readFileSync(schemaPath, "utf8");
    await db.exec(schema);

    const port = Number(process.env.PORT) || 3000;
    app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

app.get("/healthz", (request, response) => {
  response.send("ok");
});

// ================= AUTH ROUTES =================

// ---------- 2. Register User API ----------
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  if (!username || !name || !password) {
    return response.status(400).send("username, name, and password are required");
  }
  const hashedPassword = await bcrypt.hash(password, 10);

  const dbUser = await db.get("SELECT * FROM user WHERE username = ?", username);

  if (dbUser === undefined) {
    const dbResponse = await db.run(
      "INSERT INTO user (username, name, password, gender, location) VALUES (?, ?, ?, ?, ?)",
      username,
      name,
      hashedPassword,
      gender || null,
      location || null,
    );
    response.send(`Created new user with ID: ${dbResponse.lastID}`);
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// ---------- 3. Login User API (returns JWT Token) ----------
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const dbUser = await db.get("SELECT * FROM user WHERE username = ?", username);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: dbUser.username, userId: dbUser.user_id };
      const jwtToken = jwt.sign(payload, jwtSecret);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

// ================= JOURNAL ENTRY ROUTES =================
// All routes below are protected: authenticateToken runs first and
// attaches request.userId, so each user only ever sees their own entries.

// ---------- 4. Get Entries API (with filtering, search, sorting) ----------
app.get("/entries/", authenticateToken, logger, async (request, response) => {
  const {
    offset = 0,
    limit = 10,
    order = "DESC",
    order_by = "date_created",
    search_q = "",
  } = request.query;
  const validOrder = order.toUpperCase() === "ASC" ? "ASC" : "DESC";
  const validOrderBy = ["date_created", "title", "mood"].includes(order_by)
    ? order_by
    : "date_created";
  const parsedOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);
  const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 100);

  const getEntriesQuery = `
    SELECT
      *
    FROM
      entry
    WHERE
      user_id = ?
      AND (title LIKE ? OR content LIKE ?)
    ORDER BY
      ${validOrderBy} ${validOrder}
    LIMIT
      ?
    OFFSET
      ?;`;

  const searchPattern = `%${search_q}%`;
  const entries = await db.all(
    getEntriesQuery,
    request.userId,
    searchPattern,
    searchPattern,
    parsedLimit,
    parsedOffset,
  );
  response.send(entries);
});

// ---------- 5. Get Single Entry API ----------
app.get("/entries/:entryId/", authenticateToken, async (request, response) => {
  const { entryId } = request.params;
  const getEntryQuery = "SELECT * FROM entry WHERE entry_id = ? AND user_id = ?";

  const entry = await db.get(getEntryQuery, entryId, request.userId);

  if (entry === undefined) {
    response.status(404);
    response.send("Entry Not Found");
  } else {
    response.send(entry);
  }
});

// ---------- 6. Add Entry API ----------
app.post("/entries/", authenticateToken, async (request, response) => {
  const { title, content, mood } = request.body;

  if (!title || !content) {
    return response.status(400).send("title and content are required");
  }

  const dbResponse = await db.run(
    "INSERT INTO entry (user_id, title, content, mood) VALUES (?, ?, ?, ?)",
    request.userId,
    title,
    content,
    mood || null,
  );
  response.send(`Entry created with ID: ${dbResponse.lastID}`);
});

// ---------- 7. Update Entry API ----------
app.put("/entries/:entryId/", authenticateToken, async (request, response) => {
  const { entryId } = request.params;
  const { title, content, mood } = request.body;

  if (!title || !content) {
    return response.status(400).send("title and content are required");
  }

  await db.run(
    "UPDATE entry SET title = ?, content = ?, mood = ? WHERE entry_id = ? AND user_id = ?",
    title,
    content,
    mood || null,
    entryId,
    request.userId,
  );
  response.send("Entry Updated Successfully");
});

// ---------- 8. Delete Entry API ----------
app.delete("/entries/:entryId/", authenticateToken, async (request, response) => {
  const { entryId } = request.params;

  await db.run("DELETE FROM entry WHERE entry_id = ? AND user_id = ?", entryId, request.userId);
  response.send("Entry Deleted Successfully");
});

module.exports = app;
