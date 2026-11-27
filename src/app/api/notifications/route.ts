import { body, route } from "@/server/http";
import { notificationRead } from "@/lib/contracts/operations";
import { listNotifications, markNotificationsRead } from "@/server/notifications";

/** The signed-in user's notification bar: latest 30 and the unread count. */
export const GET = route(["candidate", "examiner", "admin"], (_request, _params, actor) => listNotifications(actor.id));
export const POST = route(["candidate", "examiner", "admin"], async (request, _params, actor) =>
  markNotificationsRead(actor.id, await body(request, notificationRead)));
