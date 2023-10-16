import { IRecordAdaptorRecordData } from "./adaptor-record";
import * as protobuf from "protobufjs"
import * as path from "path"

interface Key {
    PK: string;
    SK: number;
}

interface DimensionData {
    key: Key;
    value: IRecordAdaptorRecordData;
}

export const exportToProtobuf = async (obj2Store: IRecordAdaptorRecordData, PK: string, SK: number) => {
    const protoFile = path.resolve(__dirname, "dimension.proto");
    const root = protobuf.loadSync(protoFile);
    const DimensionData = root.lookupType("DimensionData");
    
    const data : DimensionData = { key: {PK, SK}, value: obj2Store}
    const buffer = DimensionData.encode(data).finish()
    
    console.log(buffer)

}