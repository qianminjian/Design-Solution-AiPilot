import { describe, it, expect, vi, beforeEach } from "vitest";
import { PinoLoggerService } from "../../../src/infra/logger";

/**
 * PinoLoggerService 单元测试
 *
 * 验证：
 *  - NestJS LoggerService 接口方法到 pino 级别的映射
 *    log→info / error→error / warn→warn / debug→debug / verbose→trace / fatal→fatal
 *  - 字符串/对象/Error 三类消息体的写入分支
 *  - context 字段映射为 logger_name
 *  - error 方法的 trace 参数映射为 stack 字段
 */
describe("PinoLoggerService", () => {
  let service: PinoLoggerService;
  let pinoInfoSpy: ReturnType<typeof vi.fn>;
  let pinoErrorSpy: ReturnType<typeof vi.fn>;
  let pinoWarnSpy: ReturnType<typeof vi.fn>;
  let pinoDebugSpy: ReturnType<typeof vi.fn>;
  let pinoTraceSpy: ReturnType<typeof vi.fn>;
  let pinoFatalSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // 通过 mock 拦截 pino 内部方法
    // 直接通过 prototype 替换 logger（pino 实例）
    // 由于 PinoLoggerService 持有 readonly pino，需要通过 spy 替换方法
    pinoInfoSpy = vi.fn();
    pinoErrorSpy = vi.fn();
    pinoWarnSpy = vi.fn();
    pinoDebugSpy = vi.fn();
    pinoTraceSpy = vi.fn();
    pinoFatalSpy = vi.fn();

    service = new PinoLoggerService();
    // 通过 Object.defineProperty 注入 mock，绕过 readonly
    const pinoMock = {
      info: pinoInfoSpy,
      error: pinoErrorSpy,
      warn: pinoWarnSpy,
      debug: pinoDebugSpy,
      trace: pinoTraceSpy,
      fatal: pinoFatalSpy,
    };
    Object.defineProperty(service, "pino", {
      value: pinoMock,
      writable: true,
      configurable: true,
    });
  });

  describe("NestJS LoggerService 方法到 pino 级别映射", () => {
    it("log() 应调用 pino.info", () => {
      service.log("hello", "AppContext");
      expect(pinoInfoSpy).toHaveBeenCalledTimes(1);
    });

    it("warn() 应调用 pino.warn", () => {
      service.warn("warning", "AppContext");
      expect(pinoWarnSpy).toHaveBeenCalledTimes(1);
    });

    it("debug() 应调用 pino.debug", () => {
      service.debug("debug info", "AppContext");
      expect(pinoDebugSpy).toHaveBeenCalledTimes(1);
    });

    it("verbose() 应调用 pino.trace", () => {
      service.verbose("verbose info", "AppContext");
      expect(pinoTraceSpy).toHaveBeenCalledTimes(1);
    });

    it("fatal() 应调用 pino.fatal", () => {
      service.fatal("fatal error", "AppContext");
      expect(pinoFatalSpy).toHaveBeenCalledTimes(1);
    });

    it("error() 应调用 pino.error", () => {
      service.error("error msg", undefined, "AppContext");
      expect(pinoErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("消息体写入分支", () => {
    it("字符串消息应作为 pino 第二参数传入", () => {
      service.log("hello world", "Ctx");
      expect(pinoInfoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ logger_name: "Ctx" }),
        "hello world",
      );
    });

    it("对象消息应展开合并到 payload", () => {
      service.log({ userId: 42, action: "login" }, "Ctx");
      expect(pinoInfoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          logger_name: "Ctx",
          userId: 42,
          action: "login",
        }),
      );
    });

    it("Error 对象应作为 err 字段传入，message 提取为消息", () => {
      const err = new Error("boom");
      service.error(err, undefined, "Ctx");
      expect(pinoErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          logger_name: "Ctx",
          err,
        }),
        "boom",
      );
    });

    it("未传 context 时 logger_name 默认 Application", () => {
      service.log("no context");
      expect(pinoInfoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ logger_name: "Application" }),
        "no context",
      );
    });

    it("error 方法的 trace 参数应映射为 stack 字段", () => {
      service.error("msg", "stack trace content", "Ctx");
      expect(pinoErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          logger_name: "Ctx",
          stack: "stack trace content",
        }),
        "msg",
      );
    });

    it("空字符串 trace 不应写入 stack", () => {
      service.error("msg", "", "Ctx");
      expect(pinoErrorSpy).toHaveBeenCalledWith(
        expect.not.objectContaining({ stack: "" }),
        "msg",
      );
    });

    it("非字符串非对象消息应转为字符串", () => {
      service.log(42 as unknown as string, "Ctx");
      expect(pinoInfoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ logger_name: "Ctx" }),
        "42",
      );
    });
  });
});
