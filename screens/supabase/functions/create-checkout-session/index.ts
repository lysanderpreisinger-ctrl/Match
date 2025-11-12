import Stripe from "npm:stripe";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId fehlt" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer", "setup_intent.payment_method", "payment_intent.payment_method"],
    });

    const customerId = (session.customer as Stripe.Customer | string) && typeof session.customer !== "string"
      ? (session.customer as Stripe.Customer).id
      : (session.customer as string | null);

    // Wenn setup-Checkout: PaymentMethod hängt am SetupIntent
    let paymentMethodId: string | null = null;
    if (session.setup_intent && typeof session.setup_intent !== "string") {
      const si = session.setup_intent as Stripe.SetupIntent;
      paymentMethodId = typeof si.payment_method === "string" ? si.payment_method : (si.payment_method?.id ?? null);
    }

    // Fallback: aus PaymentIntent (bei Einmalkauf-Checkout)
    if (!paymentMethodId && session.payment_intent && typeof session.payment_intent !== "string") {
      const pi = session.payment_intent as Stripe.PaymentIntent;
      paymentMethodId = typeof pi.payment_method === "string" ? pi.payment_method : (pi.payment_method?.id ?? null);
    }

    return new Response(JSON.stringify({
      session: { id: session.id, mode: session.mode, status: session.status },
      customerId,
      paymentMethodId,
    }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
