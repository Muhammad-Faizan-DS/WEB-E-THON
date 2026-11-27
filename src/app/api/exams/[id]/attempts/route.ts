import { idInput, startInput } from "@/lib/contracts/core";
import { body, input, route } from "@/server/http";
import { startAttempt } from "@/server/start";

export const POST = route(["candidate", "examiner"], async (request, params, actor) =>
  startAttempt(actor, input(idInput, params).id, await body(request, startInput), request.headers), 201, true);
