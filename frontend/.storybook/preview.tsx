import type { Preview } from "@storybook/react-vite";

import appCss from "#/app/styles/globals.css?url";

const preview: Preview = {
  parameters: {
    layout: "centered",
  },
  globalTypes: {
    theme: {
      description: "Interface theme",
      toolbar: {
        icon: "circlehollow",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (Story, context) => {
      const dark = context.globals.theme === "dark";
      document.documentElement.classList.toggle("dark", dark);
      return (
        <>
          <link rel="stylesheet" href={appCss} />
          <div
            className={
              dark
                ? "dark min-w-80 bg-background p-6 text-foreground"
                : "min-w-80 bg-background p-6 text-foreground"
            }
          >
            <Story />
          </div>
        </>
      );
    },
  ],
};

export default preview;
