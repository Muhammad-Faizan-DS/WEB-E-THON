import { idInput } from "@/lib/contracts/core";
import { enrollmentRemoval } from "@/lib/contracts/operations";
import { removeEnrollment } from "@/server/exams";
import { body, input, route } from "@/server/http";

/** Remove a candidate with a reason (min 10 characters). Examiner of the exam or administrator. */
export const POST = route(["examiner", "admin"], async (request, params, actor) => {
  const { enrollmentId, reason } = await body(request, enrollmentRemoval);
  return removeEnrollment(actor, input(idInput, params).id, enrollmentId, reason);
});
