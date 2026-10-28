// Vercel's API function entry point. Every /api/* path is rewritten here so
// Express receives the original URL, including nested routes such as
// /api/cases/:caseId. The backend is pre-built so the function bundle receives
// plain JavaScript rather than relying on the platform's TypeScript resolution
// for NodeNext ".js" import specifiers.
export { default } from "../backend/dist/vercel.js";
