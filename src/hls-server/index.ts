import * as http from 'http';
import * as url from 'url';
import IStreamProvider from './interfaces/i-stream-provider';
import httpAttach = require('http-attach');

export interface Options {
    // Base URI to output HLS streams
    path?: string,
    // Stream provider
    provider: IStreamProvider
}

export const MANIFEST_CONTENT_TYPE = 'application/vnd.apple.mpegurl';

export default class {
    path: string = '/';
    provider: IStreamProvider;

    constructor(server: http.Server, options?: Options) {
        this.attach(server, options);
    }

    attach(server: http.Server, options?: Options) {
        this.path = options.path || this.path;
        this.provider = options.provider || this.provider;

        httpAttach(server, this.middleware.bind(this));
    }

    private middleware(req: http.IncomingMessage, res: http.ServerResponse, next: () => void) {
        const uriPath = url.parse(req.url).pathname;

        this.provider.exists(req, (err, exists) => {
            if (err) {
                res.writeHead(500);
                res.end();
            } else if (!exists) {
                res.writeHead(404);
                res.end();
            } else if (uriPath === this.path) {
                this.writeManifest(req, res, next);
            } else {
                this.writeSegment(req, res, next);
            }
        });
    }

    private writeManifest(req: http.IncomingMessage, res: http.ServerResponse, next: () => void) {
        this.provider.getManifestStream(req, (err, stream) => {
            if (err) {
                res.writeHead(500);
                res.end();

                return next();
            }

            res.writeHead(200, {
                'Content-Type': MANIFEST_CONTENT_TYPE
            });

            stream.pipe(res);
        });
    }

    private writeSegment(req: http.IncomingMessage, res: http.ServerResponse, next: () => void) {
        this.provider.getSegmentStream(req, (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end();

                return next();
            }

            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Type', content.type);

            if (!content.range) {
              res.setHeader('Content-Length', content.length);
              content.stream.pipe(res);

              return next();
            }

            const start = content.range.start;
            const end = content.range.end;
            const pieceLength = end - start + 1;

            res.statusCode = 206;
            res.setHeader('Content-Length', pieceLength);
            res.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + content.length);

            content.stream.pipe(res);
        })
    }
}
