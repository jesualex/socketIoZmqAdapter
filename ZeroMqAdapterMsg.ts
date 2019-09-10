/**
 * Created by jesualex on 2019-09-08.
 */
import {ZeroMqAdapterMsgType} from "./ZeroMqAdapterMsgType";

export default interface ZeroMqAdapterMsg{
    id?:string,
    msg:any,
    opts:any|any[],
    channel:string,
    type:ZeroMqAdapterMsgType
}