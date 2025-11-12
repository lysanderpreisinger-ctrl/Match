// supabase/functions/send-feedback-email/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from "npm:resend"; // oder ein anderer Maildienst

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// deine Ziel-Mail – später aus Secret holen
const TARGET_EMAIL = Deno.env.get("FEEDBACK_TARGET_EMAIL") || "team@jatch.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, userId, email } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "No message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      console.warn("No RESEND_API_KEY set – email will not be sent");
      return new Response(JSON.stringify({ ok: true, sent: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(RESEND_API_KEY);

    await resend.emails.send({
      from: "jatch Feedback <feedback@jatch.app>",
      to: [TARGET_EMAIL],
      subject: "Neues Feedback aus der App",
      text: `
Von: ${email || "unbekannt"}
User-ID: ${userId || "unbekannt"}

Nachricht:
${message}
      `.trim(),
    });

    return new Response(JSON.stringify({ ok: true, sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
