const mongoose = require("mongoose");

const reqString = {
    type: String,
    required: true
}

const reqBool = {
    type: Boolean,
    required: true
}

const bool = {
    type: Boolean,
    required: false
}

const users = mongoose.Schema({
    _id: reqString,
    guildID: reqString,
    dead: reqBool,
    isMayor: bool,
    voted: reqBool,
    votedOn: String,
    votedOnMayor: String,
    isMayor: bool
})

module.exports = mongoose.model('user-data', users)