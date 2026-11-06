export type Category = "Classic" | "Sport" | "Minimal" | "Limited";
export type ProductDetails = { subtitle: string; badge: string; color: string; movement: string; caseSize: string; waterResistance: string; material: string };
export type LocalizedProductDetails = { fr: ProductDetails; ar: ProductDetails };
export type EditorialAsset = { slot: "editorialImage"; image: string; en: string; fr: string; ar: string };
export type Product = {
  id: string; slug: string; name: string; subtitle: string; description: string;
  nameFr?: string; nameAr?: string; descriptionFr?: string; descriptionAr?: string;
  localizedDetails?: LocalizedProductDetails;
  price: number; compareAt?: number; category: Category; color: string;
  movement: string; caseSize: string; waterResistance: string; material: string;
  stock: number; images: string[]; featured: boolean; badge?: string;
  /** Optimistic concurrency token; send it back when editing inventory or product details. */
  updatedAt?: string;
};
export type Customer = { name: string; phone: string; city: string; address: string; email?: string; notes?: string };
export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
export type OrderItem = { productId: string; name: string; price: number; quantity: number; image: string };
export type Order = {
  id: string; number: string; customer: Customer; items: OrderItem[];
  subtotal: number; shipping: number; total: number; status: OrderStatus;
  createdAt: string; updatedAt: string;
};
/** Public tracking never returns delivery address, phone, email, or notes. */
export type TrackedOrder = Omit<Order, "customer">;
export type AdminSession = { authenticated: boolean; isAdmin: boolean; user: { email: string; displayName: string } | null; authMethod?: "password" | "chatgpt"; passwordLoginAvailable: boolean; chatGPTLoginAvailable?: boolean };
