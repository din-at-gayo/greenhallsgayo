/** Look-back windows, in days, offered on the utilization dashboard. */
export const ANALYTICS_RANGES = [7, 30, 90] as const
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]
