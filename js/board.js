import {
  ref, onValue, set, update, remove, push, child, serverTimestamp, get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db } from "./app.js";
import { startPresence, stopPresence } from "./presence.js";

let unsub = [];
let currentBoardId = null;
let currentUid = null;
let state = { meta: {}, roles: {}, activities: {}, cells: {} };
let titleDebounce = null;

export function mountBoard(boardId, uid) {
  currentBoardId = boardId;
  currentUid = uid;
  bindStaticHandlers();
  startPresence(boardId, uid);

  const boardRef = ref(db, `boards/${boardId}`);
  const off = onValue(boardRef, (snap) => {
    const v = snap.val() || {};
    state.meta       = v.meta       || {};
    state.roles      = v.roles      || {};
    state.activities = v.activities || {};
    state.cells      = v.cells      || {};
    render();
  });
  unsub.push(off);
}

export function unmountBoard() {
  unsub.forEach(fn => { try { fn(); } catch (_) {} });
  unsub = [];
  stopPresence();
  currentBoardId = null;
}

function bindStaticHandlers() {
  const titleEl = document.getElementById("boardTitle");
  titleEl.addEventListener("input", () => {
    clearTimeout(titleDebounce);
    titleDebounce = setTimeout(() => {
      set(ref(db, `boards/${currentBoardId}/meta/title`), titleEl.value || "Untitled RACI board");
    }, 300);
  });

  // Palette swatches → drag source
  document.querySelectorAll(".swatch").forEach((sw) => {
    sw.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "new", type: sw.dataset.type }));
      e.dataTransfer.effectAllowed = "copy";
    });
  });

  // Trash drop target
  const trash = document.getElementById("trash");
  trash.addEventListener("dragover", (e) => { e.preventDefault(); trash.classList.add("drag-over"); });
  trash.addEventListener("dragleave", () => trash.classList.remove("drag-over"));
  trash.addEventListener("drop", (e) => {
    e.preventDefault();
    trash.classList.remove("drag-over");
    const data = safeParse(e.dataTransfer.getData("text/plain"));
    if (data?.kind === "marker") {
      remove(ref(db, `boards/${currentBoardId}/cells/${data.activityId}/${data.roleId}/${data.markerId}`));
    }
  });
}

function render() {
  const titleEl = document.getElementById("boardTitle");
  if (document.activeElement !== titleEl) titleEl.value = state.meta.title || "Untitled RACI board";

  const grid = document.getElementById("raciGrid");
  const roles = sortByOrder(state.roles);
  const acts  = sortByOrder(state.activities);

  // Build table
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.appendChild(th("Activity", "head-corner"));
  for (const [rid, r] of roles) {
    headRow.appendChild(roleHeader(rid, r));
  }
  const addColTh = document.createElement("th");
  addColTh.className = "add-col";
  addColTh.textContent = "+ Add role";
  addColTh.title = "Add role";
  addColTh.addEventListener("click", addRole);
  headRow.appendChild(addColTh);
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  for (const [aid, a] of acts) {
    const tr = document.createElement("tr");
    tr.appendChild(activityHeader(aid, a));
    for (const [rid] of roles) {
      tr.appendChild(cell(aid, rid));
    }
    tr.appendChild(td("")); // align with add-col
    tbody.appendChild(tr);
  }
  // Add activity row
  const addRow = document.createElement("tr");
  addRow.className = "add-row";
  const addTd = document.createElement("td");
  addTd.colSpan = roles.length + 2;
  addTd.textContent = "+ Add activity";
  addTd.addEventListener("click", addActivity);
  addRow.appendChild(addTd);
  tbody.appendChild(addRow);

  grid.innerHTML = "";
  grid.appendChild(thead);
  grid.appendChild(tbody);
}

function th(text, cls) {
  const el = document.createElement("th");
  if (cls) el.className = cls;
  el.textContent = text;
  return el;
}
function td(text) {
  const el = document.createElement("td");
  if (text) el.textContent = text;
  return el;
}

function roleHeader(rid, r) {
  const el = document.createElement("th");
  const input = document.createElement("input");
  input.className = "head-edit";
  input.value = r.name || "";
  input.addEventListener("change", () => {
    set(ref(db, `boards/${currentBoardId}/roles/${rid}/name`), input.value || "Role");
  });
  const actions = document.createElement("span");
  actions.className = "col-actions";
  const del = document.createElement("button");
  del.className = "icon-btn"; del.textContent = "×"; del.title = "Delete role";
  del.addEventListener("click", () => deleteRole(rid));
  actions.appendChild(del);
  el.appendChild(input);
  el.appendChild(actions);
  return el;
}

function activityHeader(aid, a) {
  const el = document.createElement("th");
  el.scope = "row";
  el.className = "row-head";
  const input = document.createElement("input");
  input.className = "row-edit";
  input.value = a.name || "";
  input.addEventListener("change", () => {
    set(ref(db, `boards/${currentBoardId}/activities/${aid}/name`), input.value || "Activity");
  });
  const actions = document.createElement("span");
  actions.className = "row-actions";
  const del = document.createElement("button");
  del.className = "icon-btn"; del.textContent = "×"; del.title = "Delete activity";
  del.addEventListener("click", () => deleteActivity(aid));
  actions.appendChild(del);
  el.appendChild(input);
  el.appendChild(actions);
  return el;
}

function cell(aid, rid) {
  const el = document.createElement("td");
  el.dataset.aid = aid;
  el.dataset.rid = rid;

  const wrap = document.createElement("span");
  wrap.className = "markers";
  const cellMarkers = state.cells?.[aid]?.[rid] || {};
  for (const [mid, m] of Object.entries(cellMarkers)) {
    const span = document.createElement("span");
    span.className = "marker";
    span.dataset.type = m.type;
    span.draggable = true;
    span.title = ({ A: "Accountable", R: "Responsible", C: "Consulted" })[m.type] || m.type;
    span.textContent = m.type;
    span.addEventListener("click", () => {
      remove(ref(db, `boards/${currentBoardId}/cells/${aid}/${rid}/${mid}`));
    });
    span.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({
        kind: "marker", markerId: mid, activityId: aid, roleId: rid, type: m.type
      }));
      e.dataTransfer.effectAllowed = "move";
    });
    wrap.appendChild(span);
  }
  el.appendChild(wrap);

  el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("drag-over"); });
  el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    el.classList.remove("drag-over");
    const data = safeParse(e.dataTransfer.getData("text/plain"));
    if (!data) return;
    if (data.kind === "new") {
      addMarker(aid, rid, data.type);
    } else if (data.kind === "marker") {
      // Move marker between cells
      if (data.activityId === aid && data.roleId === rid) return;
      const updates = {};
      updates[`boards/${currentBoardId}/cells/${data.activityId}/${data.roleId}/${data.markerId}`] = null;
      const newKey = push(child(ref(db), `boards/${currentBoardId}/cells/${aid}/${rid}`)).key;
      updates[`boards/${currentBoardId}/cells/${aid}/${rid}/${newKey}`] = {
        type: data.type, by: currentUid, at: serverTimestamp()
      };
      update(ref(db), updates);
    }
  });
  return el;
}

function addMarker(aid, rid, type) {
  const cellRef = ref(db, `boards/${currentBoardId}/cells/${aid}/${rid}`);
  const newRef = push(cellRef);
  set(newRef, { type, by: currentUid, at: serverTimestamp() });
}

async function addRole() {
  const order = nextOrder(state.roles);
  const newRef = push(ref(db, `boards/${currentBoardId}/roles`));
  await set(newRef, { name: "New role", order });
}

async function addActivity() {
  const order = nextOrder(state.activities);
  const newRef = push(ref(db, `boards/${currentBoardId}/activities`));
  await set(newRef, { name: "New activity", order });
}

async function deleteRole(rid) {
  if (!confirm("Delete this role and all its markers?")) return;
  const updates = {};
  updates[`boards/${currentBoardId}/roles/${rid}`] = null;
  for (const aid of Object.keys(state.activities)) {
    updates[`boards/${currentBoardId}/cells/${aid}/${rid}`] = null;
  }
  await update(ref(db), updates);
}

async function deleteActivity(aid) {
  if (!confirm("Delete this activity and all its markers?")) return;
  const updates = {};
  updates[`boards/${currentBoardId}/activities/${aid}`] = null;
  updates[`boards/${currentBoardId}/cells/${aid}`] = null;
  await update(ref(db), updates);
}

function sortByOrder(obj) {
  return Object.entries(obj || {}).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
}
function nextOrder(obj) {
  const vals = Object.values(obj || {}).map(x => x.order ?? 0);
  return vals.length ? Math.max(...vals) + 1 : 0;
}
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
