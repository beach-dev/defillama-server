
import { AdapterType } from "@defillama/dimension-adapters/adapters/types";
import { dimensionHandler } from "./dimensionHandler";

const DAY_IN_MILISECONDS = 1000 * 60 * 60 * 24

const adapter_type = process.argv[2] ? process.argv[2] as AdapterType : AdapterType.PROTOCOLS;
const startDate = process.argv[3] ? new Date(process.argv[3]) : new Date()
const endDate = process.argv[4] ? new Date(process.argv[4]) : new Date()

const main = async () => {
  let dayInMilis = startDate.getTime()
  while (dayInMilis <= endDate.getTime()) {
    await dimensionHandler(adapter_type, dayInMilis / 1000)
    dayInMilis += DAY_IN_MILISECONDS
  }
}
main()