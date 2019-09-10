/**
 * Created by jesualex on 2019-09-08.
 * Module dependencies.
 */


import {EventEmitter} from "events";
import {Adapter as AdapterInterface, Namespace, Room as IoRoom} from "socket.io";

class Room implements IoRoom{
    length: number;
    sockets: { [p: string]: boolean };

    /**
     * Room constructor.
     *
     * @api private
     */

    constructor(){
        this.sockets = {};
        this.length = 0;
    }

    /**
     * Adds a socket to a room.
     *
     * @param id {String} socket id
     * @api private
     */

    add(id){
        if (!this.sockets.hasOwnProperty(id)) {
            this.sockets[id] = true;
            this.length++;
        }
    };

    /**
     * Removes a socket from a room.
     *
     * @param id {String} socket id
     * @api private
     */

    del(id){
        if (this.sockets.hasOwnProperty(id)) {
            delete this.sockets[id];
            this.length--;
        }
    };

    static room() {
        if (!(this instanceof Room)) return new Room();
        this.sockets = {};
        // @ts-ignore
        this.length = 0;
    }
}

export class Adapter extends EventEmitter implements AdapterInterface{
    nsp: Namespace;
    rooms: {[room: string]: Room}
    sids: {[id: string]: {[room: string]: boolean}};
    encoder

    /**
     * Memory adapter constructor.
     *
     * @param {Namespace} nsp
     * @api public
     */

    constructor(nsp){
        super()
        this.nsp = nsp;
        this.rooms = {};
        this.sids = {};
        this.encoder = nsp.server.encoder;
    }

    /**
     * Adds a socket to a list of room.
     *
     * @param {String} socket id
     * @param {String} rooms
     * @param {Function} callback
     * @api public
     */

    addAll(id, rooms, fn){
        for (let i = 0; i < rooms.length; i++) {
            const room = rooms[i];
            this.sids[id] = this.sids[id] || {};
            this.sids[id][room] = true;
            this.rooms[room] = this.rooms[room] || Room.room();
            this.rooms[room].add(id);
        }
        if (fn) process.nextTick(fn.bind(null, null));
    }

    /**
     * Adds a socket to a room.
     *
     * @param id {String} socket id
     * @param room {String} room name
     * @param callback {Function} callback
     * @api public
     */

    add(id: string, room: string, callback?: (err?: any) => void): void {
        return this.addAll(id, [ room ], callback);
    }

    /**
     * Broadcasts a packet.
     *
     *  @param opts Options:
     *  - `flags` {Object} flags for this packet
     *  - `except` {Array} sids that should be excluded
     *  - `rooms` {Array} list of rooms to broadcast to
     *
     * @param {Object} packet object
     * @api public
     */

    broadcast(packet: any, opts: { rooms?: string[]; except?: string[]; flags?: { [p: string]: boolean } }): void {
        const rooms = opts.rooms || [];
        const except = opts.except || [];
        const flags = opts.flags || {};
        const packetOpts = {
            preEncoded: true,
            volatile: flags.volatile,
            compress: flags.compress
        };
        const ids = {};
        const self = this;
        let socket;

        packet.nsp = this.nsp.name;
        this.encoder.encode(packet, function(encodedPackets) {
            if (rooms.length) {
                for (var i = 0; i < rooms.length; i++) {
                    var room = self.rooms[rooms[i]];
                    if (!room) continue;
                    var sockets = room.sockets;
                    for (var id in sockets) {
                        if (sockets.hasOwnProperty(id)) {
                            if (ids[id] || ~except.indexOf(id)) continue;
                            socket = self.nsp.connected[id];
                            if (socket) {
                                socket.packet(encodedPackets, packetOpts);
                                ids[id] = true;
                            }
                        }
                    }
                }
            } else {
                for (var id in self.sids) {
                    if (self.sids.hasOwnProperty(id)) {
                        if (~except.indexOf(id)) continue;
                        socket = self.nsp.connected[id];
                        if (socket) socket.packet(encodedPackets, packetOpts);
                    }
                }
            }
        });
    }

    /**
     * Removes a socket from a room.
     *
     * @param id {String} socket id
     * @param room {String} room name
     * @param callback {Function} callback
     * @api public
     */

    del(id: string, room: string, callback?: (err?: any) => void): void {
        this.sids[id] = this.sids[id] || {};
        delete this.sids[id][room];
        if (this.rooms.hasOwnProperty(room)) {
            this.rooms[room].del(id);
            if (this.rooms[room].length === 0) delete this.rooms[room];
        }

        if (callback) process.nextTick(callback.bind(null, null));
    }

    /**
     * Removes a socket from all rooms it's joined.
     *
     * @param id {String} socket id
     * @param fn {Function} callback
     * @api public
     */

    delAll(id: string): void {
        const rooms = this.sids[id];
        if (rooms) {
            for (var room in rooms) {
                if (this.rooms.hasOwnProperty(room)) {
                    this.rooms[room].del(id);
                    if (this.rooms[room].length === 0) delete this.rooms[room];
                }
            }
        }
        delete this.sids[id];
    }


    /**
     * Gets a list of clients by sid.
     *
     * @param {Array} explicit set of rooms to check.
     * @param {Function} callback
     * @api public
     */

    clients(rooms, fn){
        let id;
        if ('function' == typeof rooms){
            fn = rooms;
            rooms = null;
        }

        rooms = rooms || [];

        const ids = {};
        const sids: string[] = [];
        let socket;

        if (rooms.length) {
            for (var i = 0; i < rooms.length; i++) {
                var room = this.rooms[rooms[i]];
                if (!room) continue;
                var sockets = room.sockets;
                for (id in sockets) {
                    if (sockets.hasOwnProperty(id)) {
                        if (ids[id]) continue;
                        socket = this.nsp.connected[id];
                        if (socket) {
                            sids.push(id);
                            ids[id] = true;
                        }
                    }
                }
            }
        } else {
            for (id in this.sids) {
                if (this.sids.hasOwnProperty(id)) {
                    socket = this.nsp.connected[id];
                    if (socket) sids.push(id);
                }
            }
        }

        if (fn) process.nextTick(fn.bind(null, null, sids));
    };

    /**
     * Gets the list of rooms a given client has joined.
     *
     * @param {String} socket id
     * @param {Function} callback
     * @api public
     */
    clientRooms(id, fn){
        const rooms = this.sids[id];
        if (fn) process.nextTick(fn.bind(null, null, rooms ? Object.keys(rooms) : null));
    };
}