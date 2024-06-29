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

const reqArray = {
    type: Array,
    default: [],
    required: true
}

const game = mongoose.Schema({
    _id: reqString,
    started: reqBool,
    finished: reqBool,
    channels: reqArray,
    times: reqArray,
    canVote: reqBool,
    votes: [],
    alive: [],
    dead: [],
    day: Number,
    nightKilled: [],
    newspaper: string,
    leftHouse: []
})

module.exports = mongoose.model('game-data', game)