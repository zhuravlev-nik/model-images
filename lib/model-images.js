'use strict';

const mongoose = require('mongoose');
const async = require('async');
const fs = require('fs');
const mmm = require('mmmagic');
const magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);

const request = require('request');
const path = require('path');


const defaultOptions = {
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


function ModelImagesPlugin(Schema, options) {

  options = options || {};
  options = Object.assign(defaultOptions, options);

  // Set and create images root path
  let imagesRootPath = path.join(global.process.env.PWD, options.rootPath);
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

    // set cur object and object isset images

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
    console.log('PRE SAVE START', curObject, curObjectImages);

    // if object dont have imagas and not need add new images return
    if (!curObject._images || !Object.keys(curObject._images).length) return next();

    let curModelName = curObject.constructor.modelName.toLowerCase();

    // set, check and create path to store schema images
    let schemaImagesPath = path.join(imagesRootPath, curModelName);
    let schemaImagesUrl = path.join(imagesRootUrl, curModelName);
    createPath(schemaImagesPath);

    // set, check and create path to store object images
    let objectImagesPath = path.join(schemaImagesPath, curObject._id.toString());
    let objectImagesUrl = path.join(schemaImagesUrl, curObject._id.toString());
    createPath(objectImagesPath);

    // set empty object to store images objects



    async.series([
      function(cb) {
        console.log('WORCK WITH INPUT IMAGES');
        async.forEachOf(curObject._images, function(val, field, cbField) {

          // set, check and create path to store field images
          let filedImagesPath = path.join(objectImagesPath, field);
          let filedImagesUrl = path.join(objectImagesUrl, field);

          createPath(filedImagesPath);

          curObject[field] = [];
          async.each(val, function(img, cbImg) {
            if (mongoose.Types.ObjectId.isValid(img)) {
              // if var is objectId - move image to new object
              if (curObjectImages[field] && curObjectImages[field][img]) {
                curObject[field].push(curObjectImages[field][img]);
                delete curObjectImages[field][img];
              }
              return cbImg();
            } else {
              let curImg = curObject[field].create();

              let imgObjectPath = path.join(filedImagesPath, curImg._id.toString());
              let imgObjectUrl = path.join(filedImagesUrl, curImg._id.toString());

              async.series([
                  function(cbFile) {
                    // check mime type and set extension and create folder
                    createPath(imgObjectPath);
                    return cbFile();
                  },
                  function(cbFile) {
                    let sourcePath = imgObjectPath + '/source.jpg';
                    let sourceUrl = imgObjectUrl + '/source.jpg';
                    // move file from tmp folder
                    fs.rename(img, sourcePath, function(err) {
                      if (err) return cbFile(err);
                      curImg.source = sourceUrl;
                      //console.log('CUR IMG', curImg);
                      return cbFile();

                    });
                  }
                ],
                function(err) {
                  if (err) return cbImg(err);
                  //console.log('BEFORE ADD', curObject[field], curImg);
                  curObject[field].push(curImg);
                  console.log('IS NEW IMAGE', curObject);
                  return cbImg();
                });
            }

          }, function(err) {
            console.log(err);
            if (err) return cbField(err);
            return cbField();
          });
        }, function(err) {
          return cb();
        });
      },
      function(cb) {
        for (let field in curObjectImages) {
          if (curObjectImages[field].length) {
            console.log('need delete');
          }
        }
        return cb();
      }
    ], function(err) {
      if (err) return next(err);
      return next();
    });

  });
}

module.exports = ModelImagesPlugin;


function IsObj(val, key, arr) {
  return typeof(val) === 'object';
}

// set fields to schema

function SetField(Schema, field) {
  Schema.path(field, [ImageSchema]);
  Schema.path(field).set(function(images) {
    if (images.every(IsObj)) {
      return images;
    } else {
      if (!this._images) this._images = {};
      this._images[field] = images;
      return this[field];
    }
  });
  return Schema;
}

// get file mime type
function getMime(filePath) {}

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