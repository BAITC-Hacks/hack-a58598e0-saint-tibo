import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
} from "better-auth/api";
import { z } from "zod";

import { adminRoles } from "#/shared/auth/index.server";

const roleSchema = z.enum(Object.keys(adminRoles));

const mutationSchema = z.object({
  userId: z.string().optional(),
  role: z.unknown().optional(),
  password: z.string().optional(),
  data: z.object({ role: z.unknown().optional() }).optional(),
});

export const guardAdminChanges = createAuthMiddleware(async (context) => {
  // `/admin/update-user` can also write `role`, so it belongs here even though the
  // access-control statements do not grant `user:update` today.
  if (
    ![
      "/admin/set-role",
      "/admin/create-user",
      "/admin/update-user",
      "/admin/remove-user",
      "/admin/ban-user",
    ].includes(context.path)
  ) {
    return;
  }
  const parsed = mutationSchema.safeParse(context.body);
  if (!parsed.success) {
    throw new APIError("BAD_REQUEST", { message: "Invalid account change." });
  }
  const body = parsed.data;
  const role = body.role ?? body.data?.role;
  if (role !== undefined && !roleSchema.safeParse(role).success) {
    throw new APIError("BAD_REQUEST", {
      message: "Choose exactly one supported role.",
    });
  }
  if (context.path === "/admin/create-user") {
    if (
      (context.request || context.headers) &&
      body.password !== undefined &&
      body.password.length < context.context.password.config.minPasswordLength
    ) {
      throw new APIError("BAD_REQUEST", {
        message: "Password must contain at least 8 characters.",
      });
    }
    return;
  }
  const session = await getAuthoritativeSessionFromCtx(context);
  if (session && session.user.id === body.userId) {
    throw new APIError("FORBIDDEN", {
      message:
        "An administrator cannot change their own role or block themselves.",
    });
  }
});
