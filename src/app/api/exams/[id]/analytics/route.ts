import { route, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { examSummary } from "@/server/analytics";

export const GET = route(["examiner"], (_request, params, actor) => examSummary(actor.id, input(id, params.id)));
