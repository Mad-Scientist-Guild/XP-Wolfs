const mongoose = require("mongoose");

const reqString = {
    type: String,
    required: true
}

const reqInt = {
    type: Number,
    required: true
}

const bool = {
    type: Boolean,
    required: false
}

const brothers = mongoose.Schema({
    _id: reqString,
    brothers: [],
    channel: reqString,
    newBrotherVote: [],
    addedBrother: String
})

module.exports = mongoose.model('brothers-schema', brothers)