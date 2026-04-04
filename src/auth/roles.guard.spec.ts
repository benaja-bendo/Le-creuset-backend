import { RolesGuard } from "./roles.guard";
import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";

function createMockExecutionContext(user?: any): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: jest.fn(),
      getNext: jest.fn(),
    }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it("should return true when no roles are required", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);
    const ctx = createMockExecutionContext({ role: "CLIENT" });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("should return true when user has the required role", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["ADMIN"]);
    const ctx = createMockExecutionContext({ role: "ADMIN" });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("should return false when user does not have the required role", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["ADMIN"]);
    const ctx = createMockExecutionContext({ role: "CLIENT" });

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it("should return false when user is undefined", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["ADMIN"]);
    const ctx = createMockExecutionContext(undefined);

    expect(guard.canActivate(ctx)).toBe(false);
  });
});
