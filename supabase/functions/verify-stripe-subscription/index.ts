import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripe = new Stripe(STRIPE_SECRET, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return json({ error: "Missing sessionId" }, 400);
    }

    // Retrieve checkout session from Stripe with subscription expanded
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid") {
      return json({ error: "Payment not completed" }, 402);
    }

    const subscription = session.subscription as Stripe.Subscription;
    if (!subscription) {
      return json({ error: "No subscription found" }, 400);
    }

    const userId = session.metadata?.supabase_user_id;
    const plan = session.metadata?.plan || "premium";

    if (!userId) {
      return json({ error: "Missing user metadata" }, 400);
    }

    // Only include columns that exist in the subscriptions table schema
    const payload = {
      user_id: userId,
      status: "active",
      plan,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : (session.customer as any)?.id || null,
      stripe_subscription_id: subscription.id,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    };

    // Upsert: try update existing, else insert
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", existing.id);

      if (error) return json({ error: error.message }, 500);
    } else {
      const { error } = await supabaseAdmin.from("subscriptions").insert(payload);
      if (error) return json({ error: error.message }, 500);
    }

    return json({
      success: true,
      plan,
      status: "active",
      current_period_end: payload.current_period_end,
    });
  } catch (err: any) {
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
