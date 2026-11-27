import { route, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { monitor } from "@/server/monitor";

export const GET = route(["examiner", "admin"], (_request, params, actor) => monitor(actor, input(id, params.id)));
