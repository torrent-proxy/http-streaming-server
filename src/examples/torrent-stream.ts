import * as http from "http";
import * as TorrentStream from "torrent-stream";
import { HLSServer, BittorrentStreamProvider } from '../';

const MAGNET = 'magnet:?xt=urn:btih:6CD6E0DD7EDF1D40D5475AB2C3B5B4B647741911';
const engine = TorrentStream(MAGNET);
const server = http.createServer();

new HLSServer(server, {
    path: '/play',
    provider: new BittorrentStreamProvider(engine)
});

server.listen(1337);
console.log('Open network stream in VLC: http://localhost:1337/play');
