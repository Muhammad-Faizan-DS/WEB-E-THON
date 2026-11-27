import { heartbeatInput, idInput } from "@/lib/contracts/core";
import { heartbeat } from "@/server/attempts";
import { body, input, route } from "@/server/http";
import { requireDesktop } from "@/server/start";

export const POST = route(["candidate", "examiner"], async (request, params, actor) => {
  const data = await body(request, heartbeatInput);
  if ("takeover" in data) requireDesktop(data.deviceCheck, request.headers);
  return heartbeat(actor, input(idInput, params).id, "sessionId" in data ? data.sessionId : undefined);
}, 200, true);
