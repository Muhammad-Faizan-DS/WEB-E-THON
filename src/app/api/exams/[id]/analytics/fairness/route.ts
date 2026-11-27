import { route, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { fairness } from "@/server/analytics";

export const GET = route(["examiner"], (_request, params, actor) => fairness(actor.id, input(id, params.id)));
