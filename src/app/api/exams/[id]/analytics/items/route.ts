import { route, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { itemStats } from "@/server/analytics";

export const GET = route(["examiner"], (_request, params, actor) => itemStats(actor.id, input(id, params.id)));
