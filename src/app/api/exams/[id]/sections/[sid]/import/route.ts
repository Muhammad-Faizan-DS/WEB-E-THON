import { z } from "zod";
import { body, input, requestBytes, route } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { sectionImport } from "@/lib/contracts/sections";
import { importIntoSection } from "@/server/sections";
import { previewQuestions } from "@/server/imports";
import { maxArchiveBytes, previewArchive } from "@/server/question-archive";

export const POST = route(["examiner"], (request, params, actor) => {
  const { id: examId, sid } = input(z.object({ id, sid: id }), params);
  const commit = new URL(request.url).searchParams.get("commit") === "true";
  return importIntoSection(actor.id, examId, sid, async () => {
    const mime = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (mime === "application/zip" || mime === "application/x-zip-compressed") {
      return { ...await previewArchive(await requestBytes(request, maxArchiveBytes)), commit };
    }
    const data = await body(request, sectionImport);
    return { ...previewQuestions(data), commit: commit || data.commit, course: data.course, tags: data.tags };
  });
});
