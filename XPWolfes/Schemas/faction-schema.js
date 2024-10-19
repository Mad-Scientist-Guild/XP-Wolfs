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

const factionSchema = mongoose.Schema({
    guildID: reqString,
    factionName: reqString,
    factionMembers: []
})

module.exports = mongoose.model('faction-schema', factionSchema)