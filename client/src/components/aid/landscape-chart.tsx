"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const data = [
  { category: "Poverty & crisis cash", programs: 6 },
  { category: "Employment & livelihood", programs: 4 },
  { category: "Education & training", programs: 4 },
  { category: "Insurance & inclusion", programs: 4 },
  { category: "Health, housing & crisis", programs: 4 },
  { category: "OFW support", programs: 3 },
  { category: "Agriculture & fisheries", programs: 3 },
  { category: "MSME & enterprise", programs: 3 },
];

const chartConfig = {
  programs: {
    label: "Programs",
    color: "#0040E7",
  },
} satisfies ChartConfig;

export function LandscapeChart() {
  return (
    <section id="landscape" className="bg-white py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#0040E7]">
              The landscape
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold text-[#1a1a2e]">
              31 programs. 8 kinds of need. No single map.
            </h2>
            <p className="mt-4 text-[#64748b]">
              This isn&apos;t only a poverty-alleviation problem — it spans
              livelihood, crisis, agriculture, education and financial
              inclusion. From DSWD&apos;s 4Ps and AICS to DOLE&apos;s TUPAD,
              OWWA&apos;s OFW aid, DA subsidies, TESDA scholarships and
              Pag-IBIG calamity loans, no agency tells a citizen what they
              qualify for <em>across</em> agencies.
            </p>
            <p className="mt-4 text-sm text-[#94a3b8]">
              Even the names collide: &ldquo;AKAP&rdquo; is two different
              programs — DSWD&apos;s inflation relief and OWWA&apos;s OFW cash
              aid. A clear program catalog is table stakes.
            </p>
          </div>

          <div
            className="rounded-2xl border border-[#0040E7]/15 bg-white p-6 shadow-xl shadow-[#0040E7]/5"
            style={{ borderTopWidth: 4, borderTopColor: "#0040E7" }}
          >
            <h3 className="text-sm font-medium text-[#1a1a2e]">
              National aid programs by need category
            </h3>
            <p className="text-xs text-[#94a3b8] mb-4">
              Count of major national programs · idea-validation survey, Jul 2026
            </p>
            <ChartContainer config={chartConfig} className="h-80 w-full">
              <BarChart
                accessibilityLayer
                data={data}
                layout="vertical"
                margin={{ left: 0, right: 24 }}
              >
                <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                <YAxis
                  dataKey="category"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={170}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <ChartTooltip
                  cursor={{ fill: "rgba(0,64,231,0.04)" }}
                  content={<ChartTooltipContent />}
                />
                <Bar
                  dataKey="programs"
                  fill="var(--color-programs)"
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
