/**
 * @file +layout.ts
 * @brief Page options for the whole app: prerender every route, so the build output is a static site.
 * @note The prerendered HTML shows the "checking" state; WebHID setup runs after hydration, see Connection.start().
 */

export const prerender = true; // static HTML for every route
