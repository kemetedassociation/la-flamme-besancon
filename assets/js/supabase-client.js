/* ==========================================================================
   LA FLAMME — Supabase client (fidélité / comptes clients)
   --------------------------------------------------------------------------
   The URL + "publishable" key below are meant to be public (same trust
   level as a Stripe publishable key) — they only let the browser talk to
   Supabase's PostgREST API, and every table is locked down with Row Level
   Security (see supabase/schema.sql). Nothing here can read or write data
   the signed-in user isn't explicitly allowed to touch.
   ========================================================================== */
(() => {
  "use strict";
  const SUPABASE_URL = "https://olelbxssdbuwaijdikrp.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_stwNi3gXwTG3TBRI-DxK8g_ap9Y4Hos";

  if (!window.supabase || !window.supabase.createClient) {
    console.error("Supabase SDK not loaded — check the CDN <script> tag order.");
    return;
  }

  window.laFlammeDB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
