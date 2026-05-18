import { createRouteHandler } from "uploadthing/next";

// Side-effect import: triggers the boot tripwire in src/server/uploadthing.ts
// so a malformed/prod-leaking UPLOADTHING_TOKEN throws at deploy time on the
// upload path too (otherwise this route initializes the UT SDK independently
// and the tripwire only fires on server actions that call utapi.*).
import "~/server/uploadthing";

import { ourFileRouter } from "./core";

// Export routes for Next App Router
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,

  // Apply an (optional) custom config:
  // config: { ... },
});

// export function GET() {
//   return new Response("Hello, World!");
// }
