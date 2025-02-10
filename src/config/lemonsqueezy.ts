import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";

if (!process.env.LEMONSQUEEZY_API_KEY) {
  throw new Error('LEMONSQUEEZY_API_KEY is not defined');
}

lemonSqueezySetup({
  apiKey: process.env.LEMONSQUEEZY_API_KEY,
  onError: (error) => console.error("LemonSqueezy Error:", error),
});

export { createCheckout } from "@lemonsqueezy/lemonsqueezy.js"; 