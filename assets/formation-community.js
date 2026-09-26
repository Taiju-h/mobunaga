"use strict";
(() => {
  const API = "/api/formation-reports.php";
  const escHtml = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const labelType = (v) => v === "counter_win" ? "この編成に勝った" : "この編成で勝った";
  const labelResult = (v) => ({win:"勝利",loss:"敗北",draw:"引分"}[v] || v);

  function shell(id) {
    return `<section class="community-reports" data-community-formation="${escHtml(id)}">
      <div class="community-head"><div><p class="eyebrow">COMMUNITY REPORTS</p><h3>みんなの実戦報告</h3><p>「この編成で勝った」「この編成に勝った」を画像付きで共有できます。</p></div><button type="button" class="community-post-open">＋ 投稿する</button></div>
      <div class="community-summary" aria-live="polite">読み込み中…</div>
      <div class="community-gallery"></div>
      <form class="community-form" hidden enctype="multipart/form-data">
        <input type="hidden" name="formation_id" value="${escHtml(id)}">
        <input class="community-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="community-form-grid">
          <label>投稿種別<select name="report_type"><option value="win_with">この編成で勝った</option><option value="counter_win">この編成に勝った</option></select></label>
          <label>結果<select name="result_type"><option value="win">勝利</option><option value="draw">引分</option><option value="loss">敗北</option></select></label>
          <label>お名前（任意）<input name="poster_name" maxlength="80" placeholder="匿名"></label>
          <label>相手編成・相手名（任意）<input name="opponent_text" maxlength="255" placeholder="例：武田信玄・馬場信春・真田昌幸"></label>
        </div>
        <label>戦報画像 <input name="image" type="file" accept="image/jpeg,image/png,image/webp" required></label>
        <label>ひとこと（任意）<textarea name="comment_text" maxlength="1000" rows="3" placeholder="何が刺さったか、注意点など"></textarea></label>
        <div class="community-form-actions"><button type="button" class="community-post-cancel">閉じる</button><button type="submit">投稿する</button></div>
        <p class="community-form-status" aria-live="polite"></p>
      </form>
    </section>`;
  }

  async function load(host) {
    const id = host.dataset.communityFormation;
    const summary = host.querySelector(".community-summary");
    const gallery = host.querySelector(".community-gallery");
    try {
      const r = await fetch(`${API}?formation_id=${encodeURIComponent(id)}`, {credentials:"same-origin", cache:"no-store"});
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || "読み込みに失敗しました");
      const rows = data.reports || [];
      const withCount = rows.filter(x => x.report_type === "win_with").length;
      const counterCount = rows.filter(x => x.report_type === "counter_win").length;
      summary.innerHTML = `<strong>${rows.length}件</strong><span>この編成で勝った ${withCount}</span><span>この編成に勝った ${counterCount}</span>`;
      gallery.innerHTML = rows.length ? rows.map(row => `<article class="community-report-card">
        <a class="community-image" href="${escHtml(row.image_url)}" target="_blank" rel="noopener"><img src="${escHtml(row.image_url)}" alt="投稿された戦報画像" loading="lazy"></a>
        <div class="community-report-body"><div class="community-report-tags"><span>${escHtml(labelType(row.report_type))}</span><b>${escHtml(labelResult(row.result_type))}</b></div>
        ${row.opponent_text ? `<p class="community-opponent">対：${escHtml(row.opponent_text)}</p>` : ""}
        ${row.comment_text ? `<p>${escHtml(row.comment_text)}</p>` : ""}
        <small>${escHtml(row.poster_name || "匿名")} ／ ${escHtml(String(row.created_at || "").slice(0,16))}</small></div>
      </article>`).join("") : '<p class="community-empty">まだ投稿がありません。最初の戦報をどうぞ。</p>';
    } catch (e) {
      summary.textContent = e.message || "実戦報告を読み込めませんでした";
      gallery.innerHTML = "";
    }
  }

  function bind(host) {
    if (host.dataset.communityReady) return;
    host.dataset.communityReady = "1";
    const form = host.querySelector(".community-form");
    host.querySelector(".community-post-open")?.addEventListener("click", () => { form.hidden = false; form.scrollIntoView({behavior:"smooth", block:"nearest"}); });
    host.querySelector(".community-post-cancel")?.addEventListener("click", () => { form.hidden = true; });
    form?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const status = form.querySelector(".community-form-status");
      const submit = form.querySelector('button[type="submit"]');
      status.textContent = "送信中…"; submit.disabled = true;
      try {
        const r = await fetch(API, {method:"POST", body:new FormData(form), credentials:"same-origin", headers:{"X-Mobunaga-Upload":"1"}});
        const data = await r.json();
        if (!r.ok || !data.ok) throw new Error(data.error || "投稿できませんでした");
        status.textContent = "投稿しました。";
        form.reset(); form.hidden = true; await load(host);
      } catch (e) { status.textContent = e.message || "投稿できませんでした"; }
      finally { submit.disabled = false; }
    });
    load(host);
  }

  function mountArchiveHelp() {
    if (!location.pathname.startsWith("/analysis-room/") || document.querySelector("#archive-usage-guide")) return;
    const title = document.querySelector("#archive-title");
    if (!title) return;
    const card = title.closest(".archive-card") || title.parentElement;
    if (!card) return;
    const guide = document.createElement("details");
    guide.id = "archive-usage-guide";
    guide.className = "intel-compose archive-usage-guide";
    guide.innerHTML = `<summary>？ 資料館の使い方</summary><div class="intel-help" style="padding:14px 4px 4px;line-height:1.75">
      <p><b>武将・敵編成を登録する時：</b>「＋ 敵情報を投稿」を開き、<b>編成・武将</b>へ「武将A・武将B・武将C」のように入力してください。1人だけ判明している場合は1人だけでも構いません。</p>
      <p>戦法、挙動、何ターン目に起きたか、対策候補は本文へ。戦報や編成画面があれば画像を添付し、DiscordやWeb記事が出典なら参照URLも残します。</p>
      <p><b>要注意</b>は次に警戒したい敵編成を上へ固定する印です。上の検索欄から敵名または武将名で絞り込めます。</p>
      <p><b>この投稿は資料館の情報受け箱への登録です。</b> 公開側の武将録マスターを直接追加・変更するものではありません。正式な武将マスター追加は出典確認後に管理側で行います。</p>
      <p><a href="/help/#archive">詳しい使い方を見る</a></p>
    </div>`;
    const desc = card.querySelector(".description");
    if (desc) desc.insertAdjacentElement("afterend", guide); else title.insertAdjacentElement("afterend", guide);
  }

  function hydrate(root=document) {
    root.querySelectorAll("[data-community-mount]").forEach((mount) => {
      if (mount.dataset.communityMounted) return;
      const id = mount.dataset.communityMount;
      mount.dataset.communityMounted = "1";
      mount.innerHTML = shell(id);
    });
    root.querySelectorAll("[data-community-formation]").forEach(bind);
    mountArchiveHelp();
  }
  const observer = new MutationObserver(() => hydrate());
  observer.observe(document.documentElement, {subtree:true, childList:true});
  document.addEventListener("DOMContentLoaded", () => hydrate());

  if (typeof formationDetail === "function") {
    const baseFormationDetail = formationDetail;
    formationDetail = function communityFormationDetail(f) {
      return baseFormationDetail(f) + shell(String(f.id));
    };
  }
  window.MobunagaCommunity = { shell, hydrate };
})();