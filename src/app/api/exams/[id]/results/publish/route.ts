import { route, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { publishResults } from "@/server/grading";

export const POST = route(["examiner"], (_request, params, actor) => publishResults(actor.id, input(id, params.id)));
