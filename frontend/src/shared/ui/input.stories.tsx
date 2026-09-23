import type { Meta, StoryObj } from "@storybook/react-vite";

import { Input } from "./shadcn/input";

const meta = {
  title: "Shared/Controls/Input",
  component: Input,
  args: { id: "meeting-title", placeholder: "Название совещания" },
  decorators: [
    (Story) => (
      <div className="w-72">
        <label htmlFor="meeting-title" className="mb-1 block text-sm font-bold">
          Название совещания
        </label>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Invalid: Story = {
  args: { "aria-invalid": true, "aria-describedby": "meeting-title-error" },
  render: (args) => (
    <>
      <Input {...args} />
      <p
        id="meeting-title-error"
        role="alert"
        className="mt-1 text-sm text-destructive"
      >
        Введите название
      </p>
    </>
  ),
};
export const Disabled: Story = { args: { disabled: true, value: "Совещание" } };
