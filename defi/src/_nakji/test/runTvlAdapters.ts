require("dotenv").config();

import { getProtocol, } from "../../cli/utils";
import { storeTvl } from "../../storeTvlInterval/getAndStoreTvl";
import { importAdapter } from "../../cli/utils/importAdapter";
import { util } from "@defillama/sdk";

import protocols from "../../protocols/data";

const { humanizeNumber: { humanizeNumber} } = util

const main = async () => {

  for (const protocol of protocols) {
    console.log('Working on ', protocol.name)
    const now = Math.round(Date.now() / 1000);

    const adapterModule = await importAdapter(protocol)
    const ethereumBlock = undefined
    const chainBlocks = {}
    const tvl = await storeTvl(
      now,
      ethereumBlock as unknown as number,
      chainBlocks,
      protocol,
      adapterModule,
      {},
      4,
      false,
      true,
      true, undefined, {returnCompleteTvlObject: true}
    );
    console.log(tvl)
  }
  // console.log("TVL", typeof tvl === "number" ? humanizeNumber(tvl):tvl)
};

main().then(() => {
  console.log('Done!!!')
  process.exit(0)
})
