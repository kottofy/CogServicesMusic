
function Emotion(opts) {
    if (!opts) opts = {};
    this.faceRectangle = opts.faceRectangle || [];
    this.scores = opts.scores || [];
}

module.exports = Emotion;

