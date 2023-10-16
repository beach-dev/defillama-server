require('dotenv').config()
import { handler } from "../adaptors/handlers/storeAdaptorData";
import { AdapterType } from "@defillama/dimension-adapters/adapters/types";
// import dexs from "../data/dexs";

handler({
    protocolModules: [process.argv[2]],
    adaptorType: AdapterType.DEXS
})