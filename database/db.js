// database functionality

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const SCANS_PATH = path.join(DATA_DIR, "scans.json");
const USERS_PATH = path.join(DATA_DIR, "users.json");

let scans = [];
let users = [];


function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  scans = loadFile(SCANS_PATH);
  users = loadFile(USERS_PATH);

  console.log(`[DB] Loaded ${users.length} users, ${scans.length} scans from disk.`);
}

function loadFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
}

function persistScans() {
  fs.writeFileSync(SCANS_PATH, JSON.stringify(scans, null, 2));
}

function persistUsers() {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}


function createUser({ id, username, passwordHash }) {
  const user = {
    id,
    username: username.toLowerCase(),
    passwordHash,
    created_at: new Date().toISOString(),
  };

  users.push(user);
  persistUsers();

  return { id: user.id, username: user.username, created_at: user.created_at };
}


function findUserByUsername(username) {
  return users.find((u) => u.username === username.toLowerCase()) || null;
}


function findUserById(id) {
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  return { id: user.id, username: user.username, created_at: user.created_at };
}

function saveScan({ id, userId, domain, grade, score, results }) {
  scans.unshift({
    id,
    userId,
    domain,
    grade,
    score,
    results,
    scanned_at: new Date().toISOString(),
  });

  if (scans.length > 2000) scans = scans.slice(0, 2000);

  persistScans();
}


function getHistory({ userId, search, grade, sortBy, order, limit, offset }) {
  let filtered = scans.filter((s) => s.userId === userId);

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((s) => s.domain.toLowerCase().includes(q));
  }

  if (grade) {
    filtered = filtered.filter((s) => s.grade === grade);
  }

  const sortKey = sortBy || "scanned_at";
  const dir = order === "ASC" ? 1 : -1;

  filtered.sort((a, b) => {
    if (sortKey === "score") return (a.score - b.score) * dir;
    if (sortKey === "domain") return a.domain.localeCompare(b.domain) * dir;
    if (sortKey === "grade") return a.grade.localeCompare(b.grade) * dir;
    return (new Date(b.scanned_at) - new Date(a.scanned_at)) * dir;
  });

  const start = offset || 0;
  const end = start + (limit || 20);

  return filtered.slice(start, end).map(({ results, ...rest }) => rest);
}


function getScanById(id, userId) {
  const scan = scans.find((s) => s.id === id && s.userId === userId);
  return scan || null;
}


function getScanCount({ userId, search, grade }) {
  let filtered = scans.filter((s) => s.userId === userId);

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((s) => s.domain.toLowerCase().includes(q));
  }

  if (grade) {
    filtered = filtered.filter((s) => s.grade === grade);
  }

  return filtered.length;
}


function deleteScan(id, userId) {
  const idx = scans.findIndex((s) => s.id === id && s.userId === userId);
  if (idx === -1) return { changes: 0 };

  scans.splice(idx, 1);
  persistScans();
  return { changes: 1 };
}

module.exports = {
  init,
  createUser, findUserByUsername, findUserById,
  saveScan, getHistory, getScanById, getScanCount, deleteScan,
};
