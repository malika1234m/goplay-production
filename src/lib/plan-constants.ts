// Client-safe constants — no server imports here

export const REGISTRATION_FEE = 2500;

export const PLAN_CONFIG = {
  STARTER: {
    label:                   "Starter",
    monthlyFee:              0,
    commissionPct:           8,
    maxFacilities:           1,
    maxCourtsPerFacility:    2,
    maxWorkers:              1,
    maxBlockedDatesPerMonth: 5,
    analyticsMonthly:        false,
    csvExport:               false,
    featured:                false,
    prioritySupport:         false,
    color:                   "slate",
  },
  GROWTH: {
    label:                   "Growth",
    monthlyFee:              2900,
    commissionPct:           5,
    maxFacilities:           3,
    maxCourtsPerFacility:    5,
    maxWorkers:              5,
    maxBlockedDatesPerMonth: 20,
    analyticsMonthly:        true,
    csvExport:               false,
    featured:                false,
    prioritySupport:         false,
    color:                   "blue",
  },
  PRO: {
    label:                   "Pro",
    monthlyFee:              5900,
    commissionPct:           3,
    maxFacilities:           null,
    maxCourtsPerFacility:    null,
    maxWorkers:              null,
    maxBlockedDatesPerMonth: null,
    analyticsMonthly:        true,
    csvExport:               true,
    featured:                true,
    prioritySupport:         true,
    color:                   "purple",
  },
} as const;

export type PlanKey = keyof typeof PLAN_CONFIG;
