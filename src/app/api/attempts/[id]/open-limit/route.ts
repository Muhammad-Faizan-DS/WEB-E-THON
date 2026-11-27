import { route, body, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { liveLimitInput } from "@/lib/contracts/operations";
import { raiseLimit } from "@/server/monitor";

export const POST = route(["examiner"], async (request, params, actor) => raiseLimit(actor, input(id, params.id), await body(request, liveLimitInput)), 200, true);
