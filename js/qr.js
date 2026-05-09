import { toast } from "./app.js";

let qr = null;

export function bindShareModal() {
  const modal = document.getElementById("shareModal");
  document.getElementById("shareClose").addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.add("hidden"); });
  document.getElementById("shareCopy").addEventListener("click", async () => {
    const url = document.getElementById("shareUrl").value;
    try { await navigator.clipboard.writeText(url); toast("Link copied"); }
    catch { toast("Copy failed — select & copy manually"); }
  });
}

export function openShareModal(boardId) {
  const url = `${location.origin}${location.pathname}#/board/${boardId}`;
  document.getElementById("shareUrl").value = url;
  document.getElementById("shareId").value = boardId;

  const target = document.getElementById("qrcode");
  target.innerHTML = "";
  // qrcode.js (davidshimjs) is loaded via CDN as global QRCode
  // eslint-disable-next-line no-undef
  qr = new QRCode(target, {
    text: url, width: 200, height: 200,
    colorDark: "#0f172a", colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  document.getElementById("shareModal").classList.remove("hidden");
}
