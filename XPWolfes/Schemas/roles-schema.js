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

const roleSchema = mongoose.Schema({
    guildID: reqString,
    roleName: reqString,
    channelID: String,
    roleMembers: [],
    specialFunctions: []
})

module.exports = mongoose.model('role-schema', roleSchema)