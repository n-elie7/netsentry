// authentication api routes

const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const db = require("../database/db");

const router = express.Router();

const SALT_ROUNDS = 10;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;


router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    // validate username
    if (!username || !USERNAME_REGEX.test(username)) {
      return res.status(400).json({
        success: false,
        error: { message: "Username must be 3-20 characters (letters, numbers, underscores only)." },
      });
    }

    // validate password
    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: { message: "Password must be at least 6 characters." },
      });
    }

    const existing = db.findUserByUsername(username);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { message: "Username is already taken." },
      });
    }


    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = db.createUser({
      id: uuidv4(),
      username,
      passwordHash,
    });

    // auto login
    req.session.userId = user.id;

    console.log(`[AUTH] New user registered: ${user.username}`);

    res.status(201).json({
      success: true,
      data: { id: user.id, username: user.username },
    });
  } catch (error) {
    console.error("[AUTH] Registration error:", error.message);
    res.status(500).json({
      success: false,
      error: { message: "Registration failed. Please try again." },
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: { message: "Username and password are required." },
      });
    }

    const user = db.findUserByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: "Invalid username or password." },
      });
    }


    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { message: "Invalid username or password." },
      });
    }


    req.session.userId = user.id;

    console.log(`[AUTH] User logged in: ${user.username}`);

    res.json({
      success: true,
      data: { id: user.id, username: user.username },
    });
  } catch (error) {
    console.error("[AUTH] Login error:", error.message);
    res.status(500).json({
      success: false,
      error: { message: "Login failed. Please try again." },
    });
  }
});


router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: { message: "Logout failed." },
      });
    }

    res.clearCookie("connect.sid");
    res.json({ success: true, message: "Logged out." });
  });
});


router.get("/me", (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: { message: "Not authenticated." },
    });
  }

  const user = db.findUserById(req.session.userId);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: { message: "Session invalid." },
    });
  }

  res.json({ success: true, data: user });
});

module.exports = router;
