import * as protobuf from "@bufbuild/protobuf"

import { MsgType } from '@nakji-network/connectorts/dist/kafkautils/src/types'
import { Connector } from '@nakji-network/connectorts/dist/connector/src/connector'

import * as chain from "../utils/gen/dimension_pb"

export class TestConnector {
    public connector: Connector

    public constructor() {
        this.connector = Connector.create()
    }

    public async start() {

        this.connector.registerProtos('../utils/dimension.proto', MsgType.BF, new chain.DimensionRecord({}))
        await this.listenBlocks()
    }

    private async listenBlocks() {
        setInterval(async () => {
            await this.process()
          }, 1000);
    }

    private async process() {
        console.log('process')
        let record = new chain.DimensionRecord()

        record.key = new chain.DimensionRecord_DimensionKey()
        record.key.adaptorType = 'type'
        record.key.protocolId= '1'
        record.key.timestamp = BigInt(new Date().getTime())
        

        let messages: protobuf.Message[] = [record]

        this.connector.produceMessages(MsgType.BF, messages)

    }
}

const testConnector = new TestConnector()
testConnector.start()
