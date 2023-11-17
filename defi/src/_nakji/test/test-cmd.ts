import { Connector } from '@nakji-network/connectorts/dist/connector/src/connector'
import { Env, MsgType } from '@nakji-network/connectorts/dist/kafkautils/src/types'
import * as chain from "../utils/gen/dimension_pb"
import { KafkaMessage } from '@nakji-network/connectorts/dist/kafkautils/src/message'
import { Topic } from '@nakji-network/connectorts/dist/kafkautils/src/topic'

const connector = Connector.create()
connector.registerProtos('./utils/dimension.proto', MsgType.BF, new chain.DimensionRecord({}))

const topic = new Topic(Env.DEV, MsgType.BF, "nakji", "ethereum", "0.0.0", new chain.DimensionRecord({}))


connector.subscribe([topic], async (message: KafkaMessage) => {
    const dimensionRecord = chain.DimensionRecord.fromBinary(new Uint8Array(message.value as Buffer))
    console.log(dimensionRecord.toJsonString())
}, { groupId: 'test-group' })
