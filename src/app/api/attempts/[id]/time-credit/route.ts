import { route, body, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { timeCreditInput } from "@/lib/contracts/operations";
import { grantCredit } from "@/server/monitor";

export const POST = route(["examiner"], async (request, params, actor) => grantCredit(actor, input(id, params.id), (await body(request, timeCreditInput)).seconds), 200, true);
