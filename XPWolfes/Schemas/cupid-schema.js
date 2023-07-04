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

const cupid = mongoose.Schema({
    _id: reqString,
    cupid: reqString,
    lovers: [],
    loversDead: bool,
    cupidChannel: reqString,
    loversChannel: reqString
})

module.exports = mongoose.model('cupid-schema', cupid)