// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { GuestNicknameField } from "../src/components/GuestNicknameField";
afterEach(cleanup);
function Field() {
  const [value, setValue] = useState("visitor");
  return <GuestNicknameField value={value} onChange={setValue} />;
}
it("keeps a noneditable prefix when clearing or replacing the suffix and counts graphemes", () => {
  render(<Field />);
  const input = screen.getByRole("textbox", {
    name: "上榜昵称",
  }) as HTMLInputElement;
  expect(input.value).toBe("");
  fireEvent.change(input, { target: { value: "小云" } });
  expect(screen.getByText("visitor小云")).toBeTruthy();
  fireEvent.change(input, { target: { value: "" } });
  expect(screen.getByLabelText("固定前缀 visitor").textContent).toBe("visitor");
  fireEvent.change(input, { target: { value: "👨‍👩‍👧‍👦".repeat(9) } });
  expect(input.getAttribute("aria-invalid")).toBe("true");
  fireEvent.change(input, { target: { value: "😀".repeat(9) } });
  expect(input.getAttribute("aria-invalid")).toBe("false");
  fireEvent.change(input, { target: { value: "😀".repeat(10) } });
  expect(input.getAttribute("aria-invalid")).toBe("true");
});
it("accepts pasting a complete name into the empty suffix without duplicating visitor", () => {
  render(<Field />);
  const input = screen.getByRole("textbox", {
    name: "上榜昵称",
  }) as HTMLInputElement;
  fireEvent.paste(input, { clipboardData: { getData: () => "visitor小云" } });
  expect(input.value).toBe("小云");
  expect(screen.getByText("visitor小云")).toBeTruthy();
});
