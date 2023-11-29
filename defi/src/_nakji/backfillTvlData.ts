
import { tvlHandler } from "./tvlHandler";

const DAY_IN_MILISECONDS = 1000 * 60 * 60 * 24

const startDate = process.argv[2] ? new Date(process.argv[2]) : new Date()
const endDate = process.argv[3] ? new Date(process.argv[3]) : new Date()

const main = async () => {
  let dayInMilis = startDate.getTime()
  while (dayInMilis <= endDate.getTime()) {
    await tvlHandler(dayInMilis / 1000)
    dayInMilis += DAY_IN_MILISECONDS
  }
};

main().then(() => {
  console.log('Done!!!')
  process.exit(0)
})
