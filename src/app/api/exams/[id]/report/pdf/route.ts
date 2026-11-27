import { route, input, fileResponse } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { summaryPdf } from "@/server/reports";

export const GET = route(["examiner"], async (_request, params, actor) => fileResponse(await summaryPdf(actor.id, input(id, params.id)), "secureexam-summary.pdf", "application/pdf"));
