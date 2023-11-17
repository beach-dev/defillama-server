import { AdapterType } from "@defillama/dimension-adapters/adapters/types";
import { dimensionHandler } from "./dimensionHandler";


const adapter_type = process.argv[2] ? process.argv[2] as AdapterType : AdapterType.PROTOCOLS;

const CURRENT_TIMESTAMP = Math.trunc((Date.now()) / 1000)

dimensionHandler(adapter_type, CURRENT_TIMESTAMP)