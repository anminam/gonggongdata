import { defineConfig } from "vitest/config";
import { alias } from "./vitest.config.mts";

// 실제 data.go.kr 접속 테스트 (읽기 전용, DB 저장·메일 발송 없음)
export default defineConfig({
  resolve: { alias },
  test: { environment: "node", include: ["tests/live/**/*.test.ts"], testTimeout: 30_000 },
});
