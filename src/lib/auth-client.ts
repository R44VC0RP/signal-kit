import { createAuthClient } from "better-auth/react";

/** Browser auth client. Same-origin, so no baseURL is needed. */
export const authClient = createAuthClient({ basePath: "/api/auth" });
