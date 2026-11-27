import { id, idInput, mutateAttempt } from "@/lib/contracts/core";
import { lockAnswer } from "@/server/attempts";
import { body, input, route } from "@/server/http";

export const POST = route(["candidate", "examiner"], async (request, params, actor) => {
  const data = await body(request, mutateAttempt);
  return lockAnswer(actor, input(idInput, params).id, input(id, params.qid), data.sessionId);
}, 200, true);
