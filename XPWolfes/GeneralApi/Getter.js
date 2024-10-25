const mongo = require("../mongo.js");
const gameData = require("../Schemas/game-data.js")
const rolesData = require("../Schemas/roles-schema.js");
const usersData = require("../Schemas/users.js")
const gen = require("../generalfunctions.js");
const { userMention, Colors } = require("discord.js");
const familySchema = require("../Schemas/family-schema.js");

///--------------------------------------
///     User data information
///--------------------------------------

async function GetUser(userId, guildId){
    const user = await usersData.findOne({_id: userId, guildID: guildId})

    if(user) return user;
    return undefined;
}

///--------------------------------------
///     Game data information
///--------------------------------------
async function GetGame(guildId){
    const game = await gameData.findOne({_id: guildId})

    return game; 
}

async function GameStarted(guildId){
    const game = await GetGame(guildId)

    if(game) return game.started;
    else return undefined;
}

async function GameFinished(guildId){
    const game = await GetGame(guildId)

    if(game) return game.finished;
    else return undefined;
}

async function GameInProgress(guildId){
    const game = await GetGame(guildId)

    if(game) {
        if(game.started && !game.finished) return true;
        else return false;
    }
    else return undefined;
}

async function GetDay(guildId){
    const game = await GetGame(guildId);

    if(game) return game.day;
    else return undefined;
}

///--------------------------------------
///     Role data information
///--------------------------------------
async function GetRole(guildId, RoleName){
    const role = await rolesData.findOne({guildID: guildId, roleName: RoleName})

    if(role) return role;
    else return undefined;
}

async function GetFamily(guildId, channel){
    const family = await familySchema.findOne({guildID: guildId, familyChannel: channel});

    if(family) return family
    else return undefined;
}
async function GetUsersFamily(guildId, userId){
    const family = await familySchema.findOne({guildID: guildId, familyMembers: {$in: userId}});

    if(family) return family
    else return undefined;
}



module.exports = {
    GetUser,
    GetGame,
    GameStarted,
    GameFinished,
    GameInProgress,
    GetDay,
    GetRole,
    GetUsersFamily,
    GetFamily,
}