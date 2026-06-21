import { analyticsRepository } from "@/repositories"
import AnalyticsClient from "./AnalyticsClient"

export default async function Analytics() {
  const data = await analyticsRepository.get()
  return <AnalyticsClient data={data} />
}
