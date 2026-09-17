export const PLANS = {
  sale_rent: { label: "Houses for Sale / Rent", price: 5000, categories: ["sale", "rent"] },
  shortlet: { label: "Shortlet Apartments", price: 10000, categories: ["shortlet"] },
  hotel: { label: "Hotels", price: 35000, categories: ["hotel"] },
  land: { label: "Land for Sale", price: 5000, categories: ["land"] }
};

export const CATEGORY_LABELS = {
  sale: "For Sale",
  rent: "For Rent",
  shortlet: "Shortlets",
  hotel: "Hotels",
  land: "Land"
};

export const PERIOD_LABELS = {
  total: "",
  per_year: "/year",
  per_month: "/month",
  per_night: "/night"
};

export const ADMIN_EMAIL = "samuelivere92@gmail.com";

// Every "Book", "Buy", and "Inquire" action deep-links to this WhatsApp
// number, addressed to HSPR ADMIN, in addition to being saved to the DB
// and (for inquiries) emailed to ADMIN_EMAIL.
export const ADMIN_WHATSAPP = "2348146730044";

export const whatsappLink = (message) =>
  `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`;

export const isAdmin = (user) =>
  !!user && (user.email === ADMIN_EMAIL || user.role === "admin");

export const hasActiveSubscription = (user) =>
  !!user &&
  user.subscription_active &&
  user.subscription_expires &&
  new Date(user.subscription_expires) >= new Date();

// "Da Bros" — peer marketplace section. First post is free; every post
// after that requires an active biweekly subscription.
export const BROS_PRICE = 20000;
export const BROS_PERIOD_DAYS = 14;

export const hasActiveBrosSubscription = (user) =>
  !!user &&
  user.bros_subscription_active &&
  user.bros_subscription_expires &&
  new Date(user.bros_subscription_expires) >= new Date();

export const formatPrice = (n) => "₦" + Number(n || 0).toLocaleString();