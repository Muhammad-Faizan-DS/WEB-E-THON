import { route, body } from "@/server/http";
import { accountImport } from "@/lib/contracts/operations";
import { importUsers } from "@/server/imports";

export const POST = route(["admin"], async (request, _params, actor) => {
  const data = await body(request, accountImport);
  return importUsers(actor.id, data.csv, data.commit);
});
