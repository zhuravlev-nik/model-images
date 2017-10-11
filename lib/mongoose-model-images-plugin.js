'use strict';

const mongoose = require('mongoose');
const async = require('async');
const fs = require('fs');
const mime = require('mime');
const request = require('request');



let ImageShema = new mongoose.Schema({
  sizes: mongoose.Schema.Types.Mixed
});


function ModelImagesPlugin(Schema, options) {
  options = options || {};
  let defaultOptions = {
    fields: ['pictures'],
    rootPath: 'public'
  };
  let SchemaFields = Object.keys(Schema.paths);


  options = Object.assign(defaultOptions, options);
  let rootPath = global.process.env.PWD + '/' + options.rootPath + '/';
  rootPath += (options.name) ? options.name + '/' : '';

  options.fields.forEach(function(field) {
    Schema.path(field, [ImageShema]);
  });
  //Schema.path(options.fields, [ImageShema]);
  //pictures: ,
  Schema.add({
    name: {
      type: String,
    },
  });
  //console.log(SchemaFields);
  console.log(rootPath);
}

module.exports = ModelImagesPlugin;