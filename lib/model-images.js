'use strict';

const mongoose = require('mongoose');
const async = require('async');
const fs = require('fs');
const mmm = require('mmmagic');
const magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);
const rimraf = require('rimraf');
const request = require('request');
const path = require('path');
const gm = require('gm');

const defaultOptions = {
  modelDirName: null, // By default use current model name in lower case. Can`t be used for subDocuments
  fields: ['pictures'],
  rootPath: 'public/images',
  resize: false,
  sizes: {
    small: [100, 100, 100],
    middle: [300, 300, 100],
    big: [600, 600, 100]
  }
};

const ImageSchema = new mongoose.Schema({
  source: String,
  //sizes: mongoose.Schema.Types.Mixed,
  created: {
    type: Date,
    default: Date.now
  }
});

function createImages(source, path, sizes, next) {}


function ModelImagesPlugin(Schema, options) {
  options = options || {};
  options = Object.assign(defaultOptions, options);

  // Set and create images root path
  let imagesRootPath = path.join(global.__baseDir, options.rootPath);
  let imagesRootUrl = '/images';
  createPath(imagesRootPath);

  // Check options.fields type and add images fields
  if (options.fields instanceof Array) {
    options.fields.forEach(function(field) {
      Schema = SetField(Schema, field);
    });
  } else {
    console.log('Fields must be an array');
  }

  Schema.pre('save', function(next) {
    let curObject = this;
    let curObjectImages = {};

    if (options.fields instanceof Array) {
      options.fields.forEach(function(field) {
        if (curObject[field] && curObject[field].length) {
          curObjectImages[field] = {};
          curObject[field].forEach(function(item) {
            curObjectImages[field][item._id.toString()] = item;
          });
        }
      });
    }


    // path = options.rootPath + modelName + nodelObjectId +fieldName + pictureId + img.name

    let modelDirName;
    try {
      modelDirName = options.modelDirName || curObject.constructor.modelName.toLowerCase();
    } catch(e) {
      throw new Error("Can't determine modelDirName. Set options.modelDirName = '<collection_pictures_dirname>' for subDocuments");
    }

    // set, check and create path to store schema images
    let schemaImagesPath = path.join(imagesRootPath, modelDirName);
    let schemaImagesUrl = path.join(imagesRootUrl, modelDirName);
    createPath(schemaImagesPath);

    // set, check and create path to store object images
    let objectImagesPath = path.join(schemaImagesPath, curObject._id.toString());
    let objectImagesUrl = path.join(schemaImagesUrl, curObject._id.toString());
    createPath(objectImagesPath);

    // set empty object to store images objects
    async.series([
      function(cb) {
        if (curObject._drop) {
          curObjectImages = curObject._drop;
        }
        async.forEachOf(curObject._images, function(val, field, cbField) {
          // set, check and create path to store field images
          let filedImagesPath = path.join(objectImagesPath, field);
          let filedImagesUrl = path.join(objectImagesUrl, field);

          createPath(filedImagesPath);
          curObject[field] = [];

          async.each(val, function(img, cbImg) {
            if (mongoose.Types.ObjectId.isValid(img)) {
              if (curObjectImages[field] && curObjectImages[field][img]) {
                curObject[field].push(curObjectImages[field][img]);
                delete curObjectImages[field][img];
              }
              return cbImg();
            } else {
              let curImg = curObject[field].create();
              let imgObjectPath = path.join(filedImagesPath, curImg._id.toString());
              let imgObjectUrl = path.join(filedImagesUrl, curImg._id.toString());
              let fileExt;
              async.series([
                  function(cbFile) {
                    GetExtension(img, function(err, ext) {
                      if (err) return cbFile(err);
                      fileExt = '.' + ext;
                      return cbFile();
                    });
                  },
                  function(cbFile) {
                    createPath(imgObjectPath);
                    return cbFile();
                  },
                  function(cbFile) {
                    let sourcePath = imgObjectPath + '/source' + fileExt;
                    let sourceUrl = imgObjectUrl + '/source' + fileExt;
                    // move file from tmp folder
                    fs.rename(img, sourcePath, function(err) {
                      if (err) return cbFile(err);
                      curImg.source = sourceUrl;
                      return cbFile();
                    });
                  }
                ],
                function(err) {
                  if (err) return cbImg(err);
                  curObject[field].push(curImg);
                  return cbImg();
                });
            }
          }, function(err) {
            if (err) return cbField(err);
            return cbField();
          });
        }, function(err) {
          return cb();
        });
      },
      function(cb) {
        if (!Object.keys(curObjectImages).length) return cb();
        DeleteImages(curObjectImages, objectImagesPath, cb);
      }
    ], function(err) {
      if (err) return next(err);
      return next();
    });
  });
}

module.exports = ModelImagesPlugin;

// get new file extension
function GetExtension(file, next) {
  let fileExt;
  magic.detectFile(file, function(err, mime) {
    switch (mime) {
      case 'image/jpeg':
        fileExt = 'jpg';
        break;
      case 'image/png':
        fileExt = 'png';
        break;
      case 'image/gif':
        fileExt = 'gif';
        break;
    }
    if (err) return next(err);
    return next(null, fileExt);
  });
}

// delete object images
function DeleteImages(toDelete, rootPath, next) {
  async.eachOf(toDelete, function(images, field, cb) {
    if (!Object.keys(images).length) return cb();
    async.each(images, function(img, _cb) {
        rimraf(path.join(rootPath, field, img._id.toString()), function(err) {
          if (err) return _cb(err);
          return _cb();
        });
      },
      function(err) {
        return cb();
      });
  }, function(err) {
    if (err) return next(err);
    return next();
  });
}

function IsObj(val, key, arr) {
  return typeof(val) === 'object';
}

// set fields to schema
function SetField(Schema, field) {
  Schema.path(field, [ImageSchema]);
  Schema.path(field).set(function(images) {
    if (!images.length) {
      //console.log('SET NO IMAGES', images);
      if (!this._drop) this._drop = {};
      this._drop[field] = this[field];
      return [];
    } else if (images.every(IsObj)) {
      //console.log('SET OBJECTS', images);
      return images;
    } else {
      //console.log('SET STRINGS', images);
      if (!this._images) this._images = {};
      this._images[field] = images;
      return this[field];
    }
  });
  return Schema;
}

// check file or folder sync
function checkPath(path) {
  return fs.existsSync(path);
}

// create folder sync
function createPath(path) {
  if (!checkPath(path)) {
    try {
      fs.mkdirSync(path);
    } catch (err) {
      console.log(err);
    }
  }
}
