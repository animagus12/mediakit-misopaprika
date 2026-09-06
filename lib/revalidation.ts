import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Which pages surface which store.
 *
 * Every server action used to list its own revalidatePath() calls, and each
 * one was a chance to forget a page: a payment marked received updated the
 * dashboard but left /invoices showing the old status, because that action
 * happened not to name it. The routes a store appears on is a property of the
 * store, not of the action doing the writing, so it is recorded once here and
 * actions declare only what they wrote.
 *
 * Keep an entry in step with the page that reads it: if a page starts reading
 * a new store, add the route here rather than to the action.
 */
const ROUTES = {
  campaigns: ["/", "/campaigns", "/brands", "/brands/[id]"],
  invoices: ["/", "/invoices", "/invoices/[id]", "/invoices/new", "/brands/[id]"],
  brands: ["/", "/campaigns", "/brands", "/brands/[id]", "/invoices/[id]", "/invoices/new"],
  contacts: ["/", "/brands", "/brands/[id]", "/invoices/[id]", "/invoices/new"],
  agencies: ["/", "/brands", "/brands/[id]"],
  editors: ["/", "/workspace"],
  editorTransactions: ["/", "/workspace", "/brands/[id]", "/invoices/[id]", "/invoices/new"],
  brandNotes: ["/brands/[id]"],
  campaignContacts: ["/brands/[id]"],
  invoiceDefaults: ["/invoices/new", "/invoices/[id]"],
} as const satisfies Record<string, readonly string[]>;

export type RevalidatedStore = keyof typeof ROUTES;

/**
 * Marks every page that reads any of `stores` for revalidation.
 *
 * A route carrying a dynamic segment is passed with the "page" type, which
 * revalidatePath() requires for a pattern and which covers every id rather
 * than one: a brand's detail page shows campaigns and invoices belonging to
 * that brand, and the writer rarely knows which brand is on screen.
 */
export function revalidateStores(...stores: RevalidatedStore[]): void {
  const routes = new Set(stores.flatMap((store) => ROUTES[store] as readonly string[]));
  for (const route of routes) {
    if (route.includes("[")) revalidatePath(route, "page");
    else revalidatePath(route);
  }
}
