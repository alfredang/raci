import {
  ref, onValue, set, onDisconnect, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from "./app.js";

let detach = null;
let heartbeat = null;

const NAMES = ["Otter","Falcon","Fern","Pebble","Comet","Maple","Lynx","Sparrow","Wren","Birch","Cobalt","Saffron","Indigo","Coral","Sage"];
const COLORS = ["#2563eb","#16a34a","#db2777","#f59e0b","#7c3aed","#0891b2","#ea580c","#059669","#9333ea","#e11d48"];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function startPresence(boardId, uid) {
  stopPresence();
  const me = { name: pick(NAMES), color: pick(COLORS), lastSeen: serverTimestamp() };
  const meRef = ref(db, `boards/${boardId}/presence/${uid}`);
  set(meRef, me);
  onDisconnect(meRef).remove();
  heartbeat = setInterval(() => {
    set(ref(db, `boards/${boardId}/presence/${uid}/lastSeen`), serverTimestamp());
  }, 30000);

  const presEl = document.getElementById("presence");
  const off = onValue(ref(db, `boards/${boardId}/presence`), (snap) => {
    const v = snap.val() || {};
    presEl.innerHTML = "";
    for (const [u, p] of Object.entries(v)) {
      const a = document.createElement("span");
      a.className = "avatar";
      a.style.background = p.color || "#64748b";
      a.title = p.name + (u === uid ? " (you)" : "");
      a.textContent = (p.name || "?").slice(0, 1);
      presEl.appendChild(a);
    }
  });
  detach = () => {
    off();
    set(meRef, null).catch(() => {});
  };
}

export function stopPresence() {
  if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  if (detach) { try { detach(); } catch (_) {} detach = null; }
}
