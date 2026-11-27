import { idInput, keysInput } from "@/lib/contracts/core";
import { issueKeys } from "@/server/exams";
import { body, input, route } from "@/server/http";

export const POST = route(["examiner"], async (request, params, actor) =>
  issueKeys(actor.id, input(idInput, params).id, (await body(request, keysInput)).enrollmentIds), 201);
