// Anonymous first-party identifier used to count unique visitors on /mediakit.
// Not a security token — worst case of tampering is a slightly inflated count.
export const VISITOR_COOKIE = "mk_visitor_id";
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
