import { route, body, input } from "@/server/http";
import { mutateAttempt, id } from "@/lib/contracts/core";
import { checkViolation } from "@/server/attempts";

export const POST = route(["candidate","examiner"], async (request, params, actor) => checkViolation(actor, input(id, params.id), (await body(request, mutateAttempt)).sessionId), 200, true);
