
import { tvlHandler } from "./tvlHandler";

const main = async () => {
  const now = Math.round(Date.now() / 1000);
  await tvlHandler(now)
};

main().then(() => {
  console.log('Done!!!')
  process.exit(0)
})
