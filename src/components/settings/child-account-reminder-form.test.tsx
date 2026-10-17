// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChildAccountReminderForm } from "./child-account-reminder-form";

const actions = vi.hoisted(() => ({
  updateChildAccountEmailReminderSettings: vi.fn().mockResolvedValue({ ok: true }),
  sendChildAccountEmailReminderTest: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/actions/settings", () => actions);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("child account email template preview", () => {
  it("previews the styled email and keeps unsaved edits when reopening the editor", () => {
    render(<ChildAccountReminderForm settings={{
      enabled: true,
      recipientEmail: "owner@example.com",
      sendTime: "09:00",
      smtpUrl: "",
      smtpFrom: "",
      templateSubject: "{spaceName} reminder",
      templateBody: "<p>原始正文</p>",
    }} />);

    fireEvent.click(screen.getByRole("button", { name: "预览模板" }));
    expect(screen.getByText("本期应收金额")).toBeTruthy();
    expect(screen.getByRole("table", { name: "子账号信息" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "编辑模板" }));
    const editor = screen.getByRole("textbox", { name: "邮件正文模板" });
    editor.innerHTML = "<p>请联系 <strong>{contact}</strong></p>";
    fireEvent.input(editor);
    expect(screen.getByText("wx-member", { selector: "strong" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("邮件标题模板"), {
      target: { value: "{spaceName} 续费核实" },
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("US Team 续费核实");

    fireEvent.click(screen.getByRole("button", { name: "收起编辑" }));
    fireEvent.click(screen.getByRole("button", { name: "编辑模板" }));
    expect(screen.getByRole("textbox", { name: "邮件正文模板" }).innerHTML)
      .toBe("<p>请联系 <strong>{contact}</strong></p>");

    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(actions.updateChildAccountEmailReminderSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        templateSubject: "{spaceName} 续费核实",
        templateBody: "<p>请联系 <strong>{contact}</strong></p>",
      }),
    );
  });
});
