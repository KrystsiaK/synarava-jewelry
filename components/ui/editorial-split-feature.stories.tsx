import type { Meta, StoryObj } from "@storybook/react";

import { EditorialSplitFeature } from "./editorial-split-feature";

const SAMPLE_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCeoC4s0GytU2DJHgrs3Y0VtvzJzV8XnZqdlM-zu7Pj5SOSNmgf2fH0UUWquiyWXIKpNLyYe7uIZO3_8XVObSjX88ucZFaSmB7RmcgsRhsPnG7tPGc0n0_G6K7x3a5mstC1CRokMdByQ5QzcXX2nFedtwx42wOm2YsJwOSo6OzbspMc5J8qdpMsI2dZi4z_wUwpmA0QdXlFyhLvOkujl25D4nxEsU7IcGhDLxyZA3K6CO9_k9Sx1YFGtL1eqQjnZEl_HFLyG9-8uxkN";

const meta = {
  title: "UI/EditorialSplitFeature",
  component: EditorialSplitFeature,
  tags: ["autodocs"],
  args: {
    href: "#",
    imageSrc: SAMPLE_IMAGE,
    imageAlt: "Belarus Heritage collection",
    topMeta: (
      <div className="flex items-center gap-4">
        <span className="label-mono text-couture-red">01</span>
        <div className="h-px flex-1 bg-foreground/10" />
      </div>
    ),
    title: (
      <div>
        <p className="label-mono mb-4 text-couture-red">Collection 01</p>
        <h2 className="font-serif leading-[0.92] tracking-tight" style={{ fontSize: "clamp(2rem,4.5vw,4rem)" }}>
          Belarus Heritage
        </h2>
      </div>
    ),
    description:
      "Geometric folk codes, white ceramic, linen rhythm, and sculptural forms rooted in Belarusian symbolic language.",
    action: (
      <div className="flex items-center gap-4">
        <span className="label-caps border-b border-foreground/20 pb-1.5 transition-colors duration-300 group-hover:border-couture-red group-hover:text-couture-red">
          Explore collection
        </span>
        <svg
          className="h-4 w-4 text-couture-red transition-transform duration-300 group-hover:translate-x-2"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1 8h14M9 2l6 6-6 6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    footer: (
      <div className="flex items-center gap-3">
        <div className="h-px w-10 bg-foreground/15" />
        <span className="label-mono text-[0.68rem] text-foreground/30">COL-01</span>
      </div>
    ),
    imageOverlay: (
      <div className="pointer-events-none absolute bottom-4 right-4 select-none">
        <span className="font-serif leading-none text-white/[0.12]" style={{ fontSize: "clamp(5rem,12vw,9rem)" }}>
          01
        </span>
      </div>
    ),
  },
} satisfies Meta<typeof EditorialSplitFeature>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Reversed: Story = {
  args: {
    reversed: true,
  },
};
