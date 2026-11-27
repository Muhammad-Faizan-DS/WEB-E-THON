import { enrollmentInput, idInput } from "@/lib/contracts/core";
import { enrollCandidates } from "@/server/exams";
import { body, input, route } from "@/server/http";

export const POST = route(["examiner"], async (request, params, actor) =>
  enrollCandidates(actor.id, input(idInput, params).id, (await body(request, enrollmentInput)).candidates));
