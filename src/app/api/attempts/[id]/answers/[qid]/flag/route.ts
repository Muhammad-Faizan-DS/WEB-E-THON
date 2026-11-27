import { id, idInput, flagInput } from "@/lib/contracts/core";
import { flagAnswer } from "@/server/attempts";
import { body, input, route } from "@/server/http";

export const POST = route(["candidate", "examiner"], async (request, params, actor) => {
  const data = await body(request, flagInput);
  return flagAnswer(actor, input(idInput, params).id, input(id, params.qid), data.sessionId, data.flagged);
}, 200, true);
