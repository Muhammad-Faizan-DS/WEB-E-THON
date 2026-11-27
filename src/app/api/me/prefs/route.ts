import { route, body } from "@/server/http";
import { workspacePrefs } from "@/lib/contracts/operations";
import { readPrefs, savePrefs } from "@/server/admin";

export const GET = route(["admin","examiner","candidate"], (_request, _params, actor) => readPrefs(actor.id));
export const PUT = route(["admin","examiner","candidate"], async (request, _params, actor) => savePrefs(actor.id, await body(request, workspacePrefs)));
