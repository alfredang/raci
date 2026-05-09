import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
import { mountBoard, unmountBoard } from "./board.js";
import { openShareModal, bindShareModal } from "./qr.js";

export const fb = initializeApp(firebaseConfig);
export const auth = getAuth(fb);
export const db = getDatabase(fb);

const view = document.getElementById("view");
const shareBtn = document.getElementById("shareBtn");

let currentUid = null;
let currentBoardId = null;

const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (u) => { if (u) { currentUid = u.uid; resolve(u); } });
  signInAnonymously(auth).catch((e) => toast("Auth failed: " + e.message));
});

bindShareModal();
bindThemeToggle();

shareBtn.addEventListener("click", () => {
  if (currentBoardId) openShareModal(currentBoardId);
});

function bindThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = cur === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("raci.theme", next); } catch (_) {}
  });
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);

function route() {
  const hash = location.hash || "#/";
  const m = hash.match(/^#\/board\/([A-Za-z0-9_-]+)/);
  unmountBoard();
  view.innerHTML = "";
  if (m) {
    shareBtn.classList.remove("hidden");
    currentBoardId = m[1];
    renderBoard(currentBoardId);
  } else {
    shareBtn.classList.add("hidden");
    currentBoardId = null;
    renderLanding();
  }
}

function renderLanding() {
  const tpl = document.getElementById("tpl-landing");
  view.appendChild(tpl.content.cloneNode(true));
  document.getElementById("createBoard").addEventListener("click", createBoard);
  document.getElementById("joinForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = document.getElementById("joinId").value.trim();
    if (!raw) return;
    const id = extractBoardId(raw);
    if (!id) { toast("Invalid board ID or URL"); return; }
    location.hash = `#/board/${id}`;
  });
}

function extractBoardId(s) {
  const m = s.match(/board\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{4,}$/.test(s)) return s;
  return null;
}

async function createBoard() {
  await authReady;
  const id = randomId(8);
  await set(ref(db, `boards/${id}/meta`), {
    title: "Untitled RACI board",
    createdAt: serverTimestamp(),
    createdBy: currentUid
  });
  // Seed a sample structure so the grid isn't empty on first open
  const seedRoles = ["Solution Architect", "Platform Team", "Security & Compliance", "Data/Knowledge Owner"];
  const seedActs  = ["Strategy & use case selection", "Agent tech plan", "Landing zone & policies", "Build agents", "Operate & telemetry"];
  const rolesObj = {}, actsObj = {};
  seedRoles.forEach((n, i) => rolesObj[`r${i}`] = { name: n, order: i });
  seedActs.forEach((n, i)  => actsObj[`a${i}`]  = { name: n, order: i });
  await set(ref(db, `boards/${id}/roles`), rolesObj);
  await set(ref(db, `boards/${id}/activities`), actsObj);
  location.hash = `#/board/${id}`;
}

async function renderBoard(boardId) {
  const tpl = document.getElementById("tpl-board");
  view.appendChild(tpl.content.cloneNode(true));
  await authReady;
  mountBoard(boardId, currentUid);
}

function randomId(n) {
  const a = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const arr = new Uint32Array(n);
  crypto.getRandomValues(arr);
  for (let i = 0; i < n; i++) s += a[arr[i] % a.length];
  return s;
}

export function toast(msg, ms = 2200) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), ms);
}
