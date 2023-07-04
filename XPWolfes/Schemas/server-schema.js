const mongoose = require("mongoose");

const reqString = {
    type: String,
    required: true
}

const reqArray = {
    type: Array,
    default: [],
    required: true
}

const serverSchema = mongoose.Schema({
    _id: reqString,
    roleId: reqString,
    channelId: reqString,
    messages: reqArray,
    callouts: reqArray,
    times: reqArray,
    calloutTimer: reqString
})

module.exports = mongoose.model('server-schema', serverSchema)