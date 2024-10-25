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

const familySchema = mongoose.Schema({
    guildID: reqString,
    familyName: reqString,
    familyMembers: [],
    familyChannel: reqString,
    familyProtected: Boolean
})

module.exports = mongoose.model('family-schema', familySchema)