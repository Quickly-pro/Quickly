import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripe = new Stripe(STRIPE_SECRET, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

// Lookup price from Stripe by matching product name — this is the source of truth.
// We ignore any priceId passed by the frontend to avoid stale/wrong IDs.
async function findPriceId(plan: string, annual: boolean): Promise<string | null> {
  try {
    const prices = await stripe.prices.list({
      active: true,
      type: "recurring",
      expand: ["data.product"],
      limit: 50,
    });

    const interval = annual ? "year" : "month";

    // Filter prices whose product name clearly matches the requested plan.
    // We prefer products whose name starts with "quickly" to skip old/test products.
    const candidates = prices.data.filter((price: any) => {
      const product = price.product as any;
      if (!product || product.deleted) return false;
      const name = (product.name || "").toLowerCase();
      const priceInterval = price.recurring?.interval;
      if (priceInterval !== interval) return false;

      if (plan === "enterprise") {
        return name.includes("enterprise");
      } else {
        // premium: must include "premium" but NOT "enterprise"
        return name.includes("premium") && !name.includes("enterprise");
      }
    });

    if (candidates.length === 0) return null;

    // Prefer products whose name starts with "quickly" (the current products)
    const preferred = candidates.find((price: any) => {
      const name = ((price.product as any)?.name || "").toLowerCase();
      return name.startsWith("quickly");
    });

    return (preferred || candidates[0]).id;
  } catch {
    return null;
  }
}

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

    // Always resolve price server-side — never trust the client-supplied priceId
    const priceId = await findPriceId(plan, !!annual);

    if (!priceId) {
      const period = annual ? "anual" : "mensual";
      return new Response(
        JSON.stringify({
          error: `No se encontró el precio ${period} del plan ${plan} en Stripe. Verifica que el producto esté activo.`,
        }),
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
