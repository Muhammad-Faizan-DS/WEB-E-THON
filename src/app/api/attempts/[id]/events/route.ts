import { route, body, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { eventInput } from "@/lib/contracts/operations";
import { submitSignal } from "@/server/attempts";

export const POST = route(["candidate","examiner"], async (request, params, actor) => submitSignal(actor, input(id, params.id), await body(request, eventInput)), 200, true);
