const mongoose = require("mongoose");

const reqString = {
    type: String,
    required: true
}

const imageSchema = mongoose.Schema({
    _id: reqString,
    imageURL: reqString,
})

module.exports = mongoose.model('image-schema', imageSchema)