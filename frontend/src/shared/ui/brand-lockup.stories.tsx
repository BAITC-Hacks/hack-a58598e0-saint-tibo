import type { Meta, StoryObj } from "@storybook/react-vite";

import { BrandLockup } from "./brand-lockup";

const meta = {
  title: "Shared/Brand/Lockup",
  component: BrandLockup,
  parameters: { layout: "padded" },
} satisfies Meta<typeof BrandLockup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Header: Story = {
  render: () => (
    <div className="brand-header p-4">
      <BrandLockup />
    </div>
  ),
};
