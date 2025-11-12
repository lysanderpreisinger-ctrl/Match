import Stripe from "npm:stripe";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { customerId, paymentMethodId, amountCents, currency = "eur", metadata } = await req.json();

    if (!customerId || !paymentMethodId || !amountCents) {
      return new Response(JSON.stringify({ error: "customerId, paymentMethodId, amountCents erforderlich" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // PaymentIntent Off-Session (keine neue UI)
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(Number(amountCents)),
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: metadata || undefined,
    });

    return new Response(JSON.stringify({ id: pi.id, status: pi.status }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error(error);

    // Falls SCA-Fehler/Aktionsbedarf: Status zurückgeben, damit du ggf. UI zeigst
    return new Response(JSON.stringify({
      error: String(error?.message || error),
      code: error?.code,
      decline_code: error?.decline_code,
      payment_intent: error?.payment_intent || null,
    }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
