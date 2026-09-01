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

const dbPath = path.join(__dirname, "db", "journal.db");
const schemaPath = path.join(__dirname, "db", "schema.sql");
let db = null;

// ---------- 1. Initialize DB and start server ----------
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Run schema on startup so tables exist even on a fresh clone
    const schema = fs.readFileSync(schemaPath, "utf8");
    await db.exec(schema);

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

// ================= AUTH ROUTES =================

// ---------- 2. Register User API ----------
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO
        user (username, name, password, gender, location)
      VALUES
        ('${username}', '${name}', '${hashedPassword}', '${gender}', '${location}');`;
    const dbResponse = await db.run(createUserQuery);
    response.send(`Created new user with ID: ${dbResponse.lastID}`);
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// ---------- 3. Login User API (returns JWT Token) ----------
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: dbUser.username, userId: dbUser.user_id };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
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

  const getEntriesQuery = `
    SELECT
      *
    FROM
      entry
    WHERE
      user_id = ${request.userId}
      AND (title LIKE '%${search_q}%' OR content LIKE '%${search_q}%')
    ORDER BY
      ${order_by} ${order}
    LIMIT
      ${limit}
    OFFSET
      ${offset};`;

  const entries = await db.all(getEntriesQuery);
  response.send(entries);
});

// ---------- 5. Get Single Entry API ----------
app.get("/entries/:entryId/", authenticateToken, async (request, response) => {
  const { entryId } = request.params;
  const getEntryQuery = `
    SELECT
      *
    FROM
      entry
    WHERE
      entry_id = ${entryId} AND user_id = ${request.userId};`;

  const entry = await db.get(getEntryQuery);

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

  const addEntryQuery = `
    INSERT INTO
      entry (user_id, title, content, mood)
    VALUES
      (${request.userId}, '${title}', '${content}', '${mood}');`;

  const dbResponse = await db.run(addEntryQuery);
  response.send(`Entry created with ID: ${dbResponse.lastID}`);
});

// ---------- 7. Update Entry API ----------
app.put("/entries/:entryId/", authenticateToken, async (request, response) => {
  const { entryId } = request.params;
  const { title, content, mood } = request.body;

  const updateEntryQuery = `
    UPDATE
      entry
    SET
      title = '${title}',
      content = '${content}',
      mood = '${mood}'
    WHERE
      entry_id = ${entryId} AND user_id = ${request.userId};`;

  await db.run(updateEntryQuery);
  response.send("Entry Updated Successfully");
});

// ---------- 8. Delete Entry API ----------
app.delete("/entries/:entryId/", authenticateToken, async (request, response) => {
  const { entryId } = request.params;

  const deleteEntryQuery = `
    DELETE FROM
      entry
    WHERE
      entry_id = ${entryId} AND user_id = ${request.userId};`;

  await db.run(deleteEntryQuery);
  response.send("Entry Deleted Successfully");
});

module.exports = app;
