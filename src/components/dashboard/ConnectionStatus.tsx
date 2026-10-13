import type { PublicConnection } from "@/lib/connections/public";
import { Status } from "./ui";

export function ConnectionStatus({ connection }: { connection: PublicConnection }) {
  if (connection.status === "needs_reauth") {
    return <Status tone="warn">Needs reconnect</Status>;
  }
  if (connection.status === "error") {
    return <Status tone="error">Error</Status>;
  }
  return <Status tone="ok">Connected</Status>;
}
