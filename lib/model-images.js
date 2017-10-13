'use strict';

const mongoose = require('mongoose');
const async = require('async');
const fs = require('fs');
const mmm = require('mmmagic');
const magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);

const request = require('request');
const path = require('path');


const defaultOptions = {
  fields: 'pictures',
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
  sizes: mongoose.Schema.Types.Mixed,
  created: {
    type: Date,
    default: Date.now
  }
});



function ModelImagesPlugin(Schema, options) {
  options = options || {};
  options = Object.assign(defaultOptions, options);

  // Set images root path
  let imagesRootPath = path.join(global.process.env.PWD, options.rootPath);
  let SchemaFields = Object.keys(Schema.paths);

  // Add images fields
  switch (typeof options.fields) {
    case 'string':
      let field = options.fields;
      Schema = SetField(Schema, field);
      break;
    case 'object':
      if (options.fields instanceof Array) {
        options.fields.forEach(function(field) {
          Schema = SetField(Schema, field);
        });
      }
      break;
  }

  Schema.pre('save', function(next) {
    if (!this._images || !Object.keys(this._images).length) return next();
    console.log('PRE SAVE', this, this._images);

    let modelName = this.constructor.modelName.toLowerCase();
    let imagesSchemaPath = path.join(imagesRootPath, modelName);

    createPath(imagesSchemaPath);

    let images = {};
    async.forEachOf(this._images, function(val, key, cb) {
      console.log(key, val);
      return cb();
    }, function(err) {
      return next();
    });



    /*if (req.files && req.files.length) {
      fs.rename(req.files[0].destination + req.files[0].filename, __baseDir + '/public/cars/' + car._id + '.jpg', cb);
      car.pictures = ['/img/cars/' + car._id + '.jpg'];
    } else {
    }*/



    /*
        
        //this[field] = [];
        if (images && images.length) {
          this._images[field] = images;
          //console.log(images);
          images.forEach(function(img) {
            magic.detectFile(img, function(err, result) {
              console.log(err, result);
            });;
          });
        }
    */



    //console.log('PRE SAVE', this._images, this);
    //createPath(imagesSchemaPath);

  });
  createPath(imagesRootPath);
}

module.exports = ModelImagesPlugin;

function SetField(Schema, field) {
  Schema.path(field, [ImageSchema]);
  Schema.path(field).set(function(images) {
    if (!this._images) this._images = {};
    this._images[field] = images;
    return this[field];
  });
  return Schema;
}

function getMime(filePath) {}

function checkPath(path) {
  return fs.existsSync(path);
}

function createPath(path) {
  if (!checkPath(path)) {
    try {
      fs.mkdirSync(path);
    } catch (err) {
      console.log(err);
    }
  }
}