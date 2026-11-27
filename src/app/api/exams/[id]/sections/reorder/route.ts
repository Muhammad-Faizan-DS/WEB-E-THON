import { body, input, route } from "@/server/http";
import { idInput } from "@/lib/contracts/core";
import { sectionReorder } from "@/lib/contracts/sections";
import { reorderSections } from "@/server/sections";

export const PATCH = route(["examiner"], async (request, params, actor) =>
  reorderSections(actor.id, input(idInput, params).id, (await body(request, sectionReorder)).sectionIds));
