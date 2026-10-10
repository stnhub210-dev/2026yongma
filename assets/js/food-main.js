/* 메인 — '우리 가게 음식 자랑하기' 띠에 추첨된 가게(이달의 맛집)를 보여 준다. 당첨이 없으면 칸을 숨긴다. */
(function () {
  "use strict";
  const box = document.getElementById("fs-band-win");
  if (!box || !window.Auth || !Auth.ready()) return;
  const c = Auth.client();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const ROUND = { "2026-10": "10월", "2026-11": "11월" };
  c.from("food_entries").select("id,round,shop_name,menu_name,photo_thumb")
    .eq("status", "approved").eq("winner", true).order("winner_at", { ascending: false }).limit(4)
    .then(({ data, error }) => {
      if (error || !data || !data.length) return;
      document.getElementById("fs-band-list").innerHTML = data.map((e) => `
        <a class="fs-band__card" href="foodshow.html#winners">
          <img src="${c.storage.from("food").getPublicUrl(e.photo_thumb).data.publicUrl}" alt="" loading="lazy">
          <span><b>${esc(e.shop_name)}</b><small>${esc(e.menu_name)} · ${ROUND[e.round] || ""}</small></span>
        </a>`).join("");
      box.hidden = false;
      const art = document.getElementById("fs-band-art"); if (art) art.hidden = true;
    });
})();
