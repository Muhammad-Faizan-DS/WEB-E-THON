import { body, input, route } from "@/server/http";
import { id, idInput } from "@/lib/contracts/core";
import { sectionInput, sectionPatch } from "@/lib/contracts/sections";
import { createSection, deleteSection, listSections, updateSection } from "@/server/sections";

export const GET = route(["examiner"], (_request, params, actor) => listSections(actor.id, input(idInput, params).id));
export const POST = route(["examiner"], async (request, params, actor) =>
  createSection(actor.id, input(idInput, params).id, await body(request, sectionInput)), 201);
export const PATCH = route(["examiner"], async (request, params, actor) =>
  updateSection(actor.id, input(idInput, params).id, await body(request, sectionPatch)));
export const DELETE = route(["examiner"], (request, params, actor) =>
  deleteSection(actor.id, input(idInput, params).id, input(id, new URL(request.url).searchParams.get("sectionId"))));
