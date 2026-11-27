import { route, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { readSnapshot } from "@/server/monitor";

export const GET = route(["admin","examiner"], (_request, params, actor) => readSnapshot(actor, input(id, params.id)));
