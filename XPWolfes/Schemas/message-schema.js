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

const messageSchema = mongoose.Schema({
    guildID: reqString,
    time: reqString,
    channelID: reqString,
    message: String
})

module.exports = mongoose.model('message-schema', messageSchema)