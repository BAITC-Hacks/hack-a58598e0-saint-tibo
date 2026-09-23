import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./shadcn/button";

const meta = {
  title: "Shared/Controls/Button",
  component: Button,
  args: { children: "Сохранить протокол" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "outline" } };
export const Destructive: Story = {
  args: { variant: "destructive", children: "Удалить запись" },
};
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = {
  args: { disabled: true, children: "Сохранение…" },
};
export const LongLabels: Story = {
  render: () => (
    <div className="flex max-w-96 flex-wrap gap-2">
      <Button>Сохранить протокол совещания</Button>
      <Button variant="outline">Кеңес хаттамасын сақтау</Button>
      <Button variant="secondary">Save the meeting minutes</Button>
    </div>
  ),
};
