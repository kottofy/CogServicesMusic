var express = require('express')
var router = express.Router();
var request = require('request');
const fs = require('fs');

Tag = require('../models/tag');
Playlist = require('../models/playlist.js');
Emotion = require('../models/emotion.js');

module.exports = function (app) {
  app.use('/', router);
};

var tags = [];
var playlists = [];
var emotions = [];
var image_url = "http://static2.businessinsider.com/image/563246309dd7cc25008c5b20/amazons-live-video-network-twitch-is-showing-every-episode-of-bob-ross-the-joy-of-painting-in-an-epic-marathon.jpg";
var image_address = "images/bob2.jpg";

var compvisionkey = process.env.compvisionkey;
var emotionkey = process.env.emotionkey;
var clientId = process.env.clientId;
var clientSecret = process.env.clientSecret;

router.get('/', function (req, res, next) {

  sendRender();

  function sendRender() {
    res.render('home', {
    })
  };
});

router.post('/upload', function (req, res, next) { 

if (!req.files)
    return res.status(400).send('No files were uploaded.');
 
  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file 
let file= req.files.file;

//TODO: Fix upload to server, maybe store in DB instead?
image_address = './uploads/' + file.name;
 
  // Use the mv() method to place the file somewhere on your server 
file.mv('../uploads/' + file.name, function(err) {
    if (err)
      return res.status(500).send(err);
 
    console.log("File uploaded");
  });

  //TODO: Fix Stream Emotion API 
  CompVisionRequestStream(function doThis() {
    EmotionAPIRequestStream(function doThisNext() {
      GetSpotifyPlaylists(sendRender)
    })
  });

  function sendRender() {
    res.render('index', {
      tags: tags,
      playlists: playlists,
      emotions: emotions
    })
  };
}); 

router.post('/url', function (req, res, next) {

  image_url = req.body.url;

console.log(req.body);
  console.log("Image url: " + image_url);

   CompVisionRequest(function doThis() {
    EmotionAPIRequest(function doThisNext() {
      GetSpotifyPlaylists(sendRender)
    })
  });

  function sendRender() {
    res.render('index', {
      tags: tags,
      playlists: playlists,
      emotions: emotions
    })
  };
}); 

function CompVisionRequestStream(callback) {
  var uri = "https://westus.api.cognitive.microsoft.com/vision/v1.0/analyze?visualFeatures=Tags&language=en";
  var options = {
    headers: {
      "Content-Type": "application/octet-stream",
      "Ocp-Apim-Subscription-Key": compvisionkey
    }
  };

  try {
    fs.createReadStream(image_address).pipe(request.post(uri, options, function (error, response, body) {

      console.log("COMP VISION FILE UPLOAD TAGS: " + body);

      var tgs = JSON.parse(body).tags;

      ParseTags(tgs, callback);
    }));
  }
  catch (ex) {
    console.log("Error: " + ex);
    return;
  }
}

function ParseTags(tgs, callback) {
  tags = [];
 for (var key in tgs) {
        var tag = new Tag(tgs[key]);
        tags.push(tag);
      };

      console.log(tags);
      callback();
}

function CompVisionRequest(callback) {
  var uri = "https://westus.api.cognitive.microsoft.com/vision/v1.0/analyze?visualFeatures=Tags&language=en";

  request({
    method: "POST",
    url: uri,
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": compvisionkey
    },
    body: JSON.stringify({ url: image_url })
  },
    function (error, response, body) {

      console.log("COMP VISION URL TAGS: " + body);

      var tgs = JSON.parse(body).tags;

      ParseTags(tgs, callback);
    });
}

function EmotionAPIRequestStream(callback) {
  var uri = "https://westus.api.cognitive.microsoft.com/emotion/v1.0/recognize";
  var options = {
    headers: {
      "Content-Type": "application/octet-stream",
      "Ocp-Apim-Subscription-Key": emotionkey
    }
  };

  try {
    fs.createReadStream(image_address).pipe(request.post(uri, options, function (error, response, body) {

      if (error) {
        console.log("EMOTIONS ERROR: " + error);
      }
      else {
        console.log("EMOTION FILE UPLOAD EMOTIONS: " + body);
        var emots = JSON.parse(body);
        CategorizeEmotions(emots);
        callback();
      }
    }));
  }
  catch (ex) {
    console.log("Error: " + ex);
    return;
  }
}

function CategorizeEmotions(emots) {
  emotions = [];

  var heavy = false, mellow = false, happy = false, sadness = false;

  for (var key in emots) {
    var emot = new Emotion(emots[key]);

    if (emot.scores.anger >= 0.75 || emot.scores.contempt >= 0.75 || emot.scores.disgust >= 0.75) {
      if (!heavy)
        emotions.push("heavy");
      heavy = true;
    }
    if (emot.scores.fear >= 0.75) {
      if (!mellow)
        emotions.push("mellow");
      mellow = true;
    }
    if (emot.scores.sadness >= 0.75) {
      if (!sadness)
        emotions.push("sadness");
      sadness = true;
    }
    if (emot.scores.happiness >= 0.75 || emot.scores.neutral >= 0.75) {
      if (!happy)
        emotions.push("happy");
      happy = true;
    }
  }
  console.log("EMOTIONS CATEGORIZED: " + emotions);
}

function EmotionAPIRequest(callback) {

  var uri = "https://westus.api.cognitive.microsoft.com/emotion/v1.0/recognize";

  request({
    method: "POST",
    url: uri,
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": emotionkey
    },
    body: JSON.stringify({ url: image_url })
  },
    function (error, response, body) {

      if (error)
        console.log("EMOTIONS ERROR: " + error);
      else {
        console.log("EMOTIONS: " + body);

        var emots = JSON.parse(body);

        CategorizeEmotions(emots);

        console.log(emotions);
        callback();
      }
    });
}

function GetSpotifyPlaylists(callback) {
  var uri = "https://api.spotify.com/v1/search";
  var redirect_uri = "http://localhost:3000/callback";

  var querylist = "";
  var taglist = tags;

  for (var key in emotions) {
    querylist += emotions[key].toString();
  }

  for (var key in taglist) {

    if (taglist[key].confidence >= 0.8 && taglist[key].name != "person" && taglist[key].name != "outdoor")
      querylist += " " + (taglist[key].name).replace(/[^a-zA-Z ]/g, " ");
  }

  console.log("SPOTIFY QUERY LIST: " + querylist);

  var queries = { q: querylist, type: "playlist" };

  // your application requests authorization
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Authorization': 'Basic ' + (new Buffer(clientId + ':' + clientSecret).toString('base64'))
    },
    form: {
      grant_type: 'client_credentials'
    },
    json: true
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {

      // use the access token to access the Spotify Web API
      var token = body.access_token;
      var options = {
        url: uri,
        headers: {
          'Authorization': 'Bearer ' + token
        },
        qs: queries,
        json: true
      };
      request.get(options, function (error, response, body) {

        if (!error && response.statusCode === 200) {
          if (body.playlists.items.length == 0) {
            console.log("No items in playlist.")
          }
          else {
            for (var key in body.playlists.items) {
              var play = new Playlist(body.playlists.items[key]);
              playlists.push(play);
            };
            //console.log(playlists);
          }

          callback();
        }
      });
    }
    else {
      console.log(body);
    }
  });

}