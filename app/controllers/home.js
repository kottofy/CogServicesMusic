var express = require('express')
var router = express.Router();
var request = require('request');
const fs = require('fs');
var azure = require('azure-storage');

Tag = require('../models/tag');
Playlist = require('../models/playlist.js');
Emotion = require('../models/emotion.js');

module.exports = function (app) {
  app.use('/', router);
};

var tags = [];
var playlists = [];
var emotions = [];
var buffer;

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

  if (!req.files || req.files.file == undefined) {
    return res.status(400).send('No files were uploaded.');
  }
  else {
    var file = req.files.file;

    convertFileToBuffer(file.data, function doThis() {
      fs.readFile(buffer, function (err) {
        var path = __dirname + "\\uploads\\uploadedFile.jpg";
        fs.writeFile(path, buffer, function (err) {
          if (!err) {
            console.log("File moved to server");

            //TODO: Fix Stream Emotion API 
            AddFileToStorage(path, file.name);
            CompVisionRequestStream(path, function doThis() {
              EmotionAPIRequestStream(path, function doThisNext() {
                GetSpotifyPlaylists(sendRender)
              })
            });
          }
          else {
            console.log("Error: " + err);
          }
        });
      });
    });
  }

  function convertFileToBuffer(fileData, callback) {


buffer = toBuffer(fileData);

    function toBuffer(ab) {

      return Buffer.from(ab);
      // var buf = new Buffer(ab.byteLength);
      // var view = new Uint8Array(ab);
      // for (var i = 0; i < buf.length; ++i) {
      //   buf[i] = view[i];
      // }
      // return buf;
    }
    callback();
  }

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

function AddFileToStorage(path, fileName) {

  var fileService = azure.createFileService("DefaultEndpointsProtocol=https;AccountName=cogservicesmusic;AccountKey=N0Yq020gt+iPv+4oJOxCplvrmWmUr/tJbBWRz1VbEQUvXDb3nMFM05k2sxlAmAnEBpz2rKINcCi1DJ6D+xt8Tw==;EndpointSuffix=core.windows.net");
  fileService.createShareIfNotExists('cognitiveservicesmusicfileshare', function (error, result, response) {
    if (!error) {

      fileService.createDirectoryIfNotExists('cognitiveservicesmusicfileshare', 'cognitiveservicesmusic', function (error, result, response) {
        if (!error) {

          var date = new Date();
          var currentDateTime = date.getUTCMonth() + "-" + date.getUTCDate() + "-" + date.getUTCFullYear() + "_" + date.getUTCHours() + "-" + date.getUTCMinutes() + "-" + date.getUTCSeconds();

          var newFileName = currentDateTime + "_" + fileName;

          fileService.createFileFromLocalFile('cognitiveservicesmusicfileshare', 'cognitiveservicesmusic', newFileName, path, function (error, result, response) {
            if (!error) {
              console.log("File Uploaded to Azure File Storage");
            }
            else {
              console.log("Error adding file to azure storage:" + error);
            }
          });
        }
      });

    }
  });
}

function CompVisionRequestStream(filePath, callback) {
  var uri = "https://westus.api.cognitive.microsoft.com/vision/v1.0/analyze?visualFeatures=Tags&language=en";
  var options = {
    headers: {
      "Content-Type": "application/octet-stream",
      "Ocp-Apim-Subscription-Key": compvisionkey
    }
  };

  try {
    fs.createReadStream("app\\controllers\\uploads\\uploadedFile.jpg").pipe(request.post(uri, options, function (error, response, body) {
      if (!error) {
        // console.log("COMP VISION FILE UPLOAD TAGS: " + body);
        var tgs = JSON.parse(body).tags;
        ParseTags(tgs, callback);
      }
      else {
        console.log("Error with Computer Vision API File Upload: " + error);
      }
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

function EmotionAPIRequestStream(filePath, callback) {
  var uri = "https://westus.api.cognitive.microsoft.com/emotion/v1.0/recognize";
  var options = {
    headers: {
      "Content-Type": "application/octet-stream",
      "Ocp-Apim-Subscription-Key": emotionkey
    }
  };

  try {
    fs.createReadStream(filePath).pipe(request.post(uri, options, function (error, response, body) {

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