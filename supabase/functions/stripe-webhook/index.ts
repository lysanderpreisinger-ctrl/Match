// supabase/functions/stripe-webhook/index.ts
import Stripe from "npm:stripe@16.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET"); // <-- gleich setzen!

const stripe = new Stripe(STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: Stripe.Event;

  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      console.error("⚠️ STRIPE_WEBHOOK_SECRET not set");
      return new Response(JSON.stringify({ error: "Webhook secret not set" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    event = stripe.webhooks.constructEvent(
      rawBody,
      sig!,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Supabase Client in Edge Function
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = await import("npm:@supabase/supabase-js@2.48.0").then(
    (m) => m.createClient(supabaseUrl, supabaseServiceKey)
  );

  try {
    switch (event.type) {
      /**
       * 1) Checkout abgeschlossen (Abo)
       */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // wichtig: bei Abos hängt die Subscription-ID dran
        const subscriptionId = session.subscription as string | null;
        const customerId = session.customer as string | null;

        // Wir holen uns die Subscription aus Stripe, um mehr Infos zu haben
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId
          );

          // wir brauchen einen user in Supabase → wir speichern später den Stripe-Customer beim User
          // -> also stripe_customers.user_id über stripe_customer_id finden
          const { data: stripeCustomer } = await supabase
            .from("stripe_customers")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();

          if (stripeCustomer?.user_id) {
            await supabase.from("stripe_subscriptions").upsert(
              {
                user_id: stripeCustomer.user_id,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscription.id,
                plan_name: subscription.items?.data?.[0]?.price?.nickname || null,
                status: subscription.status,
                current_period_start: new Date(
                  subscription.current_period_start * 1000
                ).toISOString(),
                current_period_end: new Date(
                  subscription.current_period_end * 1000
                ).toISOString(),
                cancel_at_period_end: subscription.cancel_at_period_end,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: "stripe_subscription_id",
              }
            );

            // optional: im Profil speichern
            await supabase
              .from("profiles")
              .update({
                subscription_plan:
                  subscription.items?.data?.[0]?.price?.nickname ||
                  "stripe-plan",
                updated_at: new Date().toISOString(),
              })
              .eq("id", stripeCustomer.user_id);
          }
        }

        break;
      }

      /**
       * 2) Abo wurde aktualisiert (Pause, Kündigung, verlängert)
       */
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: stripeCustomer } = await supabase
          .from("stripe_customers")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (stripeCustomer?.user_id) {
          await supabase
            .from("stripe_subscriptions")
            .update({
              status: subscription.status,
              current_period_start: new Date(
                subscription.current_period_start * 1000
              ).toISOString(),
              current_period_end: new Date(
                subscription.current_period_end * 1000
              ).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscription.id);

          if (event.type === "customer.subscription.deleted") {
            await supabase
              .from("profiles")
              .update({
                subscription_plan: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", stripeCustomer.user_id);
          }
        }

        break;
      }

      default:
        console.log("ℹ️ Unhandled event type", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("❌ Error handling event:", err);
    return new Response(JSON.stringify({ error: "Webhook error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
