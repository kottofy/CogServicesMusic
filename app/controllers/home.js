var express = require('express')
var router = express.Router();
var request = require('request');

Tag = require('../models/tag');
Playlist = require('../models/playlist.js');
Emotion = require('../models/emotion.js');

module.exports = function (app) {
  app.use('/', router);
};

var tags = [];
var playlists = [];
var emotions = [];
var image_url = "https://img.wikinut.com/img/313nm57sx91edif9/jpeg/700x1000/Judgement-Day.jpeg";

var compvisionkey = process.env.compvisionkey;
var emotionkey = process.env.emotionkey;
var clientId = process.env.clientId;
var clientSecret = process.env.clientSecret;

router.get('/', function (req, res, next) {

  CompVisionRequest(function doThis() {
    EmotionAPIRequest(function doThisNow() {
      GetSpotifyPlaylists(sendRender)
    })
  });

  function sendRender() {
    res.render('index', {
      title: 'Cognitive Services Music App',
      tags: tags,
      playlists: playlists,
      emotions: emotions
    })
  };
});

function CompVisionRequest(callback) {
  tags = [];
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
      var tgs = JSON.parse(body).tags;

      for (var key in tgs) {
        var tag = new Tag(tgs[key]);
        tags.push(tag);
      };

      // console.log(tags);
      callback();
    });

}

function EmotionAPIRequest(callback) {
  emotions = [];

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
      var emots = JSON.parse(body);
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
           if ( emot.scores.sadness >= 0.75) {
          if (!sadness)
            emotions.push("sadness");
          sadness = true;
        }
        if (emot.scores.happiness >= 0.75 || emot.scores.neutral >= 0.75) {
          if (!happy)
            emotions.push("happy");
          happy = true;
        }
      };

      console.log(emotions);
      callback();
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

  console.log(querylist);

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