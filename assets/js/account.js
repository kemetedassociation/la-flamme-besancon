/* ==========================================================================
   LA FLAMME — Compte client (compte.html)
   Signup/login via Supabase Auth, then a small dashboard: points balance,
   referral code, and the ledger of point transactions. Points themselves
   are never writable from here — see supabase/schema.sql.
   ========================================================================== */
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    const db = window.laFlammeDB;
    if (!db) return;

    const authSection = document.getElementById("authSection");
    const dashSection = document.getElementById("dashSection");
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const showSignup = document.getElementById("showSignup");
    const showLogin = document.getElementById("showLogin");
    const authError = document.getElementById("authError");
    const logoutBtn = document.getElementById("logoutBtn");

    function showError(msg) {
      authError.textContent = msg;
      authError.classList.add("is-visible");
    }
    function clearError() {
      authError.classList.remove("is-visible");
    }

    showSignup?.addEventListener("click", () => {
      loginForm.hidden = true;
      signupForm.hidden = false;
      clearError();
    });
    showLogin?.addEventListener("click", () => {
      signupForm.hidden = true;
      loginForm.hidden = false;
      clearError();
    });

    function setBusy(form, busy) {
      const btn = form.querySelector('button[type="submit"]');
      if (!btn) return;
      if (busy) {
        btn.dataset.label = btn.textContent;
        btn.textContent = "Connexion…";
        btn.disabled = true;
      } else {
        btn.textContent = btn.dataset.label || btn.textContent;
        btn.disabled = false;
      }
    }

    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      setBusy(loginForm, true);
      try {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) { showError(traduireErreur(error)); return; }
        location.href = "index.html";
      } catch (err) {
        showError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
      } finally {
        setBusy(loginForm, false);
      }
    });

    signupForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      if (password.length < 6) { showError("Le mot de passe doit faire au moins 6 caractères."); return; }

      setBusy(signupForm, true);
      let data, error;
      try {
        ({ data, error } = await db.auth.signUp({ email, password }));
      } catch (err) {
        showError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
        setBusy(signupForm, false);
        return;
      }
      setBusy(signupForm, false);
      if (error) { showError(traduireErreur(error)); return; }

      // Supabase's default project settings require confirming the e-mail
      // before a session exists — signUp() still returns a user, but
      // data.session is null until that confirmation happens. Handle both:
      // if a session came back immediately, the project has confirmation
      // disabled and we can go straight to the dashboard; otherwise tell
      // the visitor to check their inbox rather than silently doing nothing.
      if (!data.session) {
        signupForm.hidden = true;
        authError.classList.remove("is-visible");
        document.getElementById("signupPendingConfirm").hidden = false;
        return;
      }

      // If arrived via ?ref=CODE, attach the referrer once the profile row
      // exists (created server-side by the on_auth_user_created trigger).
      const refCode = new URLSearchParams(location.search).get("ref");
      if (refCode && data.user) {
        const { data: referrer } = await db
          .from("profiles")
          .select("id")
          .eq("referral_code", refCode.toUpperCase())
          .maybeSingle();
        if (referrer && referrer.id !== data.user.id) {
          await db.from("profiles").update({ referred_by: referrer.id }).eq("id", data.user.id);
        }
      }

      location.href = "index.html";
    });

    logoutBtn?.addEventListener("click", async () => {
      await db.auth.signOut();
      location.reload();
    });

    function traduireErreur(error) {
      const msg = error.message || "";
      if (msg.includes("Invalid login credentials")) return "E-mail ou mot de passe incorrect.";
      if (msg.includes("Email not confirmed")) return "Confirmez votre e-mail avant de vous connecter (vérifiez votre boîte de réception, y compris les spams).";
      if (msg.includes("already registered")) return "Un compte existe déjà avec cet e-mail.";
      if (msg.includes("Password should be")) return "Mot de passe trop court (6 caractères minimum).";
      return "Une erreur est survenue. Réessayez.";
    }

    async function renderDashboard() {
      const { data: { user } } = await db.auth.getUser();
      if (!user) return;

      const { data: profile } = await db.from("profiles").select("*").eq("id", user.id).single();
      if (!profile) return;

      authSection.hidden = true;
      dashSection.hidden = false;

      document.getElementById("pointsValue").textContent = profile.points;
      document.getElementById("referralCode").textContent = profile.referral_code;
      document.getElementById("accountEmail").textContent = profile.email;
      renderStampCard(profile.pizza_burger_count || 0);

      const shareUrl = `${location.origin}${location.pathname.replace("compte.html", "")}compte.html?ref=${profile.referral_code}`;
      const copyBtn = document.getElementById("copyReferralLink");
      if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
          await navigator.clipboard.writeText(shareUrl).catch(() => {});
          const original = copyBtn.textContent;
          copyBtn.textContent = "Copié ✓";
          setTimeout(() => { copyBtn.textContent = original; }, 1600);
        });
      }

      function renderStampCard(count) {
        const dots = document.getElementById("stampDots");
        const hint = document.getElementById("stampHint");
        if (!dots) return;
        dots.innerHTML = Array.from({ length: 9 }, (_, i) => `<span class="stamp-dot${i < count ? " is-filled" : ""}"></span>`).join("");
        hint.textContent = count >= 9
          ? "Prochain achat pizza ou burger offert 🎉"
          : `${count} / 9 — encore ${9 - count} achat${9 - count > 1 ? "s" : ""} pizza/burger avant le 10ème offert.`;
      }

      const { data: txs } = await db
        .from("point_transactions")
        .select("*")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      const txList = document.getElementById("txList");
      if (txList) {
        txList.innerHTML = !txs || !txs.length
          ? '<p class="cart__empty">Aucun mouvement pour l\'instant — commandez et mentionnez votre code fidélité pour commencer à cumuler des points.</p>'
          : txs.map((t) => `
            <div class="tx-row">
              <span class="tx-row__reason">${t.reason}<span class="tx-row__date">${new Date(t.created_at).toLocaleDateString("fr-FR")}</span></span>
              <span class="tx-row__amount">${t.amount > 0 ? "+" : ""}${t.amount} pt${Math.abs(t.amount) > 1 ? "s" : ""}</span>
            </div>`).join("");
      }
    }

    const { data: { session } } = await db.auth.getSession();
    if (session) await renderDashboard();
  });
})();
