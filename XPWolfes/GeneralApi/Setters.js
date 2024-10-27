const mongo = require("../mongo.js");
const gameData = require("../Schemas/game-data.js")
const rolesData = require("../Schemas/roles-schema.js");
const usersData = require("../Schemas/users.js")
const gen = require("../generalfunctions.js");
const { userMention, Colors } = require("discord.js");
const familySchema = require("../Schemas/family-schema.js");

///--------------------------------------
///     Role data information
///--------------------------------------
async function SetRole(guildId, RoleName, data){
    const role = await rolesData.updateOne(
        {guildID: guildId, roleName: RoleName},
        data,
        {options: {upsert: true}}
    )

    if(role) return role;
    else return undefined;
}

async function ProtectPlayer(GuildID, UserID)
{
    await usersData.updateOne({_id: UserID, guildID: GuildID}, 
        {protected: true}, {options: {upsert: true}});
}

async function DontProtectPlayer(GuildID, UserID)
{
    await usersData.updateOne({_id: UserID, guildID: GuildID}, 
        {protected: false}, {options: {upsert: true}});
}

async function BlockPlayer(GuildID, UserID)
{
    await usersData.updateOne({_id: UserID, guildID: GuildID}, 
        {blocked: true}, {options: {upsert: true}});
}

async function DontBlockPlayer(GuildID, UserID)
{
    await usersData.updateOne({_id: UserID, guildID: GuildID}, 
        {blocked: false}, {options: {upsert: true}});
}



module.exports = {
    SetRole,
    ProtectPlayer,
    DontProtectPlayer,
    BlockPlayer,
    DontBlockPlayer
}