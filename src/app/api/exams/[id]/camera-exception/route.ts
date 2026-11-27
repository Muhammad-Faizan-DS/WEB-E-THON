import { route, body, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { cameraExceptionInput } from "@/lib/contracts/operations";
import { setCameraException } from "@/server/monitor";

export const POST = route(["examiner"], async (request, params, actor) => setCameraException(actor, input(id, params.id), await body(request, cameraExceptionInput)));
