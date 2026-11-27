import { route, input, fileResponse } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { candidatePdf } from "@/server/reports";

export const GET = route(["candidate","examiner"], async (request, params, actor) => fileResponse(await candidatePdf(actor, input(id, params.id), request.url), "secureexam-result.pdf", "application/pdf"));
