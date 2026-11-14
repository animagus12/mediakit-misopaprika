"use client";

// Below the group's layout, so a failing home page keeps its sidebar. A
// failure in the layout itself falls through to app/error.tsx.
export { default } from "@/components/common/RouteError";
