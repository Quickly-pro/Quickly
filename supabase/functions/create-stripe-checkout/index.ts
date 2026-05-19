import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripe = new Stripe(STRIPE_SECRET, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

// Hardcoded Stripe Price IDs — verified manually from Stripe dashboard
const PRICE_MAP: Record<string, string> = {
  premium_monthly:    "price_1TVAN7Ps4Jcmx8yrRzGWR1hI",
  premium_annual:     "price_1TXTKTPs4Jcmx8yrsBco7NXH",
  enterprise_monthly: "price_1TXwAUPs4Jcmx8yrtMbKq5D8",
  enterprise_annual:  "price_1TXwBLPs4Jcmx8yrfV4uzGAh",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { plan, annual, userId, email } = body;

    if (!plan || !userId) {
      return new Response(JSON.stringify({ error: "Missing plan or userId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const key = `${plan}_${annual ? "annual" : "monthly"}`;
    const priceId = PRICE_MAP[key];

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `Precio no configurado para: ${key}` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create or reuse Stripe customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId = customers.data[0]?.id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${Deno.env.get("SITE_URL") || "http://localhost:5173"}/upgrade-premium?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get("SITE_URL") || "http://localhost:5173"}/upgrade-premium?canceled=true`,
      metadata: { supabase_user_id: userId, plan },
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
