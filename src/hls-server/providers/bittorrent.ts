import * as http from "http";
import * as stream from "stream";
import * as parseRange from "range-parser";
import * as mime from 'mime';
import { default as IStreamProvider, Content } from "../interfaces/i-stream-provider";

export default class implements IStreamProvider {
    engine: TorrentStream.TorrentEngine;
    ready: boolean = false;
    error: Error | null = null;

    constructor(torrentStreamEngine: TorrentStream.TorrentEngine) {
        this.engine = torrentStreamEngine;

        this.engine.on('ready', () => {
            this.ready = true;
        });

        this.engine.on('error', (error) => {
            this.error = new Error(error);
            this.ready = false;
        });
    }

    exists(req: http.IncomingMessage, callback: (error: Error | null, exists?: boolean) => void) {
        callback(this.error, this.ready);
    }

    getManifestStream(req: http.IncomingMessage, callback: (error: Error | null, stream?: stream.Readable) => void) {
        function createReadStream(buff: Buffer): stream.Readable {
            const readStream = new stream.PassThrough();
            readStream.end(buff);

            return readStream;
        }

        const buffer = this.createManifestBuffer(req);

        callback(null, createReadStream(buffer));
    }

    getSegmentStream(req: http.IncomingMessage, callback: (error: Error | null, content?: Content) => void) {
        const regex = /\/entry:(\d*)/g;
        const indexStr = regex.exec(req.url)[1];
        const index = parseInt(indexStr, 10);

        if (isNaN(index)) {
            callback(new Error('invalid path'));
        } else if (this.engine.files[index] === undefined) {
            callback(new Error('content not found'));
        } else {
            const file = this.engine.files[index];
            const rangeHeader = req.headers.range;

            const range = rangeHeader ? parseRange(file.length, rangeHeader)[0] : null;
            const type = mime.getType(file.name);
            const length = file.length;
            const stream = range ? file.createReadStream(range) : file.createReadStream();

            callback(null, { stream, type, length, range });
        }
    }

    protected buildFilePath(file: TorrentStream.TorrentFile, index: number): string {
        return 'entry:' + index.toString();
    }

    private convertFilesToPlaylist(origin: string): string {
        const fileToEntry = (file: TorrentStream.TorrentFile, i: number): string => {
            return [
                '#EXTINF:-1,',
                file.path,
                '\n',
                origin,
                '/',
                this.buildFilePath(file, i)
            ].join('');
        };

        return '#EXTM3U\n' + this.engine.files.map(fileToEntry).join('\n');
    }

    private createManifestBuffer(req: http.IncomingMessage) {
        const manifest = this.convertFilesToPlaylist(`http://${req.headers.host}`);

        return Buffer.from(manifest);
    }
}

// TODO: push to the @types/torrent-stream
export namespace TorrentStream {
    export interface TorrentEngine {
        files: TorrentFile[];

        // Events
        on(event: "ready" | "torrent" | "idle", callback: Function): void;
        on(event: string, callback: Function): void;
    }

    export interface TorrentFile {
        name: string;
        path: string;
        length: number;

        createReadStream(options?: ReadStreamOptions): any;
    }

    export interface ReadStreamOptions {
        start: number;
        end: number;
    }
}
