import * as http from "http";
import * as TorrentStream from "torrent-stream";
import * as mime from 'mime';
import { HLSServer, BittorrentStreamProviderBuilder } from '../';

const MAGNET = 'magnet:?xt=urn:btih:6CD6E0DD7EDF1D40D5475AB2C3B5B4B647741911';
const engine = TorrentStream(MAGNET);
const server = http.createServer();

// URL pathname to streaming on
const path = '/play';

// Create stream provider
const provider = new BittorrentStreamProviderBuilder()
    .withFilter((file) => {
        const regex = /^video\//g;
        const mimeType = mime.getType(file.name);

        return regex.test(mimeType);
    })
    .build(engine);

// attach streaming middleware to the server
new HLSServer(server, { path, provider });

server.listen(1337);
console.log('Open network stream in VLC: http://localhost:1337/play');
