import { idInput, mutateAttempt } from "@/lib/contracts/core";
import { nextQuestion } from "@/server/attempts";
import { body, input, route } from "@/server/http";

export const POST = route(["candidate", "examiner"], async (request, params, actor) =>
  nextQuestion(actor, input(idInput, params).id, (await body(request, mutateAttempt)).sessionId), 200, true);
