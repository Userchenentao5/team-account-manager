// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusThresholdForm } from "./status-threshold-form";

const actions = vi.hoisted(() => ({
  updateStatusThresholds: vi.fn().mockResolvedValue({ ok: true }),
  updateSpaceEmailReminderSettings: vi.fn().mockResolvedValue({ ok: true }),
  sendSpaceEmailReminderTest: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/actions/settings", () => actions);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("space expiry email template preview", () => {
  it("previews exact timestamps and retains custom edits across editor toggles", () => {
    render(<StatusThresholdForm thresholds={{ spaceSoonDays: 7, childAccountSoonDays: 7 }} emailReminder={{
      enabled: true,
      recipientEmail: "owner@example.com",
      smtpUrl: "",
      smtpFrom: "",
      templateSubject: "{spaceName} reminder",
      templateBody: "<p>原始正文</p>",
    }} />);

    fireEvent.click(screen.getByRole("button", { name: "预览模板" }));
    expect(screen.getByText("空间到期时间")).toBeTruthy();
    expect(screen.getByText("2026-10-25 09:30:45")).toBeTruthy();
    expect(screen.getByText("25.99 USD")).toBeTruthy();
    expect(screen.getByRole("table", { name: "空间订阅信息" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "编辑模板" }));
    const editor = screen.getByRole("textbox", { name: "邮件正文模板" });
    const body = "<p>请检查 <strong>{paymentChannelName}</strong> 的续费</p>";
    editor.innerHTML = body;
    fireEvent.input(editor);
    expect(screen.getByText("Visa", { selector: "strong" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("邮件标题模板"), {
      target: { value: "{spaceName} 续费核实" },
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("US Team 续费核实");

    fireEvent.click(screen.getByRole("button", { name: "收起编辑" }));
    fireEvent.click(screen.getByRole("button", { name: "编辑模板" }));
    expect(screen.getByRole("textbox", { name: "邮件正文模板" }).innerHTML).toBe(body);

    fireEvent.click(screen.getByRole("button", { name: "发送测试邮件" }));
    expect(actions.sendSpaceEmailReminderTest).toHaveBeenCalledWith(
      expect.objectContaining({ templateSubject: "{spaceName} 续费核实", templateBody: body }),
    );
  });
});
