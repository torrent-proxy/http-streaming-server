import * as http from "http";
import * as stream from "stream";

export interface Content {
    stream: stream.Readable,
    length: number,
    type: string,
    range?: { start: number, end: number }
}

export default interface IStreamProvider {
    exists(req: http.IncomingMessage, callback: (error: Error | null, exists?: boolean) => void);
    getManifestStream(req: http.IncomingMessage, callback: (error: Error | null, stream?: stream.Readable) => void);
    getSegmentStream(req: http.IncomingMessage, callback: (error: Error | null, content?: Content) => void);
}
