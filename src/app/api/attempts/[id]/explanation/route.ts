import { route, body, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { explanationInput } from "@/lib/contracts/operations";
import { submitExplanation } from "@/server/attempts";

export const POST = route(["candidate","examiner"], async (request, params, actor) => {
  const data = await body(request, explanationInput);
  return submitExplanation(actor, input(id, params.id), data.sessionId, data.explanation);
}, 200, true);
