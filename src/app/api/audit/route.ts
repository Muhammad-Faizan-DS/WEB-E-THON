import { route } from "@/server/http";
import { listAudit } from "@/server/admin";

export const GET = route(["admin", "examiner"], (_request, _params, actor) => listAudit(actor.role === "examiner" ? actor.id : undefined));
