import { route, body, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { regradeInput } from "@/lib/contracts/operations";
import { gradeAnswer } from "@/server/grading";

export const POST = route(["examiner"], async (request, params, actor) => {
  const data = await body(request, regradeInput);
  return gradeAnswer(actor.id, data.attemptId, data.qid, data, input(id, params.id));
});
