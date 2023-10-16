import { wrapScheduledLambda } from "../utils/shared/wrap";
import { getTimestampAtStartOfDayUTC } from "../utils/date";
import { ChainBlocks, Adapter, AdapterType, BaseAdapter, ProtocolType } from "@defillama/dimension-adapters/adapters/types";
import canGetBlock from "../adaptors/utils/canGetBlock";
import allSettled from 'promise.allsettled'
import runAdapter, { getFulfilledResults, getRejectedResults } from "@defillama/dimension-adapters/adapters/utils/runAdapter";
import { getBlock } from "@defillama/dimension-adapters/helpers/getBlock";
import { Chain } from "@defillama/sdk/build/general";
import { AdaptorRecord, AdaptorRecordType, AdaptorRecordTypeMap, AdaptorRecordTypeMapReverse, RawRecordMap, storeAdaptorRecord } from "../adaptors/db-utils/adaptor-record";
import { processFulfilledPromises, processRejectedPromises, STORE_ERROR } from "../adaptors/handlers/storeAdaptorData/helpers";
import loadAdaptorsData from "../adaptors/data"
import { IJSON, ProtocolAdaptor } from "../adaptors/data/types";

// Runs a little bit past each hour, but calls function with timestamp on the hour to allow blocks to sync for high throughput chains. Does not work for api based with 24/hours

export interface IHandlerEvent {
  protocolModules: string[]
  timestamp?: number
  adaptorType: AdapterType
  chain?: Chain
  adaptorRecordTypes?: string[]
  protocolVersion?: string
}

const CURRENT_TIMESTAMP = Math.trunc((Date.now()) / 1000)

async function run(adaptorType: AdapterType) {
  // Timestamp to query, defaults current timestamp - 2 minutes delay
  const currentTimestamp = CURRENT_TIMESTAMP;
  // Get clean day
  const cleanCurrentDayTimestamp = getTimestampAtStartOfDayUTC(currentTimestamp)
  const cleanPreviousDayTimestamp = getTimestampAtStartOfDayUTC(cleanCurrentDayTimestamp - 1)

  // Import data list to be used
  const dataModule = await loadAdaptorsData(adaptorType)
  const dataList = dataModule.default
  const dataMap = dataList.reduce((acc, curr) => {
    acc[curr.module] = curr
    return acc
  }, {} as IJSON<typeof dataList[number]>)
  // Import some utils
  const { importModule, KEYS_TO_STORE, config } = dataModule

  // Get list of adaptors to run
  const adaptorsList = dataList

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
        adaptersToRun.push([module, adaptor.adapter])
      } else if ("breakdown" in adaptor) {
        const dexBreakDownAdapter = adaptor.breakdown
        const breakdownAdapters = Object.entries(dexBreakDownAdapter)
        for (const [version, adapter] of breakdownAdapters) {
          adaptersToRun.push([
            version,
            adapter
          ])
        }
      } else {
        throw new Error("Invalid adapter")
      }

      // Run adapters // TODO: Change to run in parallel
      const FILTRED_KEYS_TO_STORE = KEYS_TO_STORE/* event.adaptorRecordTypes?.reduce((acc, curr) => {
        acc[AdaptorRecordTypeMap[curr]] = curr
        return acc
      }, {} as IJSON<string>) ?? AdaptorRecordTypeMapReverse */
      if (adaptor.protocolType === ProtocolType.COLLECTION) {
        for (const [version, adapter] of adaptersToRun) {
          const colletionConfig = config[module]?.protocolsData?.[version]
          if (!colletionConfig) continue
          id = colletionConfig.id
          const rawRecords: RawRecordMap = {}
          const runAtCurrTime = Object.values(adapter).some(a => a.runAtCurrTime)
          if (runAtCurrTime && Math.abs(CURRENT_TIMESTAMP - cleanCurrentDayTimestamp) > 60 * 60 * 2) continue
          const runAdapterRes = await runAdapter(adapter, cleanCurrentDayTimestamp, chainBlocks, module, version)
          const fulfilledResults = getFulfilledResults(runAdapterRes)
          processFulfilledPromises(fulfilledResults, rawRecords, version, FILTRED_KEYS_TO_STORE)
          const rejectedResults = getRejectedResults(runAdapterRes)
          // Make sure rejected ones are also included in rawRecords
          processRejectedPromises(rejectedResults, rawRecords, module, FILTRED_KEYS_TO_STORE)
          for (const [recordType, record] of Object.entries(rawRecords)) {
            console.info("STORING -> ", module, adaptorType, recordType as AdaptorRecordType, id, cleanPreviousDayTimestamp, record, adaptor.protocolType)
            await storeAdaptorRecord(new AdaptorRecord(recordType as AdaptorRecordType, id, cleanPreviousDayTimestamp, record, adaptor.protocolType), CURRENT_TIMESTAMP)
          }
        }
      } else {
        const rawRecords: RawRecordMap = {}
        for (const [version, adapter] of adaptersToRun) {
          const runAtCurrTime = Object.values(adapter).some(a => a.runAtCurrTime)
          if (runAtCurrTime && Math.abs(CURRENT_TIMESTAMP - cleanCurrentDayTimestamp) > 60 * 60 * 2) continue
          const runAdapterRes = await runAdapter(adapter, cleanCurrentDayTimestamp, chainBlocks, module, version)
          const fulfilledResults = getFulfilledResults(runAdapterRes)
          processFulfilledPromises(fulfilledResults, rawRecords, version, FILTRED_KEYS_TO_STORE)
          const rejectedResults = getRejectedResults(runAdapterRes)
          // Make sure rejected ones are also included in rawRecords
          processRejectedPromises(rejectedResults, rawRecords, module, FILTRED_KEYS_TO_STORE)
        }

        // Store records // TODO: Change to run in parallel
        for (const [recordType, record] of Object.entries(rawRecords)) {
          console.log("STORING -> ", module, adaptorType, recordType as AdaptorRecordType, id, cleanPreviousDayTimestamp, record, adaptor.protocolType)
          await storeAdaptorRecord(new AdaptorRecord(recordType as AdaptorRecordType, id, cleanPreviousDayTimestamp, record, adaptor.protocolType), CURRENT_TIMESTAMP)
        }
      }
    }
    catch (error) {
      const err = error as Error
      console.error(`${STORE_ERROR}:${module}: ${err.message}`)
      console.error(error)
      throw error
    }
  }))
  console.info("Execution result", results)
  console.info(`**************************`)
};


run(AdapterType.DEXS)