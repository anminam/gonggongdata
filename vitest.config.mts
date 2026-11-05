import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export const alias = { "@": fileURLToPath(new URL("./", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // 실제 data.go.kr에 접속하는 테스트는 기본 실행에서 빼고 `npm run test:live`로 따로 돌린다
    exclude: ["tests/live/**", "node_modules/**"],
  },
});
