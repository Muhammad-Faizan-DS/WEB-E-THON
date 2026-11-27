import { route, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { collusion } from "@/server/analytics";

export const GET = route(["examiner"], (_request, params, actor) => collusion(actor.id, input(id, params.id)));
