// supabase/functions/create-checkout-session/index.ts
import Stripe from "npm:stripe@16.6.0"; // Version angeben ist sicherer

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

if (!STRIPE_SECRET_KEY) {
  console.error("⚠️ STRIPE_SECRET_KEY ist nicht gesetzt!");
}

const stripe = new Stripe(STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

Deno.serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = await req.json();
    const {
      priceId,
      successUrl,
      cancelUrl,
      mode = "subscription", // "payment" für Pay-per-Match
    } = body;

    if (!priceId || !successUrl || !cancelUrl) {
      return new Response(
        JSON.stringify({ error: "Fehlende Parameter: priceId, successUrl oder cancelUrl" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode, // "subscription" oder "payment"
      success_url: successUrl,
      cancel_url: cancelUrl,
      // falls du später Customer erzwingen willst: customer: 'cus_xxx'
    });

    return new Response(JSON.stringify({ id: session.id, url: session.url }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Stripe Error:", error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
