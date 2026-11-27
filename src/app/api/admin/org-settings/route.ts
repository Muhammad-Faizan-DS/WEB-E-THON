import { body, route } from "@/server/http";
import { orgSettingsInput } from "@/lib/contracts/operations";
import { readOrgSettings, updateOrgSettings } from "@/server/accounts";

/** Examiners may read it (e.g. to label external invites); only admins change it. */
export const GET = route(["admin", "examiner"], () => readOrgSettings());
export const PUT = route(["admin"], async (request, _params, actor) => updateOrgSettings(actor.id, await body(request, orgSettingsInput)));
