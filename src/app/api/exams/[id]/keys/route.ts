import { idInput, keysInput } from "@/lib/contracts/core";
import { issueKeys, listKeys } from "@/server/exams";
import { body, input, route } from "@/server/http";

/** Every enrolled candidate with their current key (display form), status, failed tries and use time. */
export const GET = route(["examiner"], (_request, params, actor) => listKeys(actor.id, input(idInput, params).id));
/** Regenerates keys for the given enrollments (revokes the old ones). */
export const POST = route(["examiner"], async (request, params, actor) =>
  issueKeys(actor.id, input(idInput, params).id, (await body(request, keysInput)).enrollmentIds), 201);
