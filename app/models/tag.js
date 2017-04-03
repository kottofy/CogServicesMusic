
function Tag(opts) {
  if(!opts) opts = {};
  this.name = opts.name || '';
  this.confidence = opts.confidence || '';
}

 module.exports = Tag;

