const mongoose = require("mongoose");

const reqString = {
    type: String,
    required: true
}

const string = {
    type: String,
    required: false
}

const reqBool = {
    type: Boolean,
    required: true
}
const bool = {
    type: Boolean,
    required: false
}

const game = mongoose.Schema({
    _id: reqString,
    started: reqBool,
    finished: bool,
    anouncementChannel: string,
    voteChannel: string,
    modChannel: string,
    deadChannel: string,
    lynchTimeStart: string,
    lynchTimeEnd: string,
    canVote: bool,
    alive: [],
    dead: [],
    day: Number,
    morning: string,
    night: string,
    nightKilled: [],
    newspaper: string
})

module.exports = mongoose.model('game-data', game)