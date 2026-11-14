// Pure and client-safe: the login form reads it in the browser.

const HOME = "/";

// A stand-in origin to resolve `from` against. Whatever resolves to a
// different origin pointed somewhere other than this site.
const BASE = "http://login-redirect.invalid";

/**
 * Where to go after signing in: the page proxy.ts sent the person away from,
 * read from the login page's `from` param.
 *
 * Only a path on this site is followed. The param arrives in a URL anyone can
 * write, so following it as given made /login?from=https://example.com a
 * working phishing link: sign in on the real page, land on someone else's.
 * Resolving it against a fixed origin catches every spelling of an outside
 * address ("//host", "/\host", a tab inside the slashes, "javascript:"),
 * since the URL parser reads them the same way the browser would. Anything
 * else, and the login page itself, goes to the dashboard.
 */
export function loginRedirectPath(from: string | null | undefined): string {
  if (!from || !from.startsWith("/")) return HOME;

  let url: URL;
  try {
    url = new URL(from, BASE);
  } catch {
    return HOME;
  }
  if (url.origin !== BASE || url.pathname === "/login") return HOME;
  return `${url.pathname}${url.search}${url.hash}`;
}
