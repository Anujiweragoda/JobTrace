import app from "../src/index";

// Vercel's Node runtime natively supports Express request handlers. Exporting
// the app directly preserves the original `/api/*` path; wrapping it with
// serverless-http can strip the path after a rewrite and leave Express waiting
// on an unmatched request until the invocation times out.
export default app;
