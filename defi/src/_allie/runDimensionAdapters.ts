require('dotenv').config()
import { getTimestampAtStartOfDayUTC } from "../utils/date";
import { ChainBlocks, Adapter, AdapterType, BaseAdapter, ProtocolType } from "@defillama/dimension-adapters/adapters/types";
import canGetBlock from "../adaptors/utils/canGetBlock";
import allSettled from 'promise.allsettled'
import runAdapter, { getFulfilledResults, getRejectedResults } from "@defillama/dimension-adapters/adapters/utils/runAdapter";
import { getBlock } from "@defillama/dimension-adapters/helpers/getBlock";
import { Chain } from "@defillama/sdk/build/general";
import loadAdaptorsData from "../adaptors/data"
import { IJSON } from "../adaptors/data/types";
import { Connector } from "@nakji-network/connectorts/dist/connector/src/connector";
import { MsgType } from "@nakji-network/connectorts/dist/kafkautils/src/types";
import * as chain from "./utils/gen/dimension_pb"
import * as protobuf from "@bufbuild/protobuf"

const CURRENT_TIMESTAMP = Math.trunc((Date.now()) / 1000)

async function run(adaptorType: AdapterType) {
  const connector = Connector.create()
  connector.registerProtos('./utils/dimension.proto', MsgType.BF, new chain.DimensionRecord({}))
  // Timestamp to query, defaults current timestamp - 2 minutes delay
  const currentTimestamp = CURRENT_TIMESTAMP;
  // Get clean day
  const cleanCurrentDayTimestamp = getTimestampAtStartOfDayUTC(currentTimestamp)
  const cleanPreviousDayTimestamp = getTimestampAtStartOfDayUTC(cleanCurrentDayTimestamp - 1)

  // Import data list to be used
  const dataModule = await loadAdaptorsData(adaptorType)
  const adaptorsList = dataModule.default.filter((adaptor) => adaptor.name == 'Uniswap V3')
  console.log(adaptorsList)
  // Import some utils
  const { importModule, KEYS_TO_STORE, config } = dataModule

  // Get closest block to clean day. Only for EVM compatible ones.
  const allChains = adaptorsList.reduce((acc, { chains }) => {
    acc.push(...chains as Chain[])
    return acc
  }, [] as Chain[]).filter(canGetBlock)
  const chainBlocks: ChainBlocks = {};
  await allSettled(
    allChains.map(async (chain) => {
      try {
        const latestBlock = await getBlock(cleanCurrentDayTimestamp, chain, chainBlocks).catch((e: any) => console.error(`${e.message}; ${cleanCurrentDayTimestamp}, ${chain}`))
        if (latestBlock)
          chainBlocks[chain] = latestBlock
      } catch (e) { console.log(e) }
    })
  );

  const results = await allSettled(adaptorsList.map(async protocol => {
    // Get adapter info
    let { id, module, versionKey } = protocol;
    console.info(`Adapter found ${id} ${module} ${versionKey}`)

    try {
      // Import adaptor
      const adaptor: Adapter = importModule(module).default;
      console.info("Improted OK")

      // Get list of adapters to run
      const adaptersToRun: [string, BaseAdapter][] = []
      if ("adapter" in adaptor) {
        adaptersToRun.push(['main', adaptor.adapter])
      } else if ("breakdown" in adaptor) {
        const dexBreakDownAdapter = adaptor.breakdown
        const breakdownAdapters = Object.entries(dexBreakDownAdapter)
        for (const [version, adapter] of breakdownAdapters) {
          if (!versionKey || versionKey == version) {
            adaptersToRun.push([
              version,
              adapter
            ])
          }
        }
      } else {
        throw new Error("Invalid adapter")
      }
      
      if (adaptor.protocolType !== ProtocolType.COLLECTION) {
        const dimensionRecords: protobuf.Message[] = []
        for (const [version, adapter] of adaptersToRun) {
          const runAtCurrTime = Object.values(adapter).some(a => a.runAtCurrTime)
          if (runAtCurrTime && Math.abs(CURRENT_TIMESTAMP - cleanCurrentDayTimestamp) > 60 * 60 * 2) continue
          
          const runAdapterRes = await runAdapter(adapter, cleanCurrentDayTimestamp, chainBlocks, module, version)

          const fulfilledResults = getFulfilledResults(runAdapterRes)
          
          const key = new chain.DimensionRecord_DimensionKey()
          key.protocolId = id
          key.version = version
          key.timestamp = BigInt(cleanPreviousDayTimestamp)
          key.adaptorType = adaptorType

          const results = fulfilledResults as unknown as IJSON<string | number | undefined>[]
          const dimensionData = new chain.DimensionRecord_DimensionData()
          for (const result of results) {
            const dimensionMap = new chain.DimensionRecord_DimensionData_Dimension()
            for (const [TYPE_SHORT, TYPE] of Object.entries(KEYS_TO_STORE)) {
              if (result[TYPE])
              dimensionMap.data[TYPE_SHORT] = result[TYPE] as number
            }
            dimensionData.data[result.chain as string] = dimensionMap;
          }
          const dimensionRecord = new chain.DimensionRecord()
          dimensionRecord.key = key
          dimensionRecord.data = dimensionData

          dimensionRecords.push(dimensionRecord);
        }

        // export to kafka
        connector.produceMessages(MsgType.BF, dimensionRecords)
      }
    }
    catch (error) {
      console.error(error)
      throw error
    }
  }))
};


const adapter_type = process.argv[2] ? process.argv[2] as AdapterType : AdapterType.PROTOCOLS;

run(adapter_type)