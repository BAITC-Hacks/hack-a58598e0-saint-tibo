import type { Meta, StoryObj } from "@storybook/react-vite";

import { Card, CardContent, CardHeader, CardTitle } from "./shadcn/card";

const meta = {
  title: "Shared/Surfaces/Card",
  component: Card,
  args: { children: "Карточка" },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MeetingSummary: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader className="border-b border-border">
        <CardTitle className="font-bold text-brand-navy">
          Совещание по проекту
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p>23 сентября · 14:00</p>
        <p className="text-muted-foreground">Протокол готов к проверке.</p>
      </CardContent>
    </Card>
  ),
};
