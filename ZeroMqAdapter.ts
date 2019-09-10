/**
 * Created by jesualex on 2019-09-08.
 */

import * as zmq from 'zeromq'
import {Socket} from 'zeromq'
import * as uid2 from "uid2"
import {format} from "util";
import {Namespace} from "socket.io";
import {Adapter} from "./Socket.IOAdapter";
import ZeroMqAdapterOpts from "./ZeroMqAdapterOpts";
import ZeroMqAdapterMsg from "./ZeroMqAdapterMsg";
import {ZeroMqAdapterMsgType} from "./ZeroMqAdapterMsgType";


export abstract class ZeroMQ extends Adapter{
    protected constructor(nsp: Namespace) {
        super(nsp);
    }

    abstract emitTo(id: string, event: string | symbol, ...args: any[])
}

export function zeroMqAdapter (opts: ZeroMqAdapterOpts) {
    opts = opts || {};
    const host = opts.host || '127.0.0.1';
    const pubPort = opts.pubPort || 5555;
    const subPort = opts.subPort || 5556;
    const pub: Socket = opts.pubClient || getNewPub(host, pubPort)
    const sub: Socket = opts.subClient || getNewSub(host, subPort)
    const prefix = opts.key || 'socket.io-zmq';
    const uid = uid2(6);
    const key = prefix + '#' + uid;
    let self: mq

    class mq extends ZeroMQ {
        constructor(nsp: Namespace){
            super(nsp);
            self = this
            sub.on('message', mq.onMessage);
            sub.subscribe('');
        }

        static onMessage(msg: Buffer){
            const msgString = msg.toString()
            console.log("new zeroMqMsg", msgString)
            self.parseMsg(JSON.parse(msgString))
        }

        parseMsg(msg: ZeroMqAdapterMsg){
            const pieces = msg.channel.split('#');

            if (uid == pieces.pop()) {
                return console.log('ZeroMQ#onMessage: ignore same uid');
            }

            switch (msg.type) {
                case ZeroMqAdapterMsgType.sendMsg:
                    this.sendBroadcast(msg.msg, msg.opts)
                    break
                case ZeroMqAdapterMsgType.sendMsgToId:
                    const opts = Array.isArray(msg.opts) ? msg.opts : [msg.opts]
                    this.internEmitTo(true, msg.id!, msg.msg, ...opts);
            }
        }

        broadcast(packet: any, opts: { rooms?: string[]; except?: string[]; flags?: { [p: string]: boolean } }): void {
            this.internBroadcast(packet, opts, false)
        }

        private internBroadcast(packet, opts, remote) {
            super.broadcast(packet, opts)

            if (!remote) {
                const data:ZeroMqAdapterMsg = {
                    channel:key,
                    msg:packet,
                    opts:opts,
                    type: ZeroMqAdapterMsgType.sendMsg
                }

                pub.send(JSON.stringify(data));
            }
        }

        emitTo(id: string, event: string | symbol, ...args: any[]){
            this.internEmitTo(false, id, event, ...args)
        }

        private internEmitTo(remote: boolean, id: string, event: string | symbol, ...args: any[]) {
            const sock = this.nsp.connected[id]

            if(sock){
                console.log("socket finded")
                sock.emit(event, ...args);
                return
            }

            if (!remote) {
                const data:ZeroMqAdapterMsg = {
                    channel:key,
                    msg:event,
                    opts:args,
                    id:id,
                    type: ZeroMqAdapterMsgType.sendMsgToId
                }

                pub.send(JSON.stringify(data));
            }
        }

        private sendBroadcast(packet, opts){
            if(!packet || typeof packet !== "object"){
                console.log("sendBroadcast error, incorrect packet received", packet)
                return
            }

            if (packet.nsp === undefined) {
                packet.nsp = '/';
            }

            if (packet.nsp != this.nsp.name) {
                return console.log('ZeroMQ#onMessage: ignore different namespace');
            }

            this.internBroadcast(packet, opts, true);
        }
    }

    return mq;
}

function getNewPub(host: string, port:number): Socket {
    const pub = zmq.socket('pub');
    pub.connect(format('tcp://%s:%s', host, port));
    return pub
}

function getNewSub(host: string, port:number): Socket {
    const sub = zmq.socket('sub');
    sub.connect(format('tcp://%s:%s', host, port));
    return sub
}