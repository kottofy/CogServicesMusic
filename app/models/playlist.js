
function Playlist(opts) {
    if (!opts) opts = {};
    this.name = opts.name || '';
    this.external_urls = opts.external_urls || '';
    this.href = opts.href || '';
    this.id = opts.id || '';
    this.images = opts.images || '';
    this.owner = opts.owner || '';
    this.public = opts.public || '';
    this.snapshot_id = opts.snapshot_id || '';
    this.tracks = opts.tracks || '';
    this.type = opts.type || '';
    this.uri = opts.uri || '';
    this.url = opts.url || '';
}

module.exports = Playlist;

