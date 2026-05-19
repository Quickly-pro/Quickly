import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripe = new Stripe(STRIPE_SECRET, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
      },
    });
  }

  try {
    const prices = await stripe.prices.list({
      active: true,
      type: "recurring",
      expand: ["data.product"],
      limit: 20,
    });

    const formatted = prices.data.map((price: any) => {
      const product = price.product as any;
      if (!product || product.deleted) return null;

      const productName = (product.name || "").toLowerCase();
      // Only return premium prices — skip anything with "enterprise" in the name
      if (!productName.includes("premium")) return null;

      const period = price.recurring?.interval === "year" ? "annual" : "monthly";

      return {
        id: price.id,
        plan: "premium",
        period,
        unitAmount: price.unit_amount || 0,
        currency: price.currency,
        interval: price.recurring?.interval || "month",
        productName: product.name || "",
        productDescription: product.description || "",
      };
    }).filter(Boolean);

    return new Response(JSON.stringify({ prices: formatted }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
