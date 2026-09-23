import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  hasAnyPermission,
  hasEveryPermission,
  hasPermission,
} from "./permissions";

await test("anonymous access always denies permissions", () => {
  assert.equal(hasPermission(null, "users:manage"), false);
  assert.equal(hasAnyPermission(undefined, ["profile:read"]), false);
  assert.equal(hasEveryPermission(null, ["profile:read"]), false);
});

await test("checks effective server permissions without inferring administrator rights", () => {
  const access = { permissions: ["profile:read"] as const };
  const permissions = { permissions: [...access.permissions] };
  assert.equal(hasPermission(permissions, "profile:read"), true);
  assert.equal(hasPermission(permissions, "users:manage"), false);
});

await test("all and any permission checks have distinct semantics", () => {
  const access = { permissions: ["profile:read" as const] };
  assert.equal(
    hasEveryPermission(access, ["profile:read", "users:manage"]),
    false
  );
  assert.equal(
    hasAnyPermission(access, ["profile:read", "users:manage"]),
    true
  );
  assert.equal(hasEveryPermission(access, ["profile:read"]), true);
});

await test("empty requirements fail closed", () => {
  assert.equal(hasEveryPermission({ permissions: [] }, []), false);
  assert.equal(hasAnyPermission({ permissions: [] }, []), false);
});
