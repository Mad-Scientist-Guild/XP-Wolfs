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

const Mayor = mongoose.Schema({
    _id : reqString,
    canVote: reqBool,
    mayor: String,
    votes: [],
    successor: String
})

module.exports = mongoose.model('mayor-schema', Mayor)