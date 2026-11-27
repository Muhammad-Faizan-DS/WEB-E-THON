import { z } from "zod";
import { body, input, route } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { attachQuestions } from "@/lib/contracts/sections";
import { attachToSection, detachFromSection } from "@/server/sections";

const target = z.object({ id, sid: id });

export const POST = route(["examiner"], async (request, params, actor) => {
  const { id: examId, sid } = input(target, params);
  return attachToSection(actor.id, examId, sid, await body(request, attachQuestions));
});
export const DELETE = route(["examiner"], (request, params, actor) => {
  const { id: examId, sid } = input(target, params);
  return detachFromSection(actor.id, examId, sid, input(id, new URL(request.url).searchParams.get("questionId")));
});
