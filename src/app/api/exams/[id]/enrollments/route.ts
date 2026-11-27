import { enrollmentInput, idInput } from "@/lib/contracts/core";
import { enrollCandidates, examOwner } from "@/server/exams";
import { body, input, route } from "@/server/http";

/** Examiners enrol on their own exams; administrators may enrol on any exam (audited as the administrator). */
export const POST = route(["examiner", "admin"], async (request, params, actor) => {
  const examId = input(idInput, params).id;
  const owner = actor.role === "admin" ? await examOwner(examId) : actor.id;
  return enrollCandidates(owner, examId, (await body(request, enrollmentInput)).candidates, actor.id);
});
