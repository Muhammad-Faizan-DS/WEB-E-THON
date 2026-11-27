import { idInput } from "@/lib/contracts/core";
import { attemptState } from "@/server/attempts";
import { input, route } from "@/server/http";

export const GET = route(["candidate", "examiner"], (_request, params, actor) =>
  attemptState(actor, input(idInput, params).id), 200, true);
