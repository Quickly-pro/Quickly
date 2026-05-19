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
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
      },
    });
  }

  try {
    // Search for active prices that are recurring (subscription mode)
    const prices = await stripe.prices.list({
      active: true,
      type: "recurring",
      expand: ["data.product"],
      limit: 10,
    });

    const products: Record<string, any> = {};
    const formatted = prices.data.map((price: any) => {
      const product = price.product as any;
      if (!product) return null;

      const lookupKey = price.lookup_key || "";
      const productName = (price.product as any)?.name?.toLowerCase() || "";
      const unitAmount = price.unit_amount || 0; // en céntimos
      let plan = "premium";
      let period = "monthly";

      // 1º: usar lookup_key si está configurado
      if (lookupKey.includes("enterprise")) plan = "enterprise";
      else if (lookupKey.includes("premium")) plan = "premium";
      // 2º: usar nombre del producto
      else if (productName.includes("enterprise")) plan = "enterprise";
      else if (productName.includes("premium")) plan = "premium";
      // 3º: usar precio como heurística (>= 4000 céntimos = enterprise)
      else if (unitAmount >= 4000) plan = "enterprise";
      else plan = "premium";

      if (lookupKey.includes("annual")) period = "annual";
      else if (lookupKey.includes("monthly")) period = "monthly";
      else if (price.recurring?.interval === "year") period = "annual";
      else if (price.recurring?.interval === "month") period = "monthly";

      return {
        id: price.id,
        plan,
        period,
        unitAmount: price.unit_amount || 0,
        currency: price.currency,
        interval: price.recurring?.interval || "month",
        productName: product.name || "",
        productDescription: product.description || "",
      };
    }).filter(Boolean);

    // Group by plan
    const grouped = { premium: { monthly: null as any, annual: null as any }, enterprise: { monthly: null as any, annual: null as any } };
    for (const item of formatted) {
      if (grouped[item.plan]) {
        grouped[item.plan][item.period] = item;
      }
    }

    return new Response(JSON.stringify({ prices: formatted, grouped }), {
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
