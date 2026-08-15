/* ==========================================================================
   LA FLAMME — Console staff (staff.html)
   Gated on profiles.is_staff (checked server-side by RLS — see
   supabase/schema.sql). A non-staff account that reaches this page simply
   gets "Accès réservé au personnel" and nothing works: the point_transactions
   insert policy itself rejects the write, this page is just the UI for it.
   ========================================================================== */
(() => {
  "use strict";

  const POINTS_PER_EURO = 1;

  document.addEventListener("DOMContentLoaded", async () => {
    const db = window.laFlammeDB;
    if (!db) return;

    const authSection = document.getElementById("authSection");
    const deniedSection = document.getElementById("deniedSection");
    const staffSection = document.getElementById("staffSection");
    const loginForm = document.getElementById("loginForm");
    const authError = document.getElementById("authError");
    const searchForm = document.getElementById("searchForm");
    const resultEl = document.getElementById("staffResult");
    const creditForm = document.getElementById("creditForm");
    const creditMsg = document.getElementById("creditMsg");

    let foundProfile = null;

    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      authError.classList.remove("is-visible");
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) {
        authError.textContent = "E-mail ou mot de passe incorrect.";
        authError.classList.add("is-visible");
        return;
      }
      await checkStaffAccess();
    });

    searchForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const query = document.getElementById("searchQuery").value.trim();
      if (!query) return;

      const { data } = await db
        .from("profiles")
        .select("id, email, points, referral_code, pizza_burger_count")
        .or(`email.eq.${query},referral_code.eq.${query.toUpperCase()}`)
        .maybeSingle();

      if (!data) {
        resultEl.classList.remove("is-visible");
        creditMsg.textContent = "Aucun client trouvé avec cet e-mail ou ce code.";
        return;
      }
      creditMsg.textContent = "";
      foundProfile = data;
      document.getElementById("resultEmail").textContent = data.email;
      document.getElementById("resultCode").textContent = data.referral_code;
      document.getElementById("resultPoints").textContent = data.points;
      renderStampCount(data.pizza_burger_count);
      resultEl.classList.add("is-visible");
    });

    function renderStampCount(count) {
      document.getElementById("resultStamps").textContent = `${count} / 9`;
    }

    document.getElementById("stampBtn")?.addEventListener("click", async () => {
      if (!foundProfile) return;
      const { data: { user } } = await db.auth.getUser();

      const wasFull = foundProfile.pizza_burger_count >= 9;
      const { error } = await db.from("stamp_events").insert({
        profile_id: foundProfile.id,
        category: "pizza_burger",
        credited_by: user.id,
      });

      if (error) {
        creditMsg.textContent = "Erreur : " + error.message;
        return;
      }

      foundProfile.pizza_burger_count = wasFull ? 0 : foundProfile.pizza_burger_count + 1;
      renderStampCount(foundProfile.pizza_burger_count);
      creditMsg.textContent = wasFull
        ? `🎉 10ème pizza/burger offerte pour ${foundProfile.email} ! Compteur remis à zéro.`
        : `✓ Tampon ajouté (${foundProfile.pizza_burger_count}/9) pour ${foundProfile.email}.`;
    });

    creditForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!foundProfile) return;
      const amountEuros = parseFloat(document.getElementById("orderAmount").value);
      if (!amountEuros || amountEuros <= 0) return;

      const points = Math.round(amountEuros * POINTS_PER_EURO);
      const { data: { user } } = await db.auth.getUser();

      const { error } = await db.from("point_transactions").insert({
        profile_id: foundProfile.id,
        amount: points,
        reason: `Commande WhatsApp — ${amountEuros.toFixed(2)}€`,
        order_amount_cents: Math.round(amountEuros * 100),
        credited_by: user.id,
      });

      if (error) {
        creditMsg.textContent = "Erreur : " + error.message;
        return;
      }

      creditMsg.textContent = `✓ ${points} points crédités à ${foundProfile.email}.`;
      document.getElementById("orderAmount").value = "";
      document.getElementById("resultPoints").textContent = foundProfile.points + points;
      foundProfile.points += points;
    });

    async function checkStaffAccess() {
      const { data: { user } } = await db.auth.getUser();
      if (!user) return;

      const { data: profile } = await db.from("profiles").select("is_staff").eq("id", user.id).single();

      authSection.hidden = true;
      if (profile && profile.is_staff) {
        staffSection.hidden = false;
      } else {
        deniedSection.hidden = false;
      }
    }

    const { data: { session } } = await db.auth.getSession();
    if (session) await checkStaffAccess();
  });
})();
