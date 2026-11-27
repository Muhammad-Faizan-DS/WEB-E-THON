import { id, idInput } from "@/lib/contracts/core";
import { getQuestion } from "@/server/attempts";
import { input, route } from "@/server/http";

export const GET = route(["candidate", "examiner"], (request, params, actor) =>
  getQuestion(actor, input(idInput, params).id, input(id, request.headers.get("x-exam-session-id"))), 200, true);
