/**
 * Created by jesualex on 2019-09-08.
 */
import {Socket} from "zeromq";

export default interface ZeroMqAdapterOpts{
    key?: string, // the name of the key to pub/sub events on as prefix (socket.io-zmq)
    host?: string, // host to connect to zeromq pub/sub server on (127.0.0.1)
    pubPort?: number, //port to connect to publisher of zeromq pub/sub server on (5555)
    subPort?: number, //port to connect to subscriber of zeromq pub/sub server on (5556)
    pubClient?: Socket, //the zeromq client to publish events on
    subClient?: Socket //the zeromq client to subscribe to events on
}