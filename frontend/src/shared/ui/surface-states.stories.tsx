import type { Meta, StoryObj } from "@storybook/react-vite";

import { Alert, AlertDescription, AlertTitle } from "./shadcn/alert";
import { Button } from "./shadcn/button";
import { Empty, EmptyDescription, EmptyTitle } from "./shadcn/empty";
import { Skeleton } from "./shadcn/skeleton";

const meta = {
  title: "Shared/Surfaces/States",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyMeetingList: Story = {
  render: () => (
    <Empty className="border">
      <EmptyTitle>Кездесулер әзірге жоқ</EmptyTitle>
      <EmptyDescription>Жазбаны жүктеу үшін кездесу құрыңыз.</EmptyDescription>
      <Button>Кездесу құру</Button>
    </Empty>
  ),
};

export const Loading: Story = {
  render: () => (
    <output aria-label="Загрузка данных" className="block w-80 space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </output>
  ),
};

export const ErrorWithRetry: Story = {
  render: () => (
    <Alert variant="destructive" className="max-w-md">
      <AlertTitle>Could not load the meeting</AlertTitle>
      <AlertDescription>Your edits remain in the form.</AlertDescription>
      <Button
        size="sm"
        variant="outline"
        className="mt-3"
        onClick={() => window.alert("Retry clicked")}
      >
        Retry
      </Button>
    </Alert>
  ),
};
