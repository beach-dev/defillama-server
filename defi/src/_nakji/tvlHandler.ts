require("dotenv").config();

import { getProtocol, } from "../cli/utils";
import { storeTvl } from "../storeTvlInterval/getAndStoreTvl";
import { importAdapter } from "../cli/utils/importAdapter";
import { util } from "@defillama/sdk";

import protocols from "../protocols/data";
import { Connector } from "@nakji-network/connectorts/dist/connector/src/connector";
import { MsgType } from "@nakji-network/connectorts/dist/kafkautils/src/types";
import * as chain from "./utils/gen/dimension_pb"
import * as protobuf from "@bufbuild/protobuf"

const { humanizeNumber: { humanizeNumber} } = util

export const tvlHandler = async (timestamp: number) => {
  const connector = Connector.create()
  connector.registerProtos('./utils/dimension.proto', MsgType.BF, new chain.DimensionRecord({}))

  for (const protocol of protocols) {
    console.log('Working on ', protocol.name)

    const adapterModule = await importAdapter(protocol)
    const ethereumBlock = undefined
    const chainBlocks = {}
    const tvl = await storeTvl(
      timestamp,
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
    if (typeof tvl === 'object') {

      const key = new chain.DimensionRecord_DimensionKey()
      key.protocolId = protocol.name
      key.version = '0'
      key.timestamp = BigInt(timestamp)
      key.adaptorType = 'tvl'

      const dimensionData = new chain.DimensionRecord_DimensionData()
      for (const [key, value] of Object.entries(tvl)) {
        const dimensionMap = new chain.DimensionRecord_DimensionData_Dimension()
          dimensionMap.data['tvl'] = value
        dimensionData.data[key as string] = dimensionMap;
      }
      const dimensionRecord = new chain.DimensionRecord()
      dimensionRecord.key = key
      dimensionRecord.data = dimensionData
      connector.produceMessages(MsgType.BF, [dimensionRecord])
    }
    console.log('TVL result: ', tvl)
  }
};
