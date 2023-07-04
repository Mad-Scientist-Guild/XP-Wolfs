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

const votes = mongoose.Schema({
    _id: reqString,
    guildID: reqString,
    votedBy: []
})

module.exports = mongoose.model('vote-data', votes)