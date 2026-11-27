import { z } from "zod";
import { body, input, route } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { sectionImport } from "@/lib/contracts/sections";
import { importIntoSection } from "@/server/sections";

export const POST = route(["examiner"], async (request, params, actor) => {
  const { id: examId, sid } = input(z.object({ id, sid: id }), params);
  const data = await body(request, sectionImport);
  return importIntoSection(actor.id, examId, sid, { ...data, commit: data.commit || new URL(request.url).searchParams.get("commit") === "true" });
});
