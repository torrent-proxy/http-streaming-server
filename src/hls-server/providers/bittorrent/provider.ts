import * as http from "http";
import * as stream from "stream";
import * as parseRange from "range-parser";
import * as mime from 'mime';
import { default as IStreamProvider, Content } from "../../interfaces/i-stream-provider";

export type FilterFn = (file: TorrentStream.TorrentFile) => boolean;

export interface Params {
    engine: TorrentStream.TorrentEngine,
    filter: FilterFn
}

export default class implements IStreamProvider {
    private engine: TorrentStream.TorrentEngine;
    private ready: boolean = false;
    private error: Error | null = null;
    private files: TorrentStream.TorrentFile[] = [];

    constructor(params: Params) {
        this.engine = params.engine;

        this.engine.on('ready', () => {
            this.addFiles(this.engine.files, params.filter);
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
        } else if (this.files[index] === undefined) {
            callback(new Error('content not found'));
        } else {
            const file = this.files[index];
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

        return '#EXTM3U\n' + this.files.map(fileToEntry).join('\n');
    }

    private createManifestBuffer(req: http.IncomingMessage) {
        const manifest = this.convertFilesToPlaylist(`http://${req.headers.host}`);

        return Buffer.from(manifest);
    }

    private addFiles(files: TorrentStream.TorrentFile[], filter: FilterFn) {
        this.files = files.filter(filter);
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
