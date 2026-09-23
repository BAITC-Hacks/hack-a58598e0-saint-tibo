import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_API_URL: z.url().default("http://localhost:8000"),
    VITE_API_MODE: z.enum(["real", "mock"]).default("real"),
    VITE_MOCK_API_URL: z.url().default("http://localhost:8015"),
    VITE_APP_TITLE: z.string().min(1).default("Хаттама"),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
