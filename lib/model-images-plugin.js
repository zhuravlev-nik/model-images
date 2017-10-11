'use strict';

const mongoose = require('mongoose');
const async = require('async');


function ModelImagesPlugin(Schema, options) {

  options = options || {};
  Schema.add({
    name: {
      type: String,
    },
  });
}

module.exports = ModelImagesPlugin;