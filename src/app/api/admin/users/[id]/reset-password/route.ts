import { route, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { resetPassword } from "@/server/admin";

export const POST = route(["admin"], (_request, params, actor) => resetPassword(actor.id, input(id, params.id)));
