// Vercel's catch-all function entry point. The backend is pre-built so the
// function bundle receives plain JavaScript rather than relying on the
// platform's TypeScript resolution for NodeNext ".js" import specifiers.
export { default } from "../backend/dist/vercel.js";
