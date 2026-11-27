import { route } from "@/server/http";
import { candidateResults } from "@/server/grading";
import { withVerification } from "@/server/reports";

/** Own visible results only (BR-13), each with question text, percentage, verify code, verify URL and QR image. */
export const GET = route(["candidate"], async (request, _params, actor) => withVerification(await candidateResults(actor.id), request.url));
