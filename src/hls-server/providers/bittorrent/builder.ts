import { default as Provider, TorrentStream, FilterFn } from './provider';

export default class Builder {
    private filter: FilterFn = (file) => true;

    withFilter(filter: FilterFn) {
        this.filter = filter;

        return this;
    }

    build(engine: TorrentStream.TorrentEngine): Provider {
        const filter = this.filter;

        return new Provider({ engine, filter });
    }
}
