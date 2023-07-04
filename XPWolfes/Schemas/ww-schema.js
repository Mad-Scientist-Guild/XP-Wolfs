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

const ww = mongoose.Schema({
    _id: reqString,
    starttime: reqString,
    endtime: reqString,
    channel: reqString,
    members: [],
    votes: [],
    canVote: bool
})

module.exports = mongoose.model('ww-schema', ww)