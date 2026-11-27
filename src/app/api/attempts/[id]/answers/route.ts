import { idInput, saveInput } from "@/lib/contracts/core";
import { saveAnswers } from "@/server/attempts";
import { body, input, route } from "@/server/http";

export const PUT = route(["candidate", "examiner"], async (request, params, actor) =>
  saveAnswers(actor, input(idInput, params).id, await body(request, saveInput)), 200, true);
