import type { Meta, StoryObj } from "@storybook/react";
import { PasswordInput } from "./auth-form-primitives";

const meta = {
  title: "Auth/PasswordInput",
  component: PasswordInput,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PasswordInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: "password",
    placeholder: "Enter password",
    autoComplete: "current-password",
  },
};

export const NewPassword: Story = {
  args: {
    name: "newPassword",
    placeholder: "New password",
    autoComplete: "new-password",
    hint: "At least 8 characters",
  },
};

export const WithLabel: StoryObj = {
  render: () => (
    <label style={{ display: "grid", gap: 8, width: 320 }}>
      <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.14em", opacity: 0.5 }}>
        Password
      </span>
      <PasswordInput name="password" placeholder="Enter password" autoComplete="current-password" />
    </label>
  ),
};
