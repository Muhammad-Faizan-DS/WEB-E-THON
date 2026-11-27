import { route, body, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { gradeInput } from "@/lib/contracts/operations";
import { gradeAnswer } from "@/server/grading";

export const PATCH = route(["examiner"], async (request, params, actor) => gradeAnswer(actor.id, input(id, params.attemptId), input(id, params.qid), await body(request, gradeInput)));
